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

export function registerToDoTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOLS ===

  server.tool(
    "minicrm_list_all_todos",
    "Az osszes teendo lekerdezese az osszes projektbol egyszerre. Szurheto felhasznalo (userId) es statusz alapjan. HASZNALD EZT a minicrm_list_todos HELYETT, ha tobb projekt teendoire vagy kivancsi!",
    {
      userId: z.number().optional().describe("Csak ennek a felhasznalonak a teendoi (UserId). Ha nincs megadva, az osszes felhasznalo teendoi jonnek."),
      status: z
        .enum(["Open", "Closed", "All"])
        .optional()
        .default("Open")
        .describe("Szuro: Open (nyitott), Closed (lezart) vagy All (mind)"),
      categoryId: z.number().optional().describe("Csak ebbol a modulbol (CategoryId). Ha nincs megadva, az osszes modulbol."),
    },
    async ({ userId, status, categoryId }) => {
      try {
        // 1. Get all projects (or filtered by category)
        const searchPath = categoryId
          ? `/Api/R3/Project?CategoryId=${categoryId}`
          : `/Api/R3/Project`;
        const projects = await client.search(searchPath, {}, true);
        const projectIds = Object.keys(projects.Results || {}).map(Number).filter(Boolean);

        if (projectIds.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ count: 0, todos: [] }) }] };
        }

        // 2. Fetch todos for all projects in parallel (batches of 10)
        const BATCH = 10;
        const allTodos: (ToDo & { _projectId: number })[] = [];

        for (let i = 0; i < projectIds.length; i += BATCH) {
          const batch = projectIds.slice(i, i + BATCH).map(async (pid) => {
            try {
              let path = `/Api/R3/ToDoList/${pid}`;
              if (status && status !== "All") path += `?Status=${status}`;
              const data = await client.request<Record<string, ToDo>>("GET", path);
              return Object.values(data || {})
                .filter((t): t is ToDo => typeof t === "object" && t !== null && "Id" in t)
                .map((t) => ({ ...t, _projectId: pid }));
            } catch {
              return [];
            }
          });
          const results = await Promise.all(batch);
          for (const todos of results) allTodos.push(...todos);
        }

        // 3. Filter by userId if specified
        const filtered = userId
          ? allTodos.filter((t) => t.UserId === userId)
          : allTodos;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              count: filtered.length,
              projectsScanned: projectIds.length,
              todos: filtered,
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

  server.tool(
    "minicrm_my_day",
    "Mai nap teendoi: mai hatarideju, lejartak (overdue) es elnapolt teendok egy felhasznalohoz. Egy hivassal megkapod a teljes napi osszefoglalot!",
    {
      userId: z.number().describe("A felhasznalo ID-ja (UserId) akinek a napjat latni akarod"),
    },
    async ({ userId }) => {
      try {
        // Reuse the list_all_todos logic
        const projects = await client.search("/Api/R3/Project", {}, true);
        const projectIds = Object.keys(projects.Results || {}).map(Number).filter(Boolean);

        const BATCH = 10;
        const allTodos: (ToDo & { _projectId: number })[] = [];

        for (let i = 0; i < projectIds.length; i += BATCH) {
          const batch = projectIds.slice(i, i + BATCH).map(async (pid) => {
            try {
              const data = await client.request<Record<string, ToDo>>("GET", `/Api/R3/ToDoList/${pid}?Status=Open`);
              return Object.values(data || {})
                .filter((t): t is ToDo => typeof t === "object" && t !== null && "Id" in t && t.UserId === userId)
                .map((t) => ({ ...t, _projectId: pid }));
            } catch {
              return [];
            }
          });
          const results = await Promise.all(batch);
          for (const todos of results) allTodos.push(...todos);
        }

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
