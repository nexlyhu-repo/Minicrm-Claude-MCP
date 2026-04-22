import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerOrderTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOL ===

  server.tool(
    "minicrm_list_orders_detailed",
    "Megrendelesek listazasa RESZLETES adatokkal (tetelekkel, osszegekkel, statuszokkal). A sima list_orders csak ID-kat ad, ez viszont egybol visszaadja a teljes megrendeles adatokat. HASZNALD EZT a minicrm_list_orders HELYETT!",
    {
      updatedSince: z.string().optional().describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      statusGroup: z.enum(["Draft", "InProgress", "Completed", "Successful", "Failed"]).optional().describe("Statusz csoport szuro"),
    },
    async ({ updatedSince, statusGroup }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (statusGroup) params.StatusGroup = statusGroup;

        const searchResult = await client.search("/Api/Order/List", params, true);
        const ids = Object.keys(searchResult.Results || {}).map(Number).filter(Boolean);

        if (ids.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ count: 0, orders: [] }) }] };
        }

        const fetchIds = ids.slice(0, 50);
        const details = await client.fetchMany("/Api/Order", fetchIds);
        const orders = fetchIds.map(id => details.get(id)).filter(Boolean);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: searchResult.Count, returned: orders.length, truncated: ids.length > 50, orders }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // === EXISTING TOOLS ===

  server.tool(
    "minicrm_create_order",
    "Uj megrendeles letrehozasa. Kotelezo: CustomerId vagy ReferenceId, CurrencyCode es Items.",
    {
      customerId: z.number().optional().describe("Ugyfel (kontakt) ID"),
      referenceId: z.string().optional().describe("Kulso referencia ID (CustomerId helyett)"),
      currencyCode: z.string().describe("Penznem kod (pl. HUF, EUR, USD)"),
      items: z
        .array(
          z.object({
            Name: z.string().describe("Termek neve"),
            SKU: z.string().optional().describe("Cikkszam"),
            PriceNet: z.number().describe("Netto ar"),
            Quantity: z.number().describe("Mennyiseg"),
            Unit: z.string().optional().describe("Mertekegyseg"),
            VAT: z.string().optional().describe("AFA kulcs (pl. '27%')"),
          })
        )
        .describe("Megrendeles tetelei"),
      extraFields: z
        .record(z.unknown())
        .optional()
        .describe("Egyedi mezok"),
    },
    async ({ customerId, referenceId, currencyCode, items, extraFields }) => {
      try {
        const body: Record<string, unknown> = {
          CurrencyCode: currencyCode,
          Items: items,
        };
        if (customerId) body.CustomerId = customerId;
        if (referenceId) body.ReferenceId = referenceId;
        if (extraFields) Object.assign(body, extraFields);

        const data = await client.request("POST", "/Api/Order", body);
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

  server.tool(
    "minicrm_get_order",
    "Megrendeles reszletes adatainak lekerdezese ID alapjan.",
    { orderId: z.number().describe("A megrendeles ID-ja") },
    async ({ orderId }) => {
      try {
        const data = await client.request("GET", `/Api/Order/${orderId}`);
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

  server.tool(
    "minicrm_list_orders",
    "Megrendelesek listazasa. Oldalankent 100 eredmeny.",
    {
      page: z.number().optional().default(0).describe("Oldal szama (0-tol indul)"),
      updatedSince: z
        .string()
        .optional()
        .describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      statusGroup: z
        .enum(["Draft", "InProgress", "Completed", "Successful", "Failed"])
        .optional()
        .describe("Statusz csoport szuro"),
    },
    async ({ page, updatedSince, statusGroup }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (page && page > 0) params.Page = page;
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (statusGroup) params.StatusGroup = statusGroup;

        const data = await client.search("/Api/Order/List", params);
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

  server.tool(
    "minicrm_update_order",
    "Megrendeles frissitese (csak Piszkozat/Draft statuszban). Kotelezo: CustomerId vagy ReferenceId.",
    {
      orderId: z.number().describe("A megrendeles ID-ja"),
      customerId: z.number().optional().describe("Ugyfel ID"),
      referenceId: z.string().optional().describe("Kulso referencia ID"),
      fields: z
        .record(z.unknown())
        .optional()
        .describe("Frissitendo mezok"),
    },
    async ({ orderId, customerId, referenceId, fields }) => {
      try {
        const body: Record<string, unknown> = {};
        if (customerId) body.CustomerId = customerId;
        if (referenceId) body.ReferenceId = referenceId;
        if (fields) Object.assign(body, fields);

        const data = await client.request("POST", `/Api/Order/${orderId}`, body);
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

  server.tool(
    "minicrm_finalize_order",
    "Megrendeles veglegesitese: Piszkozat → Folyamatban (Draft → In Progress).",
    { orderId: z.number().describe("A megrendeles ID-ja") },
    async ({ orderId }) => {
      try {
        const data = await client.request("GET", `/Api/Order/${orderId}/Finalize`);
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

  server.tool(
    "minicrm_complete_order",
    "Megrendeles befejezese: Folyamatban → Befejezett (In Progress → Completed).",
    { orderId: z.number().describe("A megrendeles ID-ja") },
    async ({ orderId }) => {
      try {
        const data = await client.request("GET", `/Api/Order/${orderId}/Complete`);
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

  server.tool(
    "minicrm_pay_order",
    "Megrendeles fizetettre allitasa: Befejezett/Sikertelen → Sikeres (Completed/Failed → Successful).",
    { orderId: z.number().describe("A megrendeles ID-ja") },
    async ({ orderId }) => {
      try {
        const data = await client.request("GET", `/Api/Order/${orderId}/Paid`);
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

  server.tool(
    "minicrm_storno_order",
    "Megrendeles sztornozasa: Befejezett/Sikeres → Sikertelen (Completed/Successful → Failed).",
    { orderId: z.number().describe("A megrendeles ID-ja") },
    async ({ orderId }) => {
      try {
        const data = await client.request("GET", `/Api/Order/${orderId}/Storno`);
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
