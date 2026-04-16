interface Env {
  LICENSES: KVNamespace;
  ADMIN_SECRET: string;
}

interface LicenseData {
  active: boolean;
  email: string;
  createdAt: string;
  expiresAt: string | null;
  note?: string;
  boundSystemId?: string;
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
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

        return json({ valid: true, email: data.email });
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
