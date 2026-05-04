#!/usr/bin/env node

import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MiniCrmClient } from "./client.js";
import { registerAllTools, SERVER_INSTRUCTIONS } from "./register-tools.js";
import {
  validateLicense,
  generateAuthCode,
  exchangeAuthCode,
  verifyToken,
  setAllowedCategoryIds,
} from "./auth.js";
import { getLoginPageHtml } from "./login-page.js";
import { getModuleSelectionPageHtml } from "./module-selection-page.js";
import { logUsage } from "./usage-db.js";
import { adminRouter } from "./admin.js";
import { getAdminDashboardHtml } from "./admin-page.js";

const PORT = parseInt(process.env.MCP_PORT || "4001", 10);
const BASE_URL = process.env.MCP_BASE_URL || "https://minicrmmcp.netlify.app";

const app = express();

// CORS - required for Claude's browser-based connector
app.use((_req: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  const origEnd = res.end.bind(res);
  res.end = function (...args: Parameters<typeof origEnd>) {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    return origEnd(...args);
  } as typeof res.end;
  next();
});

// --- OAuth 2.1 Discovery ---

app.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/authorize`,
    token_endpoint: `${BASE_URL}/token`,
    registration_endpoint: `${BASE_URL}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  });
});

app.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
  res.json({
    resource: `${BASE_URL}/mcp`,
    authorization_servers: [BASE_URL],
    scopes_supported: ["mcp"],
  });
});

// Dynamic client registration (required by MCP OAuth spec)
app.post("/register", (_req: Request, res: Response) => {
  res.status(201).json({
    client_id: "minicrm-mcp-client",
    client_name: "MiniCRM MCP",
    redirect_uris: _req.body.redirect_uris || [],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

// --- OAuth Authorization Endpoint ---

// GET /authorize - show login page
app.get("/authorize", (req: Request, res: Response) => {
  const {
    client_id = "",
    redirect_uri = "",
    state = "",
    code_challenge = "",
    code_challenge_method = "S256",
  } = req.query as Record<string, string>;

  res.type("html").send(
    getLoginPageHtml(
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method
    )
  );
});

// POST /authorize - validate creds, then show module selection page
app.post("/authorize", async (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    license_key,
    system_id,
    api_key,
  } = req.body;

  // Validate license (bound to this systemId)
  const validation = await validateLicense(license_key, system_id);
  if (!validation.valid) {
    res.type("html").send(
      getLoginPageHtml(
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        "Érvénytelen licenckulcs, vagy már egy másik MiniCRM rendszerhez van rendelve."
      )
    );
    return;
  }

  // Verify MiniCRM creds + fetch categories in one shot.
  // The Category endpoint is the cheapest auth probe and gives us the data
  // for the module selection page.
  type Category = { id: number; name: string; type?: string };
  let categories: Category[] = [];
  try {
    const testClient = new MiniCrmClient({
      systemId: system_id,
      apiKey: api_key,
      baseUrl: "https://r3.minicrm.hu",
    });
    const raw = await testClient.request<Record<string, any>>("GET", "/Api/R3/Category");
    const parsed: Category[] = [];
    for (const [id, val] of Object.entries(raw || {})) {
      const idNum = Number(id);
      if (!Number.isFinite(idNum) || idNum <= 0) continue;
      const name = typeof val === "string"
        ? val
        : (val && typeof val === "object" && typeof val.Name === "string" ? val.Name : `Modul #${idNum}`);
      const type = (val && typeof val === "object" && typeof val.Type === "string") ? val.Type : undefined;
      parsed.push({ id: idNum, name, type });
    }
    categories = parsed.sort((a, b) => a.name.localeCompare(b.name, "hu"));
  } catch {
    res.type("html").send(
      getLoginPageHtml(
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        "Hibás MiniCRM System ID vagy API kulcs."
      )
    );
    return;
  }

  res.type("html").send(
    getModuleSelectionPageHtml({
      clientId: client_id,
      redirectUri: redirect_uri,
      state,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || "S256",
      licenseKey: license_key,
      systemId: system_id,
      apiKey: api_key,
      categories,
      selectedIds: validation.allowedCategoryIds,
    })
  );
});

// POST /authorize/select-modules - persist module selection, generate auth code, redirect to Claude
app.post("/authorize/select-modules", async (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    license_key,
    system_id,
    api_key,
    all_modules,
  } = req.body;

  if (!license_key || !system_id || !api_key || !redirect_uri) {
    res.status(400).type("html").send("Hianyzo parameterek a modul-mentesi keresben.");
    return;
  }

  // Re-validate the license — defense in depth (the form was rendered server-side
  // but we don't trust hidden inputs blindly).
  const validation = await validateLicense(license_key, system_id);
  if (!validation.valid) {
    res.status(401).type("html").send("Ervenytelen licenc — kerlek jelentkezz be ujra.");
    return;
  }

  // Parse selected category ids. The form posts them under repeating
  // category_id fields → Express body-parser yields either a string or array.
  let selectedRaw: unknown = req.body.category_id;
  if (selectedRaw === undefined) selectedRaw = [];
  if (typeof selectedRaw === "string") selectedRaw = [selectedRaw];
  const selected = Array.isArray(selectedRaw)
    ? selectedRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  // "Mégis minden modul" button → store null = no restriction.
  const allowedCategoryIds: number[] | null = all_modules ? null : selected;

  const saved = await setAllowedCategoryIds(license_key, allowedCategoryIds);
  if (!saved) {
    res.status(500).type("html").send("Nem sikerult menteni a modul-beallitast. Probald ujra.");
    return;
  }

  const code = generateAuthCode(
    {
      systemId: system_id,
      apiKey: api_key,
      licenseKey: license_key,
      allowedCategoryIds,
    },
    code_challenge,
    code_challenge_method || "S256",
    redirect_uri
  );

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
});

// --- OAuth Token Endpoint ---

app.post("/token", (req: Request, res: Response) => {
  const { grant_type, code, code_verifier, redirect_uri } = req.body;

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const token = exchangeAuthCode(code, code_verifier, redirect_uri);
  if (!token) {
    res.status(400).json({ error: "invalid_grant" });
    return;
  }

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 30 * 24 * 3600, // 30 days
  });
});

// --- MCP Endpoint (Streamable HTTP) ---

app.post("/mcp", async (req: Request, res: Response) => {
  // Extract Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Hozzaferes megtagadva. Bearer token szukseges." });
    return;
  }

  const token = authHeader.slice(7);
  const credentials = verifyToken(token);
  if (!credentials) {
    res.status(401).json({ error: "Ervenytelen vagy lejart token." });
    return;
  }

  // Create per-request MCP server + client
  const client = new MiniCrmClient({
    systemId: credentials.systemId,
    apiKey: credentials.apiKey,
    baseUrl: "https://r3.minicrm.hu",
    allowedCategoryIds: credentials.allowedCategoryIds,
  });

  const mcpServer = new McpServer(
    { name: "minicrm-mcp", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerAllTools(mcpServer, client);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });

  await mcpServer.connect(transport);
  try {
    // Log tool usage
    const body = req.body;
    let toolName: string | null = null;
    if (body?.method === "tools/call" && body?.params?.name) {
      toolName = body.params.name;
    }
    if (body?.method === "tools/call" || body?.method === "tools/list") {
      logUsage(credentials.licenseKey, credentials.systemId, toolName, true);
    }

    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error("MCP handleRequest hiba:", error);
    logUsage(credentials.licenseKey, credentials.systemId, null, false);
    if (!res.headersSent) {
      res.status(500).json({ error: "Belso szerver hiba." });
    }
  }
});

// Handle GET /mcp - required for SSE stream initialization
app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST." },
  });
});

// Handle DELETE /mcp - session cleanup
app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Sessions not supported." },
  });
});

// --- Admin Dashboard ---

app.get("/admin", (_req: Request, res: Response) => {
  res.type("html").send(getAdminDashboardHtml());
});

app.use("/admin", adminRouter);

// --- Health check ---

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`MiniCRM MCP HTTP szerver elindult: ${BASE_URL}`);
  console.log(`  OAuth: ${BASE_URL}/.well-known/oauth-authorization-server`);
  console.log(`  MCP:   ${BASE_URL}/mcp`);
});
