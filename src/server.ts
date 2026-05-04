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
  getTenantInfo,
  setupTenant,
  verifyTenantPassword,
  listTenantLicenses,
  resetTenantPassword,
  signTeamToken,
  verifyTeamToken,
} from "./auth.js";
import { getLoginPageHtml } from "./login-page.js";
import { getModuleSelectionPageHtml } from "./module-selection-page.js";
import { getTenantSetupPageHtml } from "./tenant-setup-page.js";
import { getTeamLoginPageHtml, getTeamDashboardHtml } from "./team-page.js";
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

  // First-onboarding gate: if no tenant config exists yet, route through the
  // admin password setup before module selection. The very first license-holder
  // for a given system_id becomes the customer admin.
  const tenant = await getTenantInfo(system_id);
  if (!tenant.exists) {
    res.type("html").send(
      getTenantSetupPageHtml({
        clientId: client_id,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || "S256",
        licenseKey: license_key,
        systemId: system_id,
        apiKey: api_key,
        defaultEmail: validation.email,
      })
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

// POST /authorize/setup-tenant - first-time admin password setup, then continue to module selection
app.post("/authorize/setup-tenant", async (req: Request, res: Response) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    license_key,
    system_id,
    api_key,
    admin_email,
    admin_password,
    admin_password2,
  } = req.body;

  if (!license_key || !system_id || !api_key || !admin_email || !admin_password) {
    res.status(400).type("html").send(
      getTenantSetupPageHtml({
        clientId: client_id,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || "S256",
        licenseKey: license_key || "",
        systemId: system_id || "",
        apiKey: api_key || "",
        defaultEmail: admin_email,
        error: "Hianyzo mezok.",
      })
    );
    return;
  }

  if (admin_password !== admin_password2) {
    res.type("html").send(
      getTenantSetupPageHtml({
        clientId: client_id,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || "S256",
        licenseKey: license_key,
        systemId: system_id,
        apiKey: api_key,
        defaultEmail: admin_email,
        error: "A jelszavak nem egyeznek.",
      })
    );
    return;
  }

  if (admin_password.length < 8) {
    res.type("html").send(
      getTenantSetupPageHtml({
        clientId: client_id,
        redirectUri: redirect_uri,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method || "S256",
        licenseKey: license_key,
        systemId: system_id,
        apiKey: api_key,
        defaultEmail: admin_email,
        error: "A jelszo legalabb 8 karakter legyen.",
      })
    );
    return;
  }

  // Re-validate the license + creds before saving (defense in depth)
  const validation = await validateLicense(license_key, system_id);
  if (!validation.valid) {
    res.status(401).type("html").send("Ervenytelen licenc. Kerlek jelentkezz be ujra.");
    return;
  }

  const ok = await setupTenant({
    systemId: system_id,
    adminPassword: admin_password,
    adminEmail: admin_email,
    adminLicenseKey: license_key,
  });
  if (!ok) {
    res.status(500).type("html").send("Nem sikerult menteni a cegadmin beallitast. Probald ujra.");
    return;
  }

  // Now fetch categories and proceed to module selection
  let categories: { id: number; name: string; type?: string }[] = [];
  try {
    const testClient = new MiniCrmClient({
      systemId: system_id,
      apiKey: api_key,
      baseUrl: "https://r3.minicrm.hu",
    });
    const raw = await testClient.request<Record<string, any>>("GET", "/Api/R3/Category");
    const parsed: { id: number; name: string; type?: string }[] = [];
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
    res.status(500).type("html").send("Nem sikerult betolteni a modulokat. Probald ujra a bejelentkezest.");
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

// --- Customer Admin (/team) ---
// The customer admin manages their own tenant's licenses and module access.
// Auth: system_id + admin_password (set during the first OAuth onboarding).
// Employees, even though they have system_id + api_key for Claude, can NOT
// log in here without the password — that's the whole point of the gating.

const TEAM_COOKIE = "team_session";
function teamCookieHeader(token: string, secure: boolean): string {
  // 24h httpOnly cookie, restricted to /team paths
  return `${TEAM_COOKIE}=${token}; Path=/team; Max-Age=${24 * 3600}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
function readTeamCookie(req: Request): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(`${TEAM_COOKIE}=`)) return p.slice(TEAM_COOKIE.length + 1);
  }
  return null;
}

app.get("/team", (req: Request, res: Response) => {
  const cookie = readTeamCookie(req);
  if (cookie) {
    const session = verifyTeamToken(cookie);
    if (session) {
      res.redirect("/team/dashboard");
      return;
    }
  }
  res.type("html").send(getTeamLoginPageHtml());
});

app.post("/team/login", async (req: Request, res: Response) => {
  const { system_id, admin_password } = req.body;
  if (!system_id || !admin_password) {
    res.type("html").send(getTeamLoginPageHtml({ error: "System ID es jelszo kotelezo." }));
    return;
  }
  const verify = await verifyTenantPassword(system_id, admin_password);
  if (!verify.valid) {
    res.type("html").send(getTeamLoginPageHtml({ defaultSystemId: system_id, error: "Hibas jelszo, vagy nincs admin beallitva ehhez a tenanthoz." }));
    return;
  }
  const token = signTeamToken(system_id);
  res.setHeader("Set-Cookie", teamCookieHeader(token, true));
  res.redirect("/team/dashboard");
});

app.post("/team/logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", `${TEAM_COOKIE}=; Path=/team; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
  res.redirect("/team");
});

function requireTeamSession(req: Request, res: Response): { systemId: string } | null {
  const cookie = readTeamCookie(req);
  if (!cookie) {
    res.redirect("/team");
    return null;
  }
  const session = verifyTeamToken(cookie);
  if (!session) {
    res.redirect("/team");
    return null;
  }
  return session;
}

app.get("/team/dashboard", async (req: Request, res: Response) => {
  const session = requireTeamSession(req, res);
  if (!session) return;
  const [licenses, tenant] = await Promise.all([
    listTenantLicenses(session.systemId),
    getTenantInfo(session.systemId),
  ]);

  // Fetch categories using the admin license's bound creds isn't available
  // here (we don't have api_key in the team session). Workaround: pass empty
  // category list — the modal will show only IDs, which is good enough for
  // module management. Future improvement: cache category names per-tenant.
  // For now, use category names from already-allowed selections + ids.
  const categories: { id: number; name: string }[] = [];
  // Collect any known category ids across all licenses to render at least
  // those names. Fallback to "Modul #ID" for unknown.
  const idSet = new Set<number>();
  for (const lic of licenses.licenses) {
    if (Array.isArray(lic.allowedCategoryIds)) for (const id of lic.allowedCategoryIds) idSet.add(id);
  }
  for (const id of idSet) categories.push({ id, name: `Modul #${id}` });
  // Try to also fetch the live list using the admin license's saved creds —
  // we don't have them. So we'll surface a message in the dashboard explaining
  // that for fresh category names, a member should reconnect through Claude.

  res.type("html").send(
    getTeamDashboardHtml({
      systemId: session.systemId,
      adminEmail: tenant.adminEmail,
      adminLicenseKey: licenses.adminLicenseKey,
      licenses: licenses.licenses,
      categories,
    })
  );
});

app.post("/team/license/:key/modules", async (req: Request, res: Response) => {
  const session = requireTeamSession(req, res);
  if (!session) return;

  const licenseKey = req.params.key as string;
  const tenant = await listTenantLicenses(session.systemId);
  const target = tenant.licenses.find((l) => l.key === licenseKey);
  if (!target) {
    res.status(403).type("html").send("Ez a licenc nem tartozik a tenantodhoz.");
    return;
  }

  let selectedRaw: unknown = req.body.category_id;
  if (selectedRaw === undefined) selectedRaw = [];
  if (typeof selectedRaw === "string") selectedRaw = [selectedRaw];
  const selected = Array.isArray(selectedRaw)
    ? selectedRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const allowedCategoryIds: number[] | null = req.body.all_modules ? null : selected;
  const ok = await setAllowedCategoryIds(licenseKey, allowedCategoryIds);
  if (!ok) {
    res.status(500).type("html").send("Nem sikerult menteni a modul-beallitast.");
    return;
  }
  res.redirect("/team/dashboard");
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
