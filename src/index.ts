#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MiniCrmClient } from "./client.js";
import { registerAllTools, SERVER_INSTRUCTIONS } from "./register-tools.js";
import { validateLicense } from "./auth.js";

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

const baseUrl = process.env.MINICRM_BASE_URL || "https://r3.minicrm.hu";
const voipApiKey = process.env.MINICRM_VOIP_API_KEY;

const client = new MiniCrmClient({ systemId, apiKey, baseUrl, voipApiKey });

const server = new McpServer(
  { name: "minicrm-mcp", version: "1.0.0" },
  { instructions: SERVER_INSTRUCTIONS }
);

registerAllTools(server, client);

async function main() {
  const valid = await validateLicense(licenseKey!);
  if (!valid) {
    console.error("Ervenytelen licenckulcs. Licencet a https://minicrmai.com oldalon vasarolhat.");
    process.exit(1);
  }

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
