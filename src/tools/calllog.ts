import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerCallLogTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_submit_call_log",
    "Hivasnaplo bejegyzesek kuldese a VOIP integracion keresztul. Kulon VOIP API kulcs szukseges (MINICRM_VOIP_API_KEY kornyezeti valtozo).",
    {
      userExtension: z
        .string()
        .describe("A felhasznalo mellekszama / azonositoja a VOIP rendszerben"),
      calls: z
        .array(
          z.object({
            Number: z.string().describe("Telefonszam"),
            Duration: z.number().describe("Hivas idotartama masodpercben"),
            CallType: z
              .number()
              .describe("Hivas tipusa: 0 = Kimeno, 1 = Bejovo, 2 = Nem fogadott"),
            Date: z
              .string()
              .describe("Hivas idopontja UTC-ben (formatum: yyyy-mm-dd hh:mm:ss)"),
            ReferenceId: z
              .string()
              .optional()
              .describe("A hivas egyedi azonositoja a VOIP rendszerben"),
          })
        )
        .describe("Hivasnaplo bejegyzesek"),
    },
    async ({ userExtension, calls }) => {
      try {
        const voipKey = client.voipApiKey;
        if (!voipKey) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Hiba: MINICRM_VOIP_API_KEY kornyezeti valtozo nincs beallitva. A hivasnaplo funkciohoz kulon VOIP API kulcs szukseges.",
              },
            ],
            isError: true,
          };
        }

        const body = {
          ApiKey: voipKey,
          UserExtension: userExtension,
          Data: calls,
        };

        const data = await client.request("POST", "/Api/CallLog", body);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` },
          ],
          isError: true,
        };
      }
    }
  );
}
