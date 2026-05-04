import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.MCP_JWT_SECRET || "minicrm-mcp-default-secret-change-me";
const LICENSE_API_URL =
  process.env.MINICRM_LICENSE_API_URL || "https://minicrm-license.nexlyhu.workers.dev";

export interface UserCredentials {
  systemId: string;
  apiKey: string;
  licenseKey: string;
  // Self-service module allowlist. null = no restriction (all modules).
  // Carried in JWT so per-request handlers can scope aggregating tools without
  // an extra license-worker round-trip.
  allowedCategoryIds: number[] | null;
}

export interface ValidatedLicense {
  valid: boolean;
  email?: string;
  allowedCategoryIds: number[] | null;
}

// In-memory auth code store (short-lived, cleaned up automatically)
const authCodes = new Map<
  string,
  {
    credentials: UserCredentials;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    expiresAt: number;
  }
>();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (data.expiresAt < now) authCodes.delete(code);
  }
}, 5 * 60_000);

export async function validateLicense(licenseKey: string, systemId?: string): Promise<ValidatedLicense> {
  try {
    const res = await fetch(`${LICENSE_API_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: licenseKey, systemId }),
    });
    const data = (await res.json()) as {
      valid?: boolean;
      email?: string;
      allowedCategoryIds?: number[] | null;
    };
    return {
      valid: !!data.valid,
      email: data.email,
      allowedCategoryIds: data.allowedCategoryIds ?? null,
    };
  } catch {
    return { valid: false, allowedCategoryIds: null };
  }
}

// Update license metadata (used by self-service module-selection flow).
// Authenticated server-to-server with ADMIN_SECRET — the user-facing OAuth
// step has already verified ownership of the license + matching MiniCRM creds.
export async function setAllowedCategoryIds(licenseKey: string, allowedCategoryIds: number[] | null): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET || process.env.MINICRM_LICENSE_ADMIN_SECRET;
  if (!adminSecret) return false;
  try {
    const res = await fetch(`${LICENSE_API_URL}/keys/${encodeURIComponent(licenseKey)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminSecret}`,
      },
      body: JSON.stringify({ allowedCategoryIds }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function generateAuthCode(
  credentials: UserCredentials,
  codeChallenge: string,
  codeChallengeMethod: string,
  redirectUri: string
): string {
  const code = crypto.randomBytes(32).toString("hex");
  authCodes.set(code, {
    credentials,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
    expiresAt: Date.now() + 5 * 60_000, // 5 minutes
  });
  return code;
}

export function exchangeAuthCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): string | null {
  const data = authCodes.get(code);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  if (data.redirectUri !== redirectUri) return null;

  // Verify PKCE
  let computedChallenge: string;
  if (data.codeChallengeMethod === "S256") {
    computedChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
  } else {
    computedChallenge = codeVerifier;
  }

  if (computedChallenge !== data.codeChallenge) return null;

  authCodes.delete(code);

  // Issue JWT with credentials
  const token = jwt.sign(
    {
      systemId: data.credentials.systemId,
      apiKey: data.credentials.apiKey,
      licenseKey: data.credentials.licenseKey,
      allowedCategoryIds: data.credentials.allowedCategoryIds,
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );

  return token;
}

export function verifyToken(token: string): UserCredentials | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      systemId: string;
      apiKey: string;
      licenseKey: string;
      allowedCategoryIds?: number[] | null;
    };
    return {
      systemId: payload.systemId,
      apiKey: payload.apiKey,
      licenseKey: payload.licenseKey,
      allowedCategoryIds: payload.allowedCategoryIds ?? null,
    };
  } catch {
    return null;
  }
}

export function getJwtSecret(): string {
  return JWT_SECRET;
}
