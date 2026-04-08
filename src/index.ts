#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MiniCrmClient } from "./client.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerToDoTools } from "./tools/todos.js";
import { registerEmailTools } from "./tools/emails.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerConnectionTools } from "./tools/connections.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerOfferTools } from "./tools/offers.js";
import { registerProductTools } from "./tools/products.js";
import { registerCallLogTools } from "./tools/calllog.js";

const LICENSE_API_URL =
  process.env.MINICRM_LICENSE_API_URL || "https://minicrm-license.nexlyhu.workers.dev";

async function validateLicense(licenseKey: string): Promise<void> {
  try {
    const res = await fetch(`${LICENSE_API_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Licenc ervenyesites sikertelen: ${text}`);
      process.exit(1);
    }

    const data = (await res.json()) as { valid?: boolean; message?: string };
    if (!data.valid) {
      console.error(
        `Ervenytelen licenckulcs: ${data.message || "A licenc lejart vagy visszavonasra kerult."}`
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Licenc szerver nem erheto el: ${error instanceof Error ? error.message : String(error)}\n` +
        "Ellenorizze az internetkapcsolatot es problja ujra."
    );
    process.exit(1);
  }
}

const licenseKey = process.env.MINICRM_LICENSE_KEY;
const systemId = process.env.MINICRM_SYSTEM_ID;
const apiKey = process.env.MINICRM_API_KEY;

if (!licenseKey) {
  console.error(
    "Hiba: MINICRM_LICENSE_KEY kornyezeti valtozo kotelezo.\n" +
      "Licenckulcsot a https://minicrmai.com oldalon vasarolhat."
  );
  process.exit(1);
}

if (!systemId || !apiKey) {
  console.error(
    "Hiba: MINICRM_SYSTEM_ID es MINICRM_API_KEY kornyezeti valtozok kotelesek.\n" +
      "Hasznalat: MINICRM_SYSTEM_ID=12345 MINICRM_API_KEY=xyz MINICRM_LICENSE_KEY=lic_xxx npx minicrm-mcp"
  );
  process.exit(1);
}

const baseUrl =
  process.env.MINICRM_BASE_URL || "https://r3.minicrm.hu";
const voipApiKey = process.env.MINICRM_VOIP_API_KEY;

const client = new MiniCrmClient({ systemId, apiKey, baseUrl, voipApiKey });

const server = new McpServer(
  {
    name: "minicrm-mcp",
    version: "1.0.0",
  },
  {
    instructions: [
      "MiniCRM egy magyar CRM rendszer. Fo fogalmak:",
      "- Modul (Category): A CRM termek/folyamat kategoriak (pl. Ertekesites, Helpdesk). Hasznald a minicrm_list_categories eszkoz, hogy megismerd az elerheto modulokat.",
      "- Projekt (Project/Adatlap): A fo adategyseg, egy CRM rekord. Minden projektnek van statusza, kontaktja es felelosenek.",
      "- Kontakt (Contact): Szemely (Person) vagy Ceg (Business). A projektek kontaktokhoz tartoznak, a kontaktok cegekhez.",
      "- Teendo (ToDo): Feladat egy projekthez rendelve.",
      "",
      "Munkafolyamat:",
      "1. Hasznald a minicrm_list_categories eszkoz, hogy megismerd a modulokat.",
      "2. Hasznald a minicrm_get_project_schema eszkoz, hogy megismerd egy modul mezoit es statuszait.",
      "3. Kereses: minicrm_search_contacts vagy minicrm_search_projects a szurt eredmenyekhez.",
      "4. Reszletek: minicrm_get_contact vagy minicrm_get_project az ID alapjan.",
      "",
      "Fontos:",
      "- Legordulo mezok szoveges erteket es numerikus ID-t is elfogadnak.",
      "- Keresesek oldalankent 100 eredmenyt adnak. Hasznald a page paramotert a lapozashoz.",
      "- Az API sebessegkorlat 60 keres/perc (kiveve szamlak).",
    ].join("\n"),
  }
);

// Minden eszkoz regisztralasa
registerSchemaTools(server, client);
registerContactTools(server, client);
registerProjectTools(server, client);
registerAddressTools(server, client);
registerToDoTools(server, client);
registerEmailTools(server, client);
registerTemplateTools(server, client);
registerConnectionTools(server, client);
registerOrderTools(server, client);
registerInvoiceTools(server, client);
registerOfferTools(server, client);
registerProductTools(server, client);
registerCallLogTools(server, client);

// Szerver inditas stdio transport-tal
async function main() {
  await validateLicense(licenseKey!);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MiniCRM MCP szerver elindult (stdio)");
}

main().catch((error) => {
  console.error("Szerver inditas hiba:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
