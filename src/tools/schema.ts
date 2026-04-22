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
    "minicrm_list_users",
    "CRM felhasznalok (munkatarsak) listazasa: ID es nev. HASZNALD EZT ha tudni akarod ki kicsoda a CRM-ben, vagy ha userId-t kell megtalalnod nevbol. Ez a lista szukseges a teendo/projekt szureshez.",
    {},
    async () => {
      try {
        // Get users from the first available category schema's UserId field
        const categories = await client.request<Record<string, string>>("GET", "/Api/R3/Category");
        const catIds = Object.keys(categories || {}).map(Number).filter(Boolean);

        const users: Record<string, string> = {};
        for (const catId of catIds.slice(0, 5)) {
          try {
            const schema = await client.request<Record<string, unknown>>("GET", `/Api/R3/Schema/Project/${catId}`);
            const userField = schema?.UserId;
            if (userField && typeof userField === 'object') {
              // MiniCRM stores users directly as { "165405": "Ducsai Marcell", ... }
              for (const [id, name] of Object.entries(userField as Record<string, unknown>)) {
                if (typeof name === 'string' && parseInt(id, 10)) {
                  users[id] = name;
                }
              }
            }
            if (Object.keys(users).length > 0) break;
          } catch { continue; }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: Object.keys(users).length, users }, null, 2),
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
