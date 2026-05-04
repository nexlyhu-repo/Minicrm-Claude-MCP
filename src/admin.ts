import { Router, Request, Response } from "express";
import { getAllUsageStats, getUsageStats, getRecentCalls, getToolStats } from "./usage-db.js";

const LICENSE_API_URL =
  process.env.MINICRM_LICENSE_API_URL || "https://minicrm-license.nexlyhu.workers.dev";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

const router = Router();

// Auth middleware
function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!ADMIN_SECRET) {
    res.status(500).json({ error: "ADMIN_SECRET not configured" });
    return;
  }
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "").trim();
  if (!token || token !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

// GET /admin/api/licenses - list all licenses merged with usage stats
router.get("/api/licenses", async (_req: Request, res: Response) => {
  try {
    const licRes = await fetch(`${LICENSE_API_URL}/keys`, {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    if (!licRes.ok) {
      res.status(licRes.status).json({ error: "License API error" });
      return;
    }
    const licData = (await licRes.json()) as {
      keys: Array<{
        key: string;
        active: boolean;
        email: string;
        createdAt: string;
        expiresAt: string | null;
        note?: string;
        boundSystemId?: string;
      }>;
    };

    const usageMap = new Map<string, any>();
    for (const stat of getAllUsageStats()) {
      usageMap.set(stat.license_key, stat);
    }

    const merged = licData.keys.map((lic) => {
      const usage = usageMap.get(lic.key);
      return {
        ...lic,
        total_calls: usage?.total_calls || 0,
        last_used: usage?.last_used || null,
      };
    });

    res.json({ licenses: merged });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
});

// GET /admin/api/usage/:key - detailed usage for a license
router.get("/api/usage/:key", (req: Request, res: Response) => {
  const key = req.params.key as string;
  const stats = getUsageStats(key);
  const recent = getRecentCalls(key, 100);
  const tools = getToolStats(key);
  res.json({ stats, recent, tools });
});

// PUT /admin/api/licenses/:key - update license (name/note/email/expiresAt)
router.put("/api/licenses/:key", async (req: Request, res: Response) => {
  try {
    const putRes = await fetch(`${LICENSE_API_URL}/keys/${req.params.key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await putRes.json();
    res.status(putRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to update license" });
  }
});

// POST /admin/api/licenses - create new license
router.post("/api/licenses", async (req: Request, res: Response) => {
  const { email, note, expiresAt } = req.body;
  try {
    const createRes = await fetch(`${LICENSE_API_URL}/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
      body: JSON.stringify({ email, note, expiresAt }),
    });
    const data = await createRes.json();
    res.status(createRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to create license" });
  }
});

// DELETE /admin/api/licenses/:key - revoke license
router.delete("/api/licenses/:key", async (req: Request, res: Response) => {
  try {
    const delRes = await fetch(`${LICENSE_API_URL}/keys/${req.params.key}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    const data = await delRes.json();
    res.status(delRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke license" });
  }
});

// DELETE /admin/api/licenses/:key/permanent - fully purge license (frees email for re-registration)
router.delete("/api/licenses/:key/permanent", async (req: Request, res: Response) => {
  try {
    const delRes = await fetch(`${LICENSE_API_URL}/keys/${req.params.key}/permanent`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    const data = await delRes.json();
    res.status(delRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to purge license" });
  }
});

// POST /admin/api/licenses/:key/reactivate
router.post("/api/licenses/:key/reactivate", async (req: Request, res: Response) => {
  try {
    const reRes = await fetch(`${LICENSE_API_URL}/keys/${req.params.key}/reactivate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
    });
    const data = await reRes.json();
    res.status(reRes.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reactivate license" });
  }
});

export { router as adminRouter };
