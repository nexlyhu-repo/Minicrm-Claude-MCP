import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerInvoiceTools(server: McpServer, client: MiniCrmClient) {

  // === AGGREGATING TOOL ===

  server.tool(
    "minicrm_list_invoices_detailed",
    "Szamlak listazasa RESZLETES adatokkal (tetelekkel, osszegekkel). A sima list_invoices csak ID-kat ad, ez viszont egybol visszaadja a teljes szamla adatokat. HASZNALD EZT a minicrm_list_invoices HELYETT!",
    {
      updatedSince: z.string().optional().describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      statusGroup: z.string().optional().describe("Statusz csoport szuro"),
    },
    async ({ updatedSince, statusGroup }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (statusGroup) params.StatusGroup = statusGroup;

        const searchResult = await client.search("/Api/Invoice/List", params, true);
        const ids = Object.keys(searchResult.Results || {}).map(Number).filter(Boolean);

        if (ids.length === 0) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ count: 0, invoices: [] }) }] };
        }

        const fetchIds = ids.slice(0, 50);
        const details = await client.fetchMany("/Api/Invoice", fetchIds);
        const invoices = fetchIds.map(id => details.get(id)).filter(Boolean);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: searchResult.Count, returned: invoices.length, truncated: ids.length > 50, invoices }, null, 2),
          }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: `Hiba: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    }
  );

  // === EXISTING TOOLS ===

  server.tool(
    "minicrm_create_invoice",
    "Uj szamla vagy dijbekero letrehozasa es kiallitasa. Kotelezo: CustomerId vagy ReferenceId. A szamlazasi endpoint-ra nincs sebessegkorlat.",
    {
      customerId: z.number().optional().describe("Ugyfel (kontakt) ID"),
      referenceId: z.string().optional().describe("Kulso referencia ID (CustomerId helyett)"),
      type: z
        .enum(["Invoice", "Proforma"])
        .optional()
        .default("Invoice")
        .describe("Szamla tipusa: Invoice (szamla) vagy Proforma (dijbekero)"),
      items: z
        .array(
          z.object({
            Name: z.string().describe("Tetel neve"),
            PriceNet: z.number().describe("Netto ar"),
            Quantity: z.number().describe("Mennyiseg"),
            Unit: z.string().optional().describe("Mertekegyseg"),
            VAT: z.string().optional().describe("AFA kulcs (pl. '27%')"),
          })
        )
        .optional()
        .describe("Szamla tetelei"),
      extraFields: z
        .record(z.unknown())
        .optional()
        .describe("Egyedi mezok"),
    },
    async ({ customerId, referenceId, type, items, extraFields }) => {
      try {
        const body: Record<string, unknown> = {};
        if (customerId) body.CustomerId = customerId;
        if (referenceId) body.ReferenceId = referenceId;
        if (type) body.Type = type;
        if (items) body.Items = items;
        if (extraFields) Object.assign(body, extraFields);

        const data = await client.request("POST", "/Api/Invoice", body);
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
    "minicrm_get_invoice",
    "Szamla reszletes adatainak lekerdezese ID alapjan.",
    { invoiceId: z.number().describe("A szamla ID-ja") },
    async ({ invoiceId }) => {
      try {
        const data = await client.request("GET", `/Api/Invoice/${invoiceId}`);
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
    "minicrm_list_invoices",
    "Szamlak listazasa. Oldalankent 100 eredmeny. Nincs sebessegkorlat.",
    {
      page: z.number().optional().default(0).describe("Oldal szama (0-tol indul)"),
      updatedSince: z
        .string()
        .optional()
        .describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      statusGroup: z
        .string()
        .optional()
        .describe("Statusz csoport szuro"),
    },
    async ({ page, updatedSince, statusGroup }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (page && page > 0) params.Page = page;
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (statusGroup) params.StatusGroup = statusGroup;

        const data = await client.search("/Api/Invoice/List", params);
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
    "minicrm_pay_invoice",
    "Szamla fizetettre allitasa. Dijbekero eseten automatikusan generalodik a vegleges szamla.",
    {
      invoiceId: z.number().describe("A szamla ID-ja"),
      paymentDate: z
        .string()
        .optional()
        .describe("Fizetes datuma (formatum: yyyy-mm-dd)"),
    },
    async ({ invoiceId, paymentDate }) => {
      try {
        const body: Record<string, unknown> = {};
        if (paymentDate) body.PaymentDate = paymentDate;

        const data = await client.request(
          "POST",
          `/Api/Invoice/${invoiceId}/Paid`,
          body
        );
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
    "minicrm_storno_invoice",
    "Szamla sztornozasa. Automatikusan generalodik a sztorno bizonylat.",
    {
      invoiceId: z.number().describe("A sztornozando szamla ID-ja"),
    },
    async ({ invoiceId }) => {
      try {
        const data = await client.request(
          "POST",
          `/Api/Invoice/${invoiceId}/Storno`,
          {}
        );
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
