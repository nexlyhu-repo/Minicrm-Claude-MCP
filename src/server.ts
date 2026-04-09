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
} from "./auth.js";
import { getLoginPageHtml } from "./login-page.js";

const PORT = parseInt(process.env.MCP_PORT || "4001", 10);
const BASE_URL = process.env.MCP_BASE_URL || "https://minicrmmcp.netlify.app";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- OAuth 2.1 Discovery ---

app.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/authorize`,
    token_endpoint: `${BASE_URL}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none"],
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

// POST /authorize - process login form
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

  // Validate license
  const valid = await validateLicense(license_key);
  if (!valid) {
    res.type("html").send(
      getLoginPageHtml(
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        "Ervenytelen licenckulcs."
      )
    );
    return;
  }

  // Quick check: can we reach MiniCRM with these creds?
  try {
    const testClient = new MiniCrmClient({
      systemId: system_id,
      apiKey: api_key,
      baseUrl: "https://r3.minicrm.hu",
    });
    await testClient.request("GET", "/Api/R3/Category");
  } catch {
    res.type("html").send(
      getLoginPageHtml(
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        "Hibas MiniCRM System ID vagy API kulcs."
      )
    );
    return;
  }

  // Generate auth code
  const code = generateAuthCode(
    { systemId: system_id, apiKey: api_key, licenseKey: license_key },
    code_challenge,
    code_challenge_method || "S256",
    redirect_uri
  );

  // Redirect back to Claude with the code
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

  // Re-validate license periodically (token may be old)
  const valid = await validateLicense(credentials.licenseKey);
  if (!valid) {
    res.status(403).json({ error: "A licenc lejart vagy visszavonasra kerult." });
    return;
  }

  // Create per-request MCP server + client
  const client = new MiniCrmClient({
    systemId: credentials.systemId,
    apiKey: credentials.apiKey,
    baseUrl: "https://r3.minicrm.hu",
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
  await transport.handleRequest(req, res);
});

// Handle GET /mcp for SSE stream (some clients use this)
app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({ error: "Hasznaljon POST kerest." });
});

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
