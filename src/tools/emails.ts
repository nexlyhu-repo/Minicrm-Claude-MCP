import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerEmailTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_list_emails",
    "Projekthez (adatlaphoz) tartozo emailek listazasa. Opcionalis datum szurovel.",
    {
      projectId: z.number().describe("A projekt (adatlap) ID-ja"),
      createdAt: z
        .string()
        .optional()
        .describe("Szures letrehozasi datum alapjan (formatum: yyyy-mm-dd)"),
    },
    async ({ projectId, createdAt }) => {
      try {
        let path = `/Api/R3/EmailList/${projectId}`;
        if (createdAt) {
          path += `?CreatedAt=${encodeURIComponent(createdAt)}`;
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
}
