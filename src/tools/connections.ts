import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerConnectionTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_create_connection",
    "Kapcsolat letrehozasa ket projekt (adatlap) kozott.",
    {
      fromProjectId: z.number().describe("Forras projekt (adatlap) ID"),
      toProjectId: z.number().describe("Cel projekt (adatlap) ID"),
    },
    async ({ fromProjectId, toProjectId }) => {
      try {
        const data = await client.request(
          "PUT",
          "/Api/R3/CreateProjectConnection",
          { FromProjectId: fromProjectId, ToProjectId: toProjectId }
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
    "minicrm_list_connections",
    "Projekthez (adatlaphoz) tartozo kapcsolatok listazasa.",
    {
      fromProjectId: z.number().describe("A projekt (adatlap) ID-ja"),
    },
    async ({ fromProjectId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/ListProjectConnection?FromProjectId=${fromProjectId}`
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
    "minicrm_update_connection",
    "Ket projekt kozotti kapcsolat leirasanak frissitese.",
    {
      fromProjectId: z.number().describe("Forras projekt (adatlap) ID"),
      toProjectId: z.number().describe("Cel projekt (adatlap) ID"),
      description: z.string().describe("A kapcsolat leirasa"),
    },
    async ({ fromProjectId, toProjectId, description }) => {
      try {
        const data = await client.request(
          "PUT",
          "/Api/R3/UpdateProjectConnection",
          {
            FromProjectId: fromProjectId,
            ToProjectId: toProjectId,
            Description: description,
          }
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
    "minicrm_delete_connection",
    "Ket projekt kozotti kapcsolat torlese.",
    {
      fromProjectId: z.number().describe("Forras projekt (adatlap) ID"),
      toProjectId: z.number().describe("Cel projekt (adatlap) ID"),
    },
    async ({ fromProjectId, toProjectId }) => {
      try {
        const data = await client.request(
          "PUT",
          "/Api/R3/DeleteProjectConnection",
          { FromProjectId: fromProjectId, ToProjectId: toProjectId }
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
