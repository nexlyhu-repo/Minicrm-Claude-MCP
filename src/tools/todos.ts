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

// Helper: resolve user name to MiniCRM UserId
// MiniCRM UserId (for todos/projects) is NOT the same as Contact Id.
// Strategy: get project schema, find UserId field, match name.
async function resolveUserId(client: MiniCrmClient, userName?: string, userId?: number): Promise<number | undefined> {
  if (userId) return userId;
  if (!userName) return undefined;

  const searchName = userName.toLowerCase();

  try {
    const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
    const catIds = Object.keys(categories || {}).map(Number).filter(Boolean);

    for (const catId of catIds.slice(0, 5)) {
      try {
        const schema = await client.request<Record<string, unknown>>("GET", `/Api/R3/Schema/Project/${catId}`);

        // Log the full UserId field structure so we can see what format it has
        const userField = schema?.UserId;
        if (!userField || typeof userField !== 'object') {
          console.log(`[resolveUserId] cat ${catId}: UserId field is ${typeof userField}`);
          continue;
        }

        // Dump all keys of the UserId object for debugging
        const fieldKeys = Object.keys(userField as Record<string, unknown>);
        console.log(`[resolveUserId] cat ${catId}: UserId field keys: ${fieldKeys.join(', ')}`);

        // Try every possible sub-key that might contain the user list
        const uf = userField as Record<string, unknown>;
        const candidates = [uf.Values, uf.options, uf.Options, uf.Enum, uf];

        for (const values of candidates) {
          if (!values || typeof values !== 'object') continue;
          for (const [id, name] of Object.entries(values as Record<string, unknown>)) {
            const numId = parseInt(id, 10);
            if (!numId || typeof name !== 'string') continue;
            if (name.toLowerCase().includes(searchName) || searchName.includes(name.toLowerCase())) {
              console.log(`[resolveUserId] '${userName}' → ${numId} (name: '${name}', cat ${catId})`);
              return numId;
            }
          }
        }
      } catch { continue; }
    }

    console.log(`[resolveUserId] '${userName}' not found in any schema`);
    return undefined;
  } catch (err) {
    console.error(`[resolveUserId] error for '${userName}':`, err);
    return undefined;
  }
}

// Helper: fetch all todos from all projects in parallel
async function fetchAllTodos(
  client: MiniCrmClient,
  opts: { status?: string; categoryId?: number; filterUserId?: number }
): Promise<(ToDo & { _projectId: number })[]> {
  let projectIds: number[] = [];

  // Strategy: if we have a userId, search projects where they're responsible (much faster)
  // This reduces 1500+ projects to typically 10-30
  if (opts.filterUserId && !opts.categoryId) {
    // Get categories first, then search per category with UserId filter
    const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
    const catIds = Object.keys(categories || {}).map(Number).filter(Boolean);
    console.log(`[fetchAllTodos] ${catIds.length} categories, filtering by UserId=${opts.filterUserId}`);

    const allProjectIds: number[] = [];
    for (let i = 0; i < catIds.length; i += 5) {
      const batch = catIds.slice(i, i + 5).map(async (catId) => {
        try {
          const projects = await client.request<SearchResponse>("GET",
            `/Api/R3/Project?CategoryId=${catId}&UserId=${opts.filterUserId}`);
          return Object.keys(projects.Results || {}).map(Number).filter(Boolean);
        } catch { return []; }
      });
      const results = await Promise.all(batch);
      for (const ids of results) allProjectIds.push(...ids);
    }

    // Also search projects where they're the contact (not just responsible)
    try {
      const contactProjects = await client.request<SearchResponse>("GET",
        `/Api/R3/Project?MainContactId=${opts.filterUserId}`);
      const contactIds = Object.keys(contactProjects.Results || {}).map(Number).filter(Boolean);
      for (const id of contactIds) {
        if (!allProjectIds.includes(id)) allProjectIds.push(id);
      }
    } catch { /* skip */ }

    projectIds = allProjectIds;
    console.log(`[fetchAllTodos] User-filtered projects: ${projectIds.length}`);
  } else if (opts.categoryId) {
    const projects = await client.request<SearchResponse>("GET",
      `/Api/R3/Project?CategoryId=${opts.categoryId}${opts.filterUserId ? `&UserId=${opts.filterUserId}` : ''}`);
    projectIds = Object.keys(projects.Results || {}).map(Number).filter(Boolean);
    console.log(`[fetchAllTodos] Category ${opts.categoryId}: ${projectIds.length} projects`);
  } else {
    // No userId, no categoryId - scan all (slow but complete)
    const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
    const catIds = Object.keys(categories || {}).map(Number).filter(Boolean);
    console.log(`[fetchAllTodos] WARNING: scanning ALL ${catIds.length} categories (no userId filter)`);

    const allProjectIds: number[] = [];
    for (let i = 0; i < catIds.length; i += 5) {
      const batch = catIds.slice(i, i + 5).map(async (catId) => {
        try {
          const projects = await client.request<SearchResponse>("GET", `/Api/R3/Project?CategoryId=${catId}`);
          return Object.keys(projects.Results || {}).map(Number).filter(Boolean);
        } catch { return []; }
      });
      const results = await Promise.all(batch);
      for (const ids of results) allProjectIds.push(...ids);
    }
    projectIds = allProjectIds;
    console.log(`[fetchAllTodos] Total projects: ${projectIds.length}`);
  }

  const BATCH = 10;
  const allTodos: (ToDo & { _projectId: number })[] = [];

  for (let i = 0; i < projectIds.length; i += BATCH) {
    const batch = projectIds.slice(i, i + BATCH).map(async (pid) => {
      try {
        let path = `/Api/R3/ToDoList/${pid}`;
        const statusFilter = opts.status && opts.status !== "All" ? opts.status : "Open";
        path += `?Status=${statusFilter}`;
        const data = await client.request<Record<string, ToDo>>("GET", path);
        return Object.values(data || {})
          .filter((t): t is ToDo => typeof t === "object" && t !== null && "Id" in t)
          .filter((t) => !opts.filterUserId || t.UserId === opts.filterUserId)
          .map((t) => ({ ...t, _projectId: pid }));
      } catch {
        return [];
      }
    });
    const results = await Promise.all(batch);
    for (const todos of results) allTodos.push(...todos);
  }

  return allTodos;
}

export function registerToDoTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOLS ===

  server.tool(
    "minicrm_list_all_todos",
    "Az OSSZES teendo lekerdezese egyszerre, az osszes projektbol. Nev vagy userId alapjan szurheto. MINDIG EZT hasznald ha valakinek a teendoit kerdezik! Pl. 'Mik Kovacs Janos teendoi?' → hasznald userName='Kovacs Janos'.",
    {
      userName: z.string().optional().describe("A felhasznalo neve akinek a teendoit keresed (pl. 'Kovacs Janos'). A rendszer automatikusan megkeresi az ID-jat."),
      userId: z.number().optional().describe("A felhasznalo ID-ja (ha mar tudod). Ha userName-t adsz meg, ez nem kell."),
      status: z
        .enum(["Open", "Closed", "All"])
        .optional()
        .default("Open")
        .describe("Szuro: Open (nyitott), Closed (lezart) vagy All (mind)"),
      categoryId: z.number().optional().describe("Csak ebbol a modulbol (CategoryId)."),
    },
    async ({ userName, userId, status, categoryId }) => {
      try {
        const resolvedUserId = await resolveUserId(client, userName, userId);

        const todos = await fetchAllTodos(client, {
          status,
          categoryId,
          filterUserId: resolvedUserId,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              count: todos.length,
              userName: userName || undefined,
              userId: resolvedUserId || undefined,
              todos,
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
    "Napi osszefoglalo: mai hatarideju, lejart es kovetkezo teendok. Nev vagy userId alapjan. HASZNALD EZT ha valaki a mai napjat, teendoit vagy napi osszefoglalojat kerdezi! Pl. 'Mi van mara?' → hasznald userName-mel.",
    {
      userName: z.string().optional().describe("A felhasznalo neve (pl. 'Ducsai Marcell'). A rendszer automatikusan megkeresi az ID-jat."),
      userId: z.number().optional().describe("A felhasznalo ID-ja (ha mar tudod). Ha userName-t adsz meg, ez nem kell."),
    },
    async ({ userName, userId }) => {
      try {
        const resolvedUserId = await resolveUserId(client, userName, userId);
        if (!resolvedUserId) {
          return {
            content: [{ type: "text" as const, text: userName
              ? `Nem talaltam felhasznalot '${userName}' neven. Kerdezz ra pontosabb nevre.`
              : "userId vagy userName megadasa kotelezo." }],
            isError: true,
          };
        }

        const allTodos = await fetchAllTodos(client, { filterUserId: resolvedUserId });

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];

        const today: typeof allTodos = [];
        const overdue: typeof allTodos = [];
        const upcoming: typeof allTodos = [];

        for (const todo of allTodos) {
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
              userName: userName || undefined,
              userId: resolvedUserId,
              date: todayStr,
              summary: {
                today: today.length,
                overdue: overdue.length,
                upcoming: upcoming.length,
                total: allTodos.length,
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
