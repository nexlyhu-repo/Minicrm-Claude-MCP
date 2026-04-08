import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerAddressTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_list_addresses",
    "Kontakthoz vagy ceghez tartozo cimek listazasa.",
    {
      contactId: z.number().describe("A kontakt vagy ceg ID-ja"),
    },
    async ({ contactId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/AddressList/${contactId}?Structured=1`
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
    "minicrm_get_address",
    "Egy cim reszletes adatainak lekerdezese ID alapjan.",
    { addressId: z.number().describe("A cim ID-ja") },
    async ({ addressId }) => {
      try {
        const data = await client.request("GET", `/Api/R3/Address/${addressId}`);
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
    "minicrm_create_address",
    "Uj cim letrehozasa egy kontakthoz. Kotelezo: ContactId es Name.",
    {
      contactId: z.number().describe("A kontakt vagy ceg ID-ja"),
      name: z.string().describe("A cim neve (pl. Szekhely, Szallitasi cim)"),
      type: z.string().optional().describe("Cim tipusa"),
      countryId: z.string().optional().describe("Orszag ID"),
      county: z.string().optional().describe("Megye"),
      city: z.string().optional().describe("Varos"),
      postalCode: z.string().optional().describe("Iranyitoszam"),
      address: z.string().optional().describe("Utca, hazszam"),
      isDefault: z.boolean().optional().describe("Alapertelmezett cim-e"),
    },
    async ({ contactId, name, type, countryId, county, city, postalCode, address, isDefault }) => {
      try {
        const body: Record<string, unknown> = {
          ContactId: contactId,
          Name: name,
        };
        if (type) body.Type = type;
        if (countryId) body.CountryId = countryId;
        if (county) body.County = county;
        if (city) body.City = city;
        if (postalCode) body.PostalCode = postalCode;
        if (address) body.Address = address;
        if (isDefault !== undefined) body.Default = isDefault ? 1 : 0;

        const data = await client.request("PUT", "/Api/R3/Address", body);
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
    "minicrm_update_address",
    "Cim adatainak frissitese. Csak a valtozo mezokat kell megadni. Cimek nem torolhetok API-n keresztul.",
    {
      addressId: z.number().describe("A cim ID-ja"),
      fields: z
        .record(z.unknown())
        .describe(
          "Frissitendo mezok (pl. {\"City\": \"Budapest\", \"PostalCode\": \"1011\"})"
        ),
    },
    async ({ addressId, fields }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Address/${addressId}`,
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
}
