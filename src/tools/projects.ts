import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerProjectTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOLS ===

  server.tool(
    "minicrm_search_projects_detailed",
    "Projektek keresese RESZLETES adatokkal. A sima search csak ID-kat ad, ez viszont egybol visszaadja minden talalat teljes adatait (mezok, statusz, kontakt). HASZNALD EZT a minicrm_search_projects HELYETT!",
    {
      categoryId: z.number().optional().describe("Modul (kategoria) ID"),
      statusId: z.number().optional().describe("Statusz ID"),
      statusGroup: z.enum(["Lead", "Open", "Success", "Failed"]).optional().describe("Statusz csoport"),
      userId: z.number().optional().describe("Felelos felhasznalo ID-ja"),
      query: z.string().optional().describe("Szabad szoveges kereses"),
      mainContactId: z.number().optional().describe("Ceg ID"),
      extraFilters: z.record(z.string()).optional().describe("Egyedi mezo szurok"),
    },
    async ({ categoryId, statusId, statusGroup, userId, query, mainContactId, extraFilters }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (categoryId) params.CategoryId = categoryId;
        if (statusId) params.StatusId = statusId;
        if (statusGroup) params.StatusGroup = statusGroup;
        if (userId) params.UserId = userId;
        if (query) params.Query = query;
        if (mainContactId) params.MainContactId = mainContactId;
        if (extraFilters) for (const [k, v] of Object.entries(extraFilters)) params[k] = v;

        const searchResult = await client.search("/Api/R3/Project", params, true);
        const ids = Object.keys(searchResult.Results || {}).map(Number).filter(Boolean);

        if (ids.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ count: 0, projects: [] }) }] };
        }

        const fetchIds = ids.slice(0, 50);
        const details = await client.fetchMany("/Api/R3/Project", fetchIds);
        const projects = fetchIds.map(id => details.get(id)).filter(Boolean);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              count: searchResult.Count,
              returned: projects.length,
              truncated: ids.length > 50,
              projects,
            }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  server.tool(
    "minicrm_get_project_full",
    "Projekt TELJES adatai: minden mezo + kontakt adatok + teendok + statusz tortenelem. Egyetlen hivassal kapod meg amit egyebkent 3-4 tool call lenne!",
    { projectId: z.number().describe("A projekt (adatlap) ID-ja") },
    async ({ projectId }) => {
      try {
        // All 3 requests in parallel
        const [project, todos, history] = await Promise.all([
          client.request("GET", `/Api/R3/Project/${projectId}`),
          client.request<Record<string, unknown>>("GET", `/Api/R3/ToDoList/${projectId}`).catch(() => ({})),
          client.request("GET", `/Api/R3/ProjectHistory/${projectId}?Type=StatusHistory`).catch(() => ({})),
        ]);

        // Fetch contact details if available
        const proj = project as Record<string, unknown>;
        let contact = null;
        if (proj.ContactId) {
          try {
            contact = await client.request("GET", `/Api/R3/Contact/${proj.ContactId}`);
          } catch { /* skip */ }
        }

        const todoList = Object.values(todos || {}).filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null && "Id" in t);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              project: proj,
              contact,
              todos: todoList,
              statusHistory: history,
            }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // === EXISTING TOOLS ===

  server.tool(
    "minicrm_search_projects",
    "Projektek (adatlapok) keresese es szurese. Szurheto modul, statusz, statusz csoport, felhasznalo, kulcsszo vagy egyedi mezo alapjan. Oldalankent 100 eredmeny.",
    {
      categoryId: z.number().optional().describe("Modul (kategoria) ID"),
      statusId: z.number().optional().describe("Statusz ID"),
      statusGroup: z
        .enum(["Lead", "Open", "Success", "Failed"])
        .optional()
        .describe("Statusz csoport: Lead, Open, Success vagy Failed"),
      userId: z.number().optional().describe("Felelos felhasznalo ID-ja"),
      query: z.string().optional().describe("Szabad szoveges kereses"),
      updatedSince: z
        .string()
        .optional()
        .describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      mainContactId: z.number().optional().describe("Ceg ID - a ceghez tartozo adatlapok"),
      referenceId: z.string().optional().describe("Kulso referencia ID"),
      deleted: z.boolean().optional().describe("Torolt adatlapok listazasa"),
      page: z.number().optional().default(0).describe("Oldal szama (0-tol indul)"),
      fetchAll: z
        .boolean()
        .optional()
        .default(false)
        .describe("Osszes oldal lekerdezese egyszerre"),
      extraFilters: z
        .record(z.string())
        .optional()
        .describe("Egyedi mezo szurok kulcs-ertek parjai"),
    },
    async ({
      categoryId,
      statusId,
      statusGroup,
      userId,
      query,
      updatedSince,
      mainContactId,
      referenceId,
      deleted,
      page,
      fetchAll,
      extraFilters,
    }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (categoryId) params.CategoryId = categoryId;
        if (statusId) params.StatusId = statusId;
        if (statusGroup) params.StatusGroup = statusGroup;
        if (userId) params.UserId = userId;
        if (query) params.Query = query;
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (mainContactId) params.MainContactId = mainContactId;
        if (referenceId) params.ReferenceId = referenceId;
        if (deleted) params.Deleted = 1;
        if (page && page > 0) params.Page = page;
        if (extraFilters) {
          for (const [k, v] of Object.entries(extraFilters)) {
            params[k] = v;
          }
        }

        const data = await client.search("/Api/R3/Project", params, fetchAll);
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
    "minicrm_get_project",
    "Egy projekt (adatlap) reszletes adatainak lekerdezese ID alapjan. Tartalmazza az osszes mezot, statuszt es kontakt adatokat.",
    { projectId: z.number().describe("A projekt (adatlap) ID-ja") },
    async ({ projectId }) => {
      try {
        const data = await client.request("GET", `/Api/R3/Project/${projectId}`);
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
    "minicrm_create_project",
    "Uj projekt (adatlap) letrehozasa. Kotelezo mezok: CategoryId, ContactId, StatusId, UserId, Name.",
    {
      categoryId: z.number().describe("Modul (kategoria) ID"),
      contactId: z.number().describe("Elsodleges kontakt ID"),
      statusId: z.number().describe("Kezdo statusz ID (lasd: minicrm_get_project_schema)"),
      userId: z.number().describe("Felelos felhasznalo ID"),
      name: z.string().describe("Az adatlap neve"),
      extraFields: z
        .record(z.unknown())
        .optional()
        .describe("Egyedi mezok kulcs-ertek parjai"),
    },
    async ({ categoryId, contactId, statusId, userId, name, extraFields }) => {
      try {
        const body: Record<string, unknown> = {
          CategoryId: categoryId,
          ContactId: contactId,
          StatusId: statusId,
          UserId: userId,
          Name: name,
        };
        if (extraFields) Object.assign(body, extraFields);

        const data = await client.request("PUT", "/Api/R3/Project", body);
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
    "minicrm_update_project",
    "Projekt (adatlap) mezoinek frissitese. Csak a valtozo mezokat kell megadni. Legordulo mezok szoveges erteket es numerikus ID-t is elfogadnak. Fajl feltoltes: mezo erteke legyen egy publikus URL.",
    {
      projectId: z.number().describe("A projekt (adatlap) ID-ja"),
      fields: z
        .record(z.unknown())
        .describe(
          "Frissitendo mezok kulcs-ertek parjai (pl. {\"StatusId\": 2541, \"Name\": \"Uj nev\"})"
        ),
    },
    async ({ projectId, fields }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Project/${projectId}`,
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
    "minicrm_delete_project",
    "Projekt (adatlap) torlese (soft delete). Az adatlap a kukaba kerul, visszaallithato a minicrm_restore_project eszkozzel.",
    { projectId: z.number().describe("A torlendo projekt (adatlap) ID-ja") },
    async ({ projectId }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Project/${projectId}`,
          { Deleted: 1 }
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
    "minicrm_restore_project",
    "Torolt projekt (adatlap) visszaallitasa a kukabol.",
    { projectId: z.number().describe("A visszaallitando projekt (adatlap) ID-ja") },
    async ({ projectId }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Project/${projectId}`,
          { Deleted: 0 }
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
    "minicrm_get_project_history",
    "Projekt (adatlap) statuszvaltozasi elozmenyeinek lekerdezese. Megmutatja ki, mikor es milyen statuszra valtoztatta az adatlapot.",
    { projectId: z.number().describe("A projekt (adatlap) ID-ja") },
    async ({ projectId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/ProjectHistory/${projectId}?Type=StatusHistory`
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
