import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerOfferTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_create_offer",
    "Uj ajanlat letrehozasa es kiallitasa. Kotelezo: CustomerId vagy ReferenceId.",
    {
      customerId: z.number().optional().describe("Ugyfel (kontakt) ID"),
      referenceId: z.string().optional().describe("Kulso referencia ID (CustomerId helyett)"),
      items: z
        .array(
          z.object({
            Name: z.string().describe("Tetel neve"),
            PriceNet: z.number().describe("Netto ar"),
            Quantity: z.number().describe("Mennyiseg"),
            Unit: z.string().optional().describe("Mertekegyseg"),
            VAT: z.string().optional().describe("AFA kulcs"),
          })
        )
        .optional()
        .describe("Ajanlat tetelei"),
      extraFields: z
        .record(z.unknown())
        .optional()
        .describe("Egyedi mezok"),
    },
    async ({ customerId, referenceId, items, extraFields }) => {
      try {
        const body: Record<string, unknown> = {};
        if (customerId) body.CustomerId = customerId;
        if (referenceId) body.ReferenceId = referenceId;
        if (items) body.Items = items;
        if (extraFields) Object.assign(body, extraFields);

        const data = await client.request("POST", "/Api/Offer", body);
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
    "minicrm_get_offer",
    "Ajanlat reszletes adatainak lekerdezese ID alapjan.",
    { offerId: z.number().describe("Az ajanlat ID-ja") },
    async ({ offerId }) => {
      try {
        const data = await client.request("GET", `/Api/Offer/${offerId}`);
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
    "minicrm_list_offers",
    "Ajanlatok listazasa. Oldalankent 100 eredmeny.",
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

        const data = await client.search("/Api/Offer/List", params);
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
    "minicrm_update_offer",
    "Ajanlat adatlapjanak frissitese (egyedi mezok). A StatusId szabadon valtoztathato.",
    {
      offerId: z.number().describe("Az ajanlat ID-ja"),
      fields: z
        .record(z.unknown())
        .describe("Frissitendo mezok kulcs-ertek parjai"),
    },
    async ({ offerId, fields }) => {
      try {
        const data = await client.request(
          "POST",
          `/Api/Offer/${offerId}/Project`,
          fields
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
