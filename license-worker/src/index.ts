interface Env {
  LICENSES: KVNamespace;
  LEADS: KVNamespace;
  TENANTS: KVNamespace;
  ADMIN_SECRET: string;
}

interface TenantData {
  // Tenant-level admin config. The MiniCRM API key is tenant-wide, so anyone
  // who can use Claude already has it; the admin password is the extra factor
  // that gates the customer-admin /team panel from regular employees.
  adminPasswordHash: string; // PBKDF2-SHA256, 100k iterations
  adminPasswordSalt: string; // hex-encoded random
  adminEmail: string;
  adminLicenseKey: string;   // the license that did the first setup — labels admin vs employee
  createdAt: string;
  updatedAt: string;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function generateRandomPassword(): string {
  // 12 char alphanumeric, easy to read aloud / type. ~71 bits of entropy.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
}

interface LicenseData {
  active: boolean;
  email: string;
  createdAt: string;
  expiresAt: string | null;
  note?: string;
  boundSystemId?: string;
  // Self-service module allowlist. null/undefined = full account access (all
  // modules). [] = no module restriction yet selected. [123, 456] = restrict
  // aggregating tools (my_day, list_all_todos, etc.) to these CategoryIds only.
  allowedCategoryIds?: number[] | null;
}

interface LeadData {
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  userCount?: number;
  licenseKey?: string;
  expiresAt?: string;
  createdAt: string;
  source: string;
}

function generateLeadId(): string {
  const ts = new Date().toISOString();
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${ts}_${suffix}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function generateKey(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `lic_${hex}`;
}

function isAdmin(request: Request, env: Env): boolean {
  if (!env.ADMIN_SECRET) return false;
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const token = auth.replace("Bearer ", "").trim();
  const secret = env.ADMIN_SECRET.trim();
  return token === secret;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS
    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // POST /trial — public, landing page calls this to create a 14-day trial
    if (method === "POST" && url.pathname === "/trial") {
      try {
        const body = (await request.json()) as {
          email?: string;
          name?: string;
          company?: string;
          phone?: string;
          userCount?: number;
        };

        if (!body.email) {
          return cors(json({ error: "E-mail megadása kötelező." }, 400));
        }

        // Check if this email already has a trial key
        const list = await env.LICENSES.list();
        for (const item of list.keys) {
          const existing = await env.LICENSES.get<LicenseData>(item.name, "json");
          if (existing && existing.email === body.email && existing.note?.startsWith("trial:")) {
            return cors(json({ error: "Ehhez az e-mail címhez már tartozik próba licenc.", existingKey: item.name }, 409));
          }
        }

        const key = generateKey();
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const data: LicenseData = {
          active: true,
          email: body.email,
          createdAt: new Date().toISOString(),
          expiresAt,
          note: `trial: ${body.name || ""} | ${body.company || ""} | ${body.phone || ""} | users:${body.userCount || "?"}`,
        };

        await env.LICENSES.put(key, JSON.stringify(data));

        // Store lead independently of license — even if email/sheet integration fails, we keep it.
        try {
          const leadId = generateLeadId();
          const lead: LeadData = {
            email: body.email,
            name: body.name,
            company: body.company,
            phone: body.phone,
            userCount: body.userCount,
            licenseKey: key,
            expiresAt,
            createdAt: data.createdAt,
            source: "landing",
          };
          await env.LEADS.put(leadId, JSON.stringify(lead));
        } catch {
          // Lead persistence is best-effort; never fail the trial flow on it.
        }

        return cors(json({ key, expiresAt }, 201));
      } catch {
        return cors(json({ error: "Érvénytelen kérés." }, 400));
      }
    }

    // POST /validate — public, MCP server calls this on startup
    if (method === "POST" && url.pathname === "/validate") {
      try {
        const body = (await request.json()) as { key?: string; systemId?: string };
        if (!body.key) {
          return json({ valid: false, message: "Licenckulcs megadasa kotelezo." }, 400);
        }

        const data = await env.LICENSES.get<LicenseData>(body.key, "json");
        if (!data) {
          return json({ valid: false, message: "Ismeretlen licenckulcs." });
        }

        if (!data.active) {
          return json({ valid: false, message: "A licenc visszavonasra kerult." });
        }

        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          return json({ valid: false, message: "A licenc lejart." });
        }

        // Enforce one license = one tenant (systemId)
        if (body.systemId) {
          if (data.boundSystemId && data.boundSystemId !== body.systemId) {
            return json({ valid: false, message: "Ez a licenckulcs mar egy masik MiniCRM rendszerhez van rendelve." });
          }
          if (!data.boundSystemId) {
            data.boundSystemId = body.systemId;
            await env.LICENSES.put(body.key, JSON.stringify(data));
          }
        }

        return json({
          valid: true,
          email: data.email,
          allowedCategoryIds: data.allowedCategoryIds ?? null,
        });
      } catch {
        return json({ valid: false, message: "Ervenytelen keres." }, 400);
      }
    }

    // --- Admin endpoints (require ADMIN_SECRET) ---

    if (!isAdmin(request, env)) {
      return json({ error: "Hozzaferes megtagadva." }, 401);
    }

    // POST /keys — create a new license key
    if (method === "POST" && url.pathname === "/keys") {
      try {
        const body = (await request.json()) as {
          email: string;
          expiresAt?: string;
          note?: string;
        };

        if (!body.email) {
          return json({ error: "Email megadasa kotelezo." }, 400);
        }

        const key = generateKey();
        const data: LicenseData = {
          active: true,
          email: body.email,
          createdAt: new Date().toISOString(),
          expiresAt: body.expiresAt || null,
          note: body.note,
        };

        await env.LICENSES.put(key, JSON.stringify(data));

        return json({ key, ...data }, 201);
      } catch {
        return json({ error: "Ervenytelen keres." }, 400);
      }
    }

    // GET /keys/:key — get license details
    if (method === "GET" && url.pathname.startsWith("/keys/")) {
      const key = url.pathname.replace("/keys/", "");
      const data = await env.LICENSES.get<LicenseData>(key, "json");
      if (!data) {
        return json({ error: "Licenc nem talalhato." }, 404);
      }
      return json({ key, ...data });
    }

    // PUT /keys/:key — update license fields (note, email, expiresAt)
    if (method === "PUT" && url.pathname.startsWith("/keys/")) {
      const key = url.pathname.replace("/keys/", "");
      const data = await env.LICENSES.get<LicenseData>(key, "json");
      if (!data) {
        return json({ error: "Licenc nem talalhato." }, 404);
      }

      try {
        const body = (await request.json()) as {
          note?: string;
          email?: string;
          expiresAt?: string | null;
          allowedCategoryIds?: number[] | null;
        };
        if (body.note !== undefined) data.note = body.note;
        if (body.email !== undefined) data.email = body.email;
        if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt;
        if (body.allowedCategoryIds !== undefined) {
          data.allowedCategoryIds = Array.isArray(body.allowedCategoryIds)
            ? body.allowedCategoryIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
            : null;
        }

        await env.LICENSES.put(key, JSON.stringify(data));
        return json({ key, ...data, message: "Licenc frissitve." });
      } catch {
        return json({ error: "Ervenytelen keres." }, 400);
      }
    }

    // DELETE /keys/:key/permanent — fully purge from KV (frees up email for re-registration)
    if (method === "DELETE" && url.pathname.startsWith("/keys/") && url.pathname.endsWith("/permanent")) {
      const key = url.pathname.replace("/keys/", "").replace("/permanent", "");
      const data = await env.LICENSES.get<LicenseData>(key, "json");
      if (!data) {
        return json({ error: "Licenc nem talalhato." }, 404);
      }

      await env.LICENSES.delete(key);

      return json({ key, message: "Licenc veglegesen torolve." });
    }

    // DELETE /keys/:key — revoke a license
    if (method === "DELETE" && url.pathname.startsWith("/keys/")) {
      const key = url.pathname.replace("/keys/", "");
      const data = await env.LICENSES.get<LicenseData>(key, "json");
      if (!data) {
        return json({ error: "Licenc nem talalhato." }, 404);
      }

      data.active = false;
      await env.LICENSES.put(key, JSON.stringify(data));

      return json({ key, ...data, message: "Licenc visszavonva." });
    }

    // POST /keys/:key/reactivate — reactivate a revoked license
    if (method === "POST" && url.pathname.endsWith("/reactivate")) {
      const key = url.pathname.replace("/keys/", "").replace("/reactivate", "");
      const data = await env.LICENSES.get<LicenseData>(key, "json");
      if (!data) {
        return json({ error: "Licenc nem talalhato." }, 404);
      }

      data.active = true;
      await env.LICENSES.put(key, JSON.stringify(data));

      return json({ key, ...data, message: "Licenc ujraaktivalva." });
    }

    // === Tenant config endpoints (admin-secret protected) =================
    // Used by the MCP server to set up customer admin credentials and gate the
    // /team panel. The MCP proxies these on behalf of the user after verifying
    // they hold the MiniCRM api_key (which is the trust anchor here).

    // GET /tenants/:systemId — fetch tenant config (sans password hash)
    if (method === "GET" && url.pathname.startsWith("/tenants/") && !url.pathname.includes("/", 9 + 1)) {
      const systemId = url.pathname.replace("/tenants/", "");
      const tenant = await env.TENANTS.get<TenantData>(systemId, "json");
      if (!tenant) {
        return json({ exists: false });
      }
      return json({
        exists: true,
        adminEmail: tenant.adminEmail,
        adminLicenseKey: tenant.adminLicenseKey,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      });
    }

    // POST /tenants/:systemId — create or replace tenant config
    if (method === "POST" && /^\/tenants\/[^/]+$/.test(url.pathname)) {
      const systemId = url.pathname.replace("/tenants/", "");
      try {
        const body = (await request.json()) as {
          adminPassword?: string;
          adminEmail?: string;
          adminLicenseKey?: string;
        };
        if (!body.adminPassword || body.adminPassword.length < 8) {
          return json({ error: "A jelszo legalabb 8 karakter legyen." }, 400);
        }
        if (!body.adminEmail) {
          return json({ error: "Admin email kotelezo." }, 400);
        }
        if (!body.adminLicenseKey) {
          return json({ error: "Admin licenc kulcs kotelezo." }, 400);
        }

        const existing = await env.TENANTS.get<TenantData>(systemId, "json");
        const salt = generateSalt();
        const hash = await hashPassword(body.adminPassword, salt);
        const now = new Date().toISOString();
        const tenant: TenantData = {
          adminPasswordHash: hash,
          adminPasswordSalt: salt,
          adminEmail: body.adminEmail,
          adminLicenseKey: body.adminLicenseKey,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await env.TENANTS.put(systemId, JSON.stringify(tenant));
        return json({ ok: true, systemId, adminEmail: tenant.adminEmail });
      } catch {
        return json({ error: "Ervenytelen keres." }, 400);
      }
    }

    // POST /tenants/:systemId/verify — verify admin password (for /team login)
    if (method === "POST" && /^\/tenants\/[^/]+\/verify$/.test(url.pathname)) {
      const systemId = url.pathname.replace("/tenants/", "").replace("/verify", "");
      try {
        const body = (await request.json()) as { adminPassword?: string };
        if (!body.adminPassword) return json({ valid: false, error: "Hianyzo jelszo." }, 400);
        const tenant = await env.TENANTS.get<TenantData>(systemId, "json");
        if (!tenant) return json({ valid: false, error: "Nincs admin beallitva ehhez a tenanthoz." }, 404);
        const hash = await hashPassword(body.adminPassword, tenant.adminPasswordSalt);
        if (!timingSafeEqualHex(hash, tenant.adminPasswordHash)) {
          return json({ valid: false });
        }
        return json({
          valid: true,
          adminEmail: tenant.adminEmail,
          adminLicenseKey: tenant.adminLicenseKey,
        });
      } catch {
        return json({ valid: false, error: "Ervenytelen keres." }, 400);
      }
    }

    // POST /tenants/:systemId/reset-password — generate a new random password
    // (used by global admin /admin panel when a customer forgets)
    if (method === "POST" && /^\/tenants\/[^/]+\/reset-password$/.test(url.pathname)) {
      const systemId = url.pathname.replace("/tenants/", "").replace("/reset-password", "");
      const tenant = await env.TENANTS.get<TenantData>(systemId, "json");
      if (!tenant) return json({ error: "Nincs admin beallitva ehhez a tenanthoz." }, 404);
      const newPassword = generateRandomPassword();
      const salt = generateSalt();
      tenant.adminPasswordHash = await hashPassword(newPassword, salt);
      tenant.adminPasswordSalt = salt;
      tenant.updatedAt = new Date().toISOString();
      await env.TENANTS.put(systemId, JSON.stringify(tenant));
      return json({ systemId, newPassword, adminEmail: tenant.adminEmail });
    }

    // GET /tenants/:systemId/licenses — list all licenses bound to this tenant
    if (method === "GET" && /^\/tenants\/[^/]+\/licenses$/.test(url.pathname)) {
      const systemId = url.pathname.replace("/tenants/", "").replace("/licenses", "");
      const list = await env.LICENSES.list();
      const licenses: Array<{ key: string } & LicenseData> = [];
      for (const item of list.keys) {
        const data = await env.LICENSES.get<LicenseData>(item.name, "json");
        if (data && data.boundSystemId === systemId) {
          licenses.push({ key: item.name, ...data });
        }
      }
      const tenant = await env.TENANTS.get<TenantData>(systemId, "json");
      return json({
        count: licenses.length,
        adminLicenseKey: tenant?.adminLicenseKey || null,
        licenses,
      });
    }

    // GET /leads — list all leads (newest first)
    if (method === "GET" && url.pathname === "/leads") {
      const list = await env.LEADS.list();
      const leads: Array<{ id: string } & LeadData> = [];
      for (const item of list.keys) {
        const data = await env.LEADS.get<LeadData>(item.name, "json");
        if (data) leads.push({ id: item.name, ...data });
      }
      leads.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return json({ count: leads.length, leads });
    }

    // DELETE /leads/:id — remove a lead record
    if (method === "DELETE" && url.pathname.startsWith("/leads/")) {
      const id = url.pathname.replace("/leads/", "");
      const data = await env.LEADS.get<LeadData>(id, "json");
      if (!data) {
        return json({ error: "Lead nem talalhato." }, 404);
      }
      await env.LEADS.delete(id);
      return json({ id, message: "Lead torolve." });
    }

    // GET /keys — list all licenses (KV list, max 1000)
    if (method === "GET" && url.pathname === "/keys") {
      const list = await env.LICENSES.list();
      const keys: Array<{ key: string } & LicenseData> = [];

      for (const item of list.keys) {
        const data = await env.LICENSES.get<LicenseData>(item.name, "json");
        if (data) {
          keys.push({ key: item.name, ...data });
        }
      }

      return json({ count: keys.length, keys });
    }

    return json({ error: "Ismeretlen utvonal." }, 404);
  },
};
