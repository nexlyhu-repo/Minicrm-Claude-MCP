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
  if (cache.catIds.length) return cache.catIds;
  const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
  cache.catIds = Object.keys(categories || {}).map(Number).filter(Boolean);
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
  const scope = opts.scope || "responsible";
  const cache = getCacheEntry(client.systemId);

  // === Resolve project IDs to scan ==========================================
  let projectIds: number[];
  let totalProjects: number;

  if (scope === "responsible" && opts.filterUserId) {
    // Fast path: ask MiniCRM for projects where this user is responsible.
    // Misses todos assigned to the user on someone else's project (use scope=all for that),
    // but covers the common "my day" case in <5 seconds.
    const params: Record<string, string | number> = { UserId: opts.filterUserId };
    if (opts.categoryId) params.CategoryId = opts.categoryId;
    try {
      const result = await client.search("/Api/R3/Project", params, true);
      projectIds = Object.keys(result.Results || {}).map(Number).filter(Boolean);
    } catch {
      projectIds = [];
    }
    totalProjects = projectIds.length;
    console.log(`[fetchAllTodos] scope=responsible userId=${opts.filterUserId} → ${projectIds.length} projects`);
  } else {
    // Broad path: iterate all categories. Use cache to avoid repeating the
    // 23 list-projects calls on every invocation.
    const catIds = opts.categoryId
      ? [opts.categoryId]
      : await getCategoryIds(client, cache);

    const allProjectIds: number[] = [];
    for (let i = 0; i < catIds.length; i += 5) {
      const batch = catIds.slice(i, i + 5).map((catId) => getProjectIdsForCategory(client, catId, cache));
      const results = await Promise.all(batch);
      for (const ids of results) allProjectIds.push(...ids);
    }
    totalProjects = allProjectIds.length;
    projectIds = allProjectIds;
    console.log(`[fetchAllTodos] scope=all cats=${catIds.length} → ${projectIds.length} projects`);
  }

  // === Scan ToDoList per project with hard time budget ======================
  const BATCH = 10;
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
        // In responsible-mode the project filter already narrows scope, but
        // we still apply the per-todo filter so an assignee not equal to the
        // responsible user is dropped (UserId on a todo can differ from the
        // project's responsible user).
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
    // Throttle to stay under MiniCRM's per-system 429 ceiling.
    if (i + BATCH < projectIds.length) {
      await new Promise((r) => setTimeout(r, 200));
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
    "Az OSSZES nyitott teendo lekerdezese a felhasznalo projektjeibol. FONTOS: a userId a CRM operator (felhasznalo) ID-ja, NEM a kontakt ID! Eloszor hivd meg a minicrm_list_users toolt es onnan vedd a UserId-t. Alapertelmezetten csak a felhasznalo SAJAT (felelos) projektjeit nezi (gyors, ~5mp). Ha mas felelos projektjein is kapott teendoket (ritka eset), hasznald a scope='all' beallitast (lassu, akar 90mp).",
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
        .default("responsible")
        .describe("'responsible' (alapertelmezett, gyors): csak a felhasznalo SAJAT projektjei. 'all' (lassu, akar 90mp): az osszes projekt — tul a 90mp idokereten csonkolt eredmenyt ad vissza."),
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
    "Napi osszefoglalo a felhasznalo nyitott teendoirol: mai hatarideju, lejart, kovetkezo. FONTOS: a userId a CRM operator (felhasznalo) ID-ja, NEM a kontakt ID! Hivd meg eloszor a minicrm_list_users toolt. Alapertelmezetten csak a felhasznalo SAJAT (felelos) projektjeibol gyujt (gyors, ~5mp); ez fedi le a tipikus 'mit kell ma csinalnom' kerdest.",
    {
      userId: z.number().describe("CRM felhasznalo (operator) ID-ja — NEM kontakt ID. Hivd meg eloszor a minicrm_list_users toolt!"),
      categoryId: z.number().optional().describe("Opcionalis: csak egy modul teendoi."),
      scope: z
        .enum(["responsible", "all"])
        .optional()
        .default("responsible")
        .describe("'responsible' (alapertelmezett): csak a felhasznalo sajat projektjei. 'all': minden projekt (lassu, akar 90mp; ritka esetekhez)."),
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
