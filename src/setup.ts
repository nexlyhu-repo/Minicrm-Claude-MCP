#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function getConfigPath(): string {
  const platform = process.platform;
  const home = process.env.HOME || process.env.USERPROFILE || "";

  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json");
  } else {
    return path.join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   MiniCRM MCP - Telepito                 ║");
  console.log("║   Claude Desktop integraciohoz           ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const licenseKey = await ask("Licenckulcs (lic_...): ");
  if (!licenseKey.startsWith("lic_")) {
    console.error("\nHiba: A licenckulcsnak 'lic_' elotaggal kell kezdodnie.");
    process.exit(1);
  }

  // Validate license before proceeding
  console.log("\nLicenc ellenorzese...");
  try {
    const res = await fetch("https://minicrm-license.nexlyhu.workers.dev/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey }),
    });
    const data = (await res.json()) as { valid: boolean; message?: string };
    if (!data.valid) {
      console.error(`\nHiba: ${data.message || "Ervenytelen licenckulcs."}`);
      process.exit(1);
    }
    console.log("Licenc ervenyes!");
  } catch {
    console.error("\nHiba: Nem sikerult ellenorizni a licencet. Ellenorizze az internetkapcsolatot.");
    process.exit(1);
  }

  console.log("");
  console.log("A MiniCRM System ID megtalalhato a bongeszo cimsoraban:");
  console.log("  r3.minicrm.hu/XXXXX/...");
  console.log("");
  const systemId = await ask("MiniCRM System ID: ");
  if (!systemId || !/^\d+$/.test(systemId)) {
    console.error("\nHiba: A System ID csak szamokbol allhat.");
    process.exit(1);
  }

  console.log("");
  console.log("Az API kulcsot a MiniCRM Beallitasok > Rendszer oldalon talalja.");
  console.log("");
  const apiKey = await ask("MiniCRM API kulcs: ");
  if (!apiKey) {
    console.error("\nHiba: Az API kulcs megadasa kotelezo.");
    process.exit(1);
  }

  // Read or create config file
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      console.log("\nFigyelmezetes: Meglevo konfiguracio nem olvashato, uj fajl keszul.");
    }
  }

  // Add/update MCP server config
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }

  (config.mcpServers as Record<string, unknown>)["minicrm"] = {
    command: "npx",
    args: ["-y", "minicrm-mcp"],
    env: {
      MINICRM_LICENSE_KEY: licenseKey,
      MINICRM_SYSTEM_ID: systemId,
      MINICRM_API_KEY: apiKey,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  console.log("");
  console.log("Sikeres telepites!");
  console.log(`Konfiguracio mentve: ${configPath}`);
  console.log("");
  console.log("Kovetkezo lepes: Inditsa ujra a Claude Desktop alkalmazast.");
  console.log("Ezutan a + gombbal erheti el a MiniCRM eszkozoket.");
  console.log("");

  rl.close();
}

main().catch((error) => {
  console.error("Hiba:", error);
  process.exit(1);
});
