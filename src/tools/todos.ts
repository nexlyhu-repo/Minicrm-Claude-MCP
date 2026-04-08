import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerToDoTools(server: McpServer, client: MiniCrmClient) {
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
