import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

export function registerAllTools(server: McpServer, client: MiniCrmClient) {
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
}

export const SERVER_INSTRUCTIONS = [
  "MiniCRM egy magyar CRM rendszer. Fo fogalmak:",
  "- Modul (Category): A CRM termek/folyamat kategoriak (pl. Ertekesites, Helpdesk). Hasznald a minicrm_list_categories eszkoz, hogy megismerd az elerheto modulokat.",
  "- Projekt (Project/Adatlap): A fo adategyseg, egy CRM rekord. Minden projektnek van statusza, kontaktja es felelosenek.",
  "- Kontakt (Contact): Szemely (Person) vagy Ceg (Business). A projektek kontaktokhoz tartoznak, a kontaktok cegekhez.",
  "- Teendo (ToDo): Feladat egy projekthez rendelve.",
  "",
  "FONTOS - MINDIG az aggregalo (detailed/full) toolokat hasznald, mert 10x gyorsabbak:",
  "- Kontakt kereses: minicrm_search_contacts_detailed (NE minicrm_search_contacts)",
  "- Kontakt teljes profil: minicrm_get_contact_full (kontakt + projektjei + teendoi, 1 hivas)",
  "- Projekt kereses: minicrm_search_projects_detailed (NE minicrm_search_projects)",
  "- Projekt teljes adatai: minicrm_get_project_full (projekt + kontakt + teendok + tortenelem, 1 hivas)",
  "- Teendok listazasa: minicrm_list_all_todos (NE minicrm_list_todos egyenkent)",
  "- Napi osszefoglalo: minicrm_my_day (mai/lejart/kovetkezo teendok 1 hivasban)",
  "- Szamlak listazasa: minicrm_list_invoices_detailed (NE minicrm_list_invoices)",
  "- Megrendelesek listazasa: minicrm_list_orders_detailed (NE minicrm_list_orders)",
  "- Ajanlatok listazasa: minicrm_list_offers_detailed (NE minicrm_list_offers)",
  "- A regi search/list toolokat CSAK akkor hasznald, ha a fenti aggregalo toolok nem elegsegesek.",
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
].join("\n");
