import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MiniCrmClient } from "../client.js";

export function registerContactTools(server: McpServer, client: MiniCrmClient) {
  server.tool(
    "minicrm_search_contacts",
    "Kontaktok (szemelyek es cegek) keresese. Kereses nev, email, telefon, kulcsszo vagy egyedi mezo alapjan. Oldalankent 100 eredmeny.",
    {
      email: z.string().optional().describe("Email cim alapjan kereses"),
      phone: z.string().optional().describe("Telefonszam alapjan kereses (a vegerol egyeztet)"),
      name: z.string().optional().describe("Nev alapjan kereses (reszleges egyezes)"),
      query: z.string().optional().describe("Szabad szoveges kereses minden szoveges mezoben"),
      updatedSince: z
        .string()
        .optional()
        .describe("Modositasi datum szuro (formatum: yyyy-mm-dd hh:mm:ss)"),
      mainContactId: z
        .number()
        .optional()
        .describe("Ceg ID - az adott ceghez tartozo kontaktok listazasa"),
      page: z.number().optional().default(0).describe("Oldal szama (0-tol indul)"),
      fetchAll: z
        .boolean()
        .optional()
        .default(false)
        .describe("Osszes oldal lekerdezese egyszerre"),
    },
    async ({ email, phone, name, query, updatedSince, mainContactId, page, fetchAll }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (email) params.Email = email;
        if (phone) params.Phone = phone;
        if (name) params.Name = name;
        if (query) params.Query = query;
        if (updatedSince) params.UpdatedSince = updatedSince;
        if (mainContactId) params.MainContactId = mainContactId;
        if (page && page > 0) params.Page = page;

        const data = await client.search("/Api/R3/Contact", params, fetchAll);
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
    "minicrm_get_contact",
    "Egy kontakt (szemely vagy ceg) reszletes adatainak lekerdezese ID alapjan.",
    { contactId: z.number().describe("A kontakt ID-ja") },
    async ({ contactId }) => {
      try {
        const data = await client.request("GET", `/Api/R3/Contact/${contactId}`);
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
    "minicrm_create_contact",
    "Uj kontakt (szemely vagy ceg) letrehozasa. Szemely eseten FirstName kotelezo, ceg eseten Name kotelezo.",
    {
      type: z
        .enum(["Person", "Business"])
        .describe("Kontakt tipusa: Person (szemely) vagy Business (ceg)"),
      firstName: z.string().optional().describe("Keresztnev (szemely eseten kotelezo)"),
      lastName: z.string().optional().describe("Vezeteknev"),
      name: z.string().optional().describe("Cegnev (ceg eseten kotelezo)"),
      email: z.string().optional().describe("Email cim"),
      phone: z.string().optional().describe("Telefonszam"),
      businessId: z
        .number()
        .optional()
        .describe("Ceg ID amelyhez a szemelyt hozzarendeljuk"),
      description: z.string().optional().describe("Leiras / megjegyzes"),
      extraFields: z
        .record(z.unknown())
        .optional()
        .describe("Egyedi mezok kulcs-ertek parjai"),
    },
    async ({ type, firstName, lastName, name, email, phone, businessId, description, extraFields }) => {
      try {
        const body: Record<string, unknown> = { Type: type };
        if (firstName) body.FirstName = firstName;
        if (lastName) body.LastName = lastName;
        if (name) body.Name = name;
        if (email) body.Email = email;
        if (phone) body.Phone = phone;
        if (businessId) body.BusinessId = businessId;
        if (description) body.Description = description;
        if (extraFields) Object.assign(body, extraFields);

        const data = await client.request("PUT", "/Api/R3/Contact", body);
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
    "minicrm_update_contact",
    "Kontakt adatainak frissitese. Csak a valtozo mezokat kell megadni.",
    {
      contactId: z.number().describe("A kontakt ID-ja"),
      fields: z
        .record(z.unknown())
        .describe(
          "Frissitendo mezok kulcs-ertek parjai (pl. {\"Email\": \"uj@email.hu\", \"Phone\": \"+36201234567\"})"
        ),
    },
    async ({ contactId, fields }) => {
      try {
        const data = await client.request(
          "PUT",
          `/Api/R3/Contact/${contactId}`,
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
    "minicrm_delete_contact",
    "Szemely kontakt vegleges torlese. FIGYELEM: csak szemely tipusu kontaktot lehet torolni, ceget nem. Csak akkor torolheto ha nem elsodleges kontakt egyetlen adatlapon sem.",
    { contactId: z.number().describe("A torlendo szemely kontakt ID-ja") },
    async ({ contactId }) => {
      try {
        const data = await client.request(
          "GET",
          `/Api/R3/PurgePerson/${contactId}`
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
    "minicrm_list_company_contacts",
    "Egy ceghez tartozo osszes kontakt szemely listazasa.",
    {
      businessId: z.number().describe("A ceg (Business) ID-ja"),
      page: z.number().optional().default(0).describe("Oldal szama (0-tol indul)"),
    },
    async ({ businessId, page }) => {
      try {
        const params: Record<string, string | number | undefined> = {
          MainContactId: businessId,
        };
        if (page && page > 0) params.Page = page;

        const data = await client.search("/Api/R3/Contact", params);
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
