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

// Helper: fetch all todos from all projects in parallel
async function fetchAllTodos(
  client: MiniCrmClient,
  opts: { status?: string; categoryId?: number; filterUserId?: number }
): Promise<(ToDo & { _projectId: number })[]> {
  let projectIds: number[] = [];

  // Get all categories, then fetch projects per category
  // Note: we DON'T filter projects by UserId because todos can be assigned
  // to a user on ANY project, not just ones they're responsible for.
  // Instead, we filter at the todo level.
  const categories = await client.request<Record<string, unknown>>("GET", "/Api/R3/Category");
  const catIds = opts.categoryId
    ? [opts.categoryId]
    : Object.keys(categories || {}).map(Number).filter(Boolean);

  console.log(`[fetchAllTodos] Scanning ${catIds.length} categories`);

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
  // Cap at 300 projects to avoid timeout (rate limit: 60/min)
  const MAX_PROJECTS = 300;
  projectIds = allProjectIds.slice(0, MAX_PROJECTS);
  const truncated = allProjectIds.length > MAX_PROJECTS;
  console.log(`[fetchAllTodos] Scanning ${projectIds.length}/${allProjectIds.length} projects${truncated ? ' (TRUNCATED)' : ''}`);

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
    "Az OSSZES teendo lekerdezese egyszerre, az osszes projektbol. FONTOS: Ha a felhasznalo nevet mond, ELOSZOR hivd meg a minicrm_list_users toolt hogy megtudd a userId-jat, es UTANA hivd ezt a toolt a userId-val! Nev nelkul is hivhato (az osszes felhasznalo teendoi).",
    {
      userId: z.number().optional().describe("A felhasznalo ID-ja. ELOSZOR hivd meg a minicrm_list_users toolt hogy megtudd az ID-t nevbol!"),
      status: z
        .enum(["Open", "Closed", "All"])
        .optional()
        .default("Open")
        .describe("Szuro: Open (nyitott), Closed (lezart) vagy All (mind)"),
      categoryId: z.number().optional().describe("Csak ebbol a modulbol (CategoryId)."),
    },
    async ({ userId, status, categoryId }) => {
      try {
        const todos = await fetchAllTodos(client, {
          status,
          categoryId,
          filterUserId: userId,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              count: todos.length,
              userId: userId || undefined,
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
    "Napi osszefoglalo: mai hatarideju, lejart es kovetkezo teendok. FONTOS: Ha a felhasznalo nevet mond, ELOSZOR hivd meg a minicrm_list_users toolt hogy megtudd a userId-jat! Pl. 'Mi van mara?' → eloszor list_users, utana my_day a userId-val.",
    {
      userId: z.number().describe("A felhasznalo ID-ja. ELOSZOR hivd meg a minicrm_list_users toolt hogy megtudd az ID-t nevbol!"),
    },
    async ({ userId }) => {
      try {
        const allTodos = await fetchAllTodos(client, { filterUserId: userId });

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
              userId,
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
