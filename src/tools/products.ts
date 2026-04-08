import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerProductTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_create_product",
    "Uj termek letrehozasa a keszletben. Ha a megadott SKU mar letezik, a meglevo termek frissul.",
    {
      name: z.string().describe("Termek neve"),
      sku: z.string().optional().describe("Cikkszam (SKU) - ha mar letezik, frissites tortenik"),
      ean: z.string().optional().describe("EAN vonalkod"),
      folderName: z.string().optional().describe("Mappa neve"),
      vat: z.string().optional().describe("AFA kulcs (pl. '27%')"),
      priceNet: z.number().optional().describe("Netto ar"),
      currencyCode: z.string().optional().describe("Penznem kod (pl. HUF)"),
      unitName: z.string().optional().describe("Mertekegyseg neve"),
      quantity: z.number().optional().describe("Keszlet mennyiseg"),
      warehouseName: z.string().optional().describe("Raktar neve"),
      description: z.string().optional().describe("Termek leirasa"),
    },
    async ({ name, sku, ean, folderName, vat, priceNet, currencyCode, unitName, quantity, warehouseName, description }) => {
      try {
        const body: Record<string, unknown> = { Name: name };
        if (sku) body.SKU = sku;
        if (ean) body.EAN = ean;
        if (folderName) body.FolderName = folderName;
        if (vat) body.VAT = vat;
        if (priceNet !== undefined) body.PriceNet = priceNet;
        if (currencyCode) body.CurrencyCode = currencyCode;
        if (unitName) body.UnitName = unitName;
        if (quantity !== undefined) body.Quantity = quantity;
        if (warehouseName) body.Warehouse_Name = warehouseName;
        if (description) body.Description = description;

        const data = await client.request("PUT", "/Api/R3/Product", body);
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
    "minicrm_update_product",
    "Termek adatainak frissitese. Csak a valtozo mezokat kell megadni.",
    {
      productId: z.number().describe("A termek ID-ja"),
      fields: z
        .record(z.unknown())
        .describe("Frissitendo mezok (pl. {\"PriceNet\": 5000, \"Quantity\": 100})"),
    },
    async ({ productId, fields }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Product/${productId}`,
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

  server.tool(
    "minicrm_delete_product",
    "Termek torlese a keszletbol (soft delete).",
    { productId: z.number().describe("A torlendo termek ID-ja") },
    async ({ productId }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Product/${productId}`,
          { Deleted: 1 }
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
