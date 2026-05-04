import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";
import { SearchResponse } from "../types.js";

interface ToDo {
  Id: number;
  ProjectId: number;
  UserId: number;
  Comment: string;
  Deadline: string;
  Status: string;
  Type?: string;
  [key: string]: unknown;
}

// === Project list cache (per tenant, 5 min TTL) =============================
//
// nginx terminates the /mcp request after 120s. The MiniCRM API has no "list
// todos by user" endpoint, so a broad scan iterates ToDoList/{id} per project.
// With ~1600 projects + 200ms safety delay between batches of 10, this
// regularly blows past 120s. Caching the (rarely changing) project list per
// category lets repeat calls skip the upfront 23 list-projects requests, and
// keeps the broad-scan budget realistic.

interface ProjectListCacheEntry {
  expiresAt: number;
  catIds: number[];
  projectsByCat: Map<number, number[]>;
}

const projectListCache = new Map<string, ProjectListCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheEntry(systemId: string): ProjectListCacheEntry {
  const existing = projectListCache.get(systemId);
  if (existing && existing.expiresAt > Date.now()) return existing;
  const fresh: ProjectListCacheEntry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    catIds: [],
    projectsByCat: new Map(),
  };
  projectListCache.set(systemId, fresh);
  return fresh;
}

async function getCategoryIds(client: MiniCrmClient, cache: ProjectListCacheEntry): Promise<number[]> {
  if (!cache.catIds.length) {
    const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
    cache.catIds = Object.keys(categories || {}).map(Number).filter(Boolean);
  }
  // If the license has a self-service module allowlist, narrow the iteration
  // here. The cache itself stays full so other tenants and the per-request
  // override path can still see the unfiltered list.
  const allowed = client.allowedCategoryIds;
  if (allowed && allowed.length) {
    const allowSet = new Set(allowed);
    return cache.catIds.filter((id) => allowSet.has(id));
  }
  return cache.catIds;
}

async function getProjectIdsForCategory(client: MiniCrmClient, catId: number, cache: ProjectListCacheEntry): Promise<number[]> {
  const cached = cache.projectsByCat.get(catId);
  if (cached) return cached;
  try {
    const projects = await client.request<SearchResponse>("GET", `/Api/R3/Project?CategoryId=${catId}`);
    const ids = Object.keys(projects.Results || {}).map(Number).filter(Boolean);
    cache.projectsByCat.set(catId, ids);
    return ids;
  } catch {
    return [];
  }
}

interface FetchTodosResult {
  todos: (ToDo & { _projectId: number })[];
  scope: "responsible" | "all";
  scannedProjects: number;
  totalProjects: number;
  truncated: boolean;
  durationMs: number;
}

const TIME_BUDGET_MS = 90_000; // safety margin under nginx's 120s timeout

async function getResponsibleProjectIds(
  client: MiniCrmClient,
  filterUserId: number,
  categoryId?: number
): Promise<number[]> {
  const params: Record<string, string | number> = { UserId: filterUserId };
  if (categoryId) params.CategoryId = categoryId;
  try {
    const result = await client.search("/Api/R3/Project", params, true);
    return Object.keys(result.Results || {}).map(Number).filter(Boolean);
  } catch {
    return [];
  }
}

async function getAllProjectIds(
  client: MiniCrmClient,
  cache: ProjectListCacheEntry,
  categoryId?: number
): Promise<number[]> {
  const catIds = categoryId ? [categoryId] : await getCategoryIds(client, cache);
  const allProjectIds: number[] = [];
  for (let i = 0; i < catIds.length; i += 5) {
    const batch = catIds.slice(i, i + 5).map((catId) => getProjectIdsForCategory(client, catId, cache));
    const results = await Promise.all(batch);
    for (const ids of results) allProjectIds.push(...ids);
  }
  return allProjectIds;
}

async function fetchAllTodos(
  client: MiniCrmClient,
  opts: {
    status?: string;
    categoryId?: number;
    filterUserId?: number;
    scope?: "responsible" | "all";
  }
): Promise<FetchTodosResult> {
  const start = Date.now();
  const scope = opts.scope || "all";
  const cache = getCacheEntry(client.systemId);

  // Honor the license-level module allowlist on explicit categoryId requests.
  // The general scan path (no categoryId) is filtered inside getCategoryIds().
  // For scope=responsible, MiniCRM applies the categoryId filter server-side
  // and we only need to gate the request itself.
  const allowed = client.allowedCategoryIds;
  if (opts.categoryId && allowed && allowed.length && !allowed.includes(opts.categoryId)) {
    throw new Error(
      `A megadott modul (categoryId=${opts.categoryId}) nincs engedelyezve ehhez a licenchez. Engedelyezett modulok: ${allowed.join(", ")}. Modositas: jelentkezz be ujra Claude-bol es valassz modulokat.`
    );
  }

  // === Resolve project IDs to scan ==========================================
  // For scope=all + filterUserId, prioritize the user's own (responsible) projects
  // first. If the time budget runs out, the most relevant projects are already
  // scanned, and the truncation flag tells the caller results may be incomplete
  // for projects where the user is just an assignee.
  let projectIds: number[];
  let totalProjects: number;

  if (scope === "responsible" && opts.filterUserId) {
    projectIds = await getResponsibleProjectIds(client, opts.filterUserId, opts.categoryId);
    totalProjects = projectIds.length;
    console.log(`[fetchAllTodos] scope=responsible userId=${opts.filterUserId} → ${projectIds.length} projects`);
  } else if (scope === "all" && opts.filterUserId) {
    // Hybrid: responsible projects first (priority), then all others.
    const [responsible, all] = await Promise.all([
      getResponsibleProjectIds(client, opts.filterUserId, opts.categoryId),
      getAllProjectIds(client, cache, opts.categoryId),
    ]);
    const seen = new Set(responsible);
    const others = all.filter((id) => !seen.has(id));
    projectIds = [...responsible, ...others];
    totalProjects = projectIds.length;
    console.log(`[fetchAllTodos] scope=all userId=${opts.filterUserId} → ${responsible.length} responsible + ${others.length} others = ${projectIds.length}`);
  } else {
    projectIds = await getAllProjectIds(client, cache, opts.categoryId);
    totalProjects = projectIds.length;
    console.log(`[fetchAllTodos] scope=all → ${projectIds.length} projects`);
  }

  // === Scan ToDoList per project with hard time budget ======================
  // BATCH=20 + 100ms delay tuned empirically: previous BATCH=10/200ms only
  // covered ~500 of 1598 projects in 120s. With doubled parallelism we typically
  // finish 1500+ projects in 60-80s, comfortably under the 90s budget.
  const BATCH = 20;
  const allTodos: (ToDo & { _projectId: number })[] = [];
  let scanned = 0;
  let truncated = false;

  for (let i = 0; i < projectIds.length; i += BATCH) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      truncated = true;
      console.log(`[fetchAllTodos] time budget exceeded after ${scanned}/${projectIds.length} projects`);
      break;
    }
    const slice = projectIds.slice(i, i + BATCH);
    const batch = slice.map(async (pid) => {
      try {
        const statusFilter = opts.status && opts.status !== "All" ? opts.status : "Open";
        const data = await client.request<any>("GET", `/Api/R3/ToDoList/${pid}?Status=${statusFilter}`);
        let todos: ToDo[] = [];
        if (Array.isArray(data?.Results)) todos = data.Results;
        else if (data && typeof data === "object") {
          todos = Object.values(data).filter(
            (t): t is ToDo => typeof t === "object" && t !== null && "Id" in t
          );
        }
        // Per-todo filter: a project may be scoped in but only some todos belong
        // to the requested user (the project's responsible UserId can differ
        // from any individual todo's UserId).
        return todos
          .filter((t) => !opts.filterUserId || Number(t.UserId) === opts.filterUserId)
          .map((t) => ({ ...t, _projectId: pid }));
      } catch {
        return [];
      }
    });
    const results = await Promise.all(batch);
    for (const todos of results) allTodos.push(...todos);
    scanned += slice.length;
    if (i + BATCH < projectIds.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return {
    todos: allTodos,
    scope,
    scannedProjects: scanned,
    totalProjects,
    truncated,
    durationMs: Date.now() - start,
  };
}

export function registerToDoTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOLS ===

  server.tool(
    "minicrm_list_all_todos",
    "A felhasznalo OSSZES nyitott teendojenek lekerdezese, fuggetlenul attol, hogy melyik projekten van — beleertve azokat is, ahol mas a felelos. FONTOS: a userId a CRM operator (felhasznalo) ID-ja, NEM a kontakt ID! Hivd meg eloszor a minicrm_list_users toolt es onnan vedd a UserId-t. A felhasznalo sajat projektjei priorizalva, utana mindenhol mas. 30-60 mp futasi ido tipikusan. Ha gyors valaszt szeretnel csak a sajat projektekrol, hasznald scope='responsible'.",
    {
      userId: z.number().optional().describe("CRM felhasznalo (operator) ID-ja — NEM kontakt ID. Hivd meg eloszor a minicrm_list_users toolt!"),
      categoryId: z.number().optional().describe("Opcionalis: csak egy adott modul teendoi."),
      status: z
        .enum(["Open", "Closed", "All"])
        .optional()
        .default("Open")
        .describe("Szuro: Open (nyitott), Closed (lezart) vagy All (mind)"),
      scope: z
        .enum(["responsible", "all"])
        .optional()
        .default("all")
        .describe("'all' (alapertelmezett): osszes projekt szkennelese, sajat projektek priorizalva. 'responsible': csak a felhasznalo sajat projektjei (gyors, de kihagyja a mashol kapott teendoket)."),
    },
    async ({ userId, status, categoryId, scope }) => {
      try {
        const result = await fetchAllTodos(client, {
          status,
          categoryId,
          filterUserId: userId,
          scope,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              count: result.todos.length,
              userId: userId || undefined,
              scope: result.scope,
              scannedProjects: result.scannedProjects,
              totalProjects: result.totalProjects,
              truncated: result.truncated,
              durationMs: result.durationMs,
              todos: result.todos,
            }, null, 2),
          }],
        };
      } catch (error) {
        console.error("[minicrm_list_all_todos] error:", error);
        return {
          content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "minicrm_my_day",
    "Napi osszefoglalo a felhasznalo OSSZES nyitott teendojerol: mai hatarideju, lejart, kovetkezo. Magaban foglalja azokat is, amiket mas felelos projektjen kapott. FONTOS: a userId a CRM operator (felhasznalo) ID-ja, NEM a kontakt ID! Hivd meg eloszor a minicrm_list_users toolt. 30-60 mp futasi ido tipikusan.",
    {
      userId: z.number().describe("CRM felhasznalo (operator) ID-ja — NEM kontakt ID. Hivd meg eloszor a minicrm_list_users toolt!"),
      categoryId: z.number().optional().describe("Opcionalis: csak egy modul teendoi."),
      scope: z
        .enum(["responsible", "all"])
        .optional()
        .default("all")
        .describe("'all' (alapertelmezett): osszes projekt, sajat projektek priorizalva. 'responsible': csak a sajat projektek (gyors, de hianyos)."),
    },
    async ({ categoryId, userId, scope }) => {
      try {
        const result = await fetchAllTodos(client, { categoryId, filterUserId: userId, scope });

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];

        const today: typeof result.todos = [];
        const overdue: typeof result.todos = [];
        const upcoming: typeof result.todos = [];

        for (const todo of result.todos) {
          if (!todo.Deadline) { upcoming.push(todo); continue; }
          const deadlineDate = todo.Deadline.split(" ")[0];
          if (deadlineDate === todayStr) today.push(todo);
          else if (deadlineDate < todayStr) overdue.push(todo);
          else upcoming.push(todo);
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              userId,
              date: todayStr,
              scope: result.scope,
              scannedProjects: result.scannedProjects,
              totalProjects: result.totalProjects,
              truncated: result.truncated,
              durationMs: result.durationMs,
              summary: {
                today: today.length,
                overdue: overdue.length,
                upcoming: upcoming.length,
                total: result.todos.length,
              },
              today,
              overdue,
              upcoming,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  // === EXISTING TOOLS ===

  server.tool(
    "minicrm_list_todos",
    "Teendok listazasa egy projekthez (adatlaphoz). Szurheto statusz alapjan.",
    {
      projectId: z.number().describe("A projekt (adatlap) ID-ja"),
      status: z
        .enum(["Open", "Closed", "All"])
        .optional()
        .default("All")
        .describe("Szuro: Open (nyitott), Closed (lezart) vagy All (mind)"),
    },
    async ({ projectId, status }) => {
      try {
        let path = `/Api/R3/ToDoList/${projectId}`;
        if (status && status !== "All") {
          path += `?Status=${status}`;
        }
        const data = await client.request("GET", path);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Hiba: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "minicrm_get_todo",
    "Egy teendo reszletes adatainak lekerdezese ID alapjan.",
    { todoId: z.number().describe("A teendo ID-ja") },
    async ({ todoId }) => {
      try {
        const data = await client.request("GET", `/Api/R3/ToDo/${todoId}`);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Hiba: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "minicrm_create_todo",
    "Uj teendo (feladat) letrehozasa egy projekthez. Kotelezo: projectId.",
    {
      projectId: z.number().describe("A projekt (adatlap) ID-ja amelyhez a teendo tartozik"),
      userId: z.number().optional().describe("A felelos felhasznalo ID-ja"),
      comment: z.string().optional().describe("A teendo szovege / leirasa"),
      deadline: z
        .string()
        .optional()
        .describe("Hatarido (formatum: yyyy-mm-dd hh:mm:ss)"),
      duration: z
        .number()
        .optional()
        .describe("Idotartam percben"),
      reminder: z
        .number()
        .optional()
        .describe("Emlekezeto percben a hatarido elott"),
    },
    async ({ projectId, userId, comment, deadline, duration, reminder }) => {
      try {
        const body: Record<string, unknown> = { ProjectId: projectId };
        if (userId) body.UserId = userId;
        if (comment) body.Comment = comment;
        if (deadline) body.Deadline = deadline;
        if (duration) body.Duration = duration;
        if (reminder !== undefined) body.Reminder = reminder;

        const data = await client.request("PUT", "/Api/R3/ToDo", body);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Hiba: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "minicrm_update_todo",
    "Nyitott teendo frissitese. Csak nyitott (Open) teendok modosithatoak. A ProjectId nem valtoztathato.",
    {
      todoId: z.number().describe("A teendo ID-ja"),
      fields: z
        .record(z.unknown())
        .describe(
          "Frissitendo mezok (pl. {\"Comment\": \"Uj leiras\", \"Deadline\": \"2026-04-15 10:00:00\"})"
        ),
    },
    async ({ todoId, fields }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/ToDo/${todoId}`,
          fields
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Hiba: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "minicrm_close_todo",
    "Teendo lezarasa. Opcionalis egyedi lezarasi datummal. Lezart teendok nem nyithatoak ujra.",
    {
      todoId: z.number().describe("A lezarando teendo ID-ja"),
      closedAt: z
        .string()
        .optional()
        .describe("Egyedi lezarasi datum (formatum: yyyy-mm-dd hh:mm:ss). Ha nincs megadva, az aktualis ido lesz."),
    },
    async ({ todoId, closedAt }) => {
      try {
        const body: Record<string, unknown> = { Status: "Closed" };
        if (closedAt) body.ClosedAt = closedAt;

        const data = await client.request(
          "POST",
          `/Api/R3/ToDo/${todoId}`,
          body
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Hiba: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
