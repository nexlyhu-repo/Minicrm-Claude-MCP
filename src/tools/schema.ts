import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerSchemaTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_list_categories",
    "Modulok (kategoriak) listazasa. Visszaadja az osszes modult az ID-jukkal (pl. Ertekesites, Helpdesk, Projektek).",
    {},
    async () => {
      try {
        const data = await client.request<Record<string, string>>(
          "GET",
          "/Api/R3/Category"
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
    "minicrm_get_person_schema",
    "Szemely (kontakt) mezok lekerdezese: mezonevek, tipusok es legordulo opcio ertekek.",
    {},
    async () => {
      try {
        const data = await client.request("GET", "/Api/R3/Schema/Person");
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
    "minicrm_get_business_schema",
    "Ceg (Business) mezok lekerdezese: mezonevek, tipusok es legordulo opcio ertekek.",
    {},
    async () => {
      try {
        const data = await client.request("GET", "/Api/R3/Schema/Business");
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
    "minicrm_get_project_schema",
    "Projekt (adatlap) mezok lekerdezese egy adott modulhoz: mezonevek, tipusok, statuszok es legordulo opcio ertekek.",
    { categoryId: z.number().describe("A modul (kategoria) ID-ja") },
    async ({ categoryId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/Schema/Project/${categoryId}`
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
