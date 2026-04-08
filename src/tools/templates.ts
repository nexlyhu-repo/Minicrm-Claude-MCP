import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerTemplateTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_list_templates",
    "Sablonok listazasa egy modulhoz. Tipusok: Email, Todo, Sms, File.",
    {
      categoryId: z.number().describe("A modul (kategoria) ID-ja"),
    },
    async ({ categoryId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/TemplateList/${categoryId}`
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
    "minicrm_get_template",
    "Egy sablon reszletes adatainak lekerdezese: nev, targy, tartalom.",
    { templateId: z.number().describe("A sablon ID-ja") },
    async ({ templateId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/Template/${templateId}`
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
