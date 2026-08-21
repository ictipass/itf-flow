import { createHmac, timingSafeEqual } from "crypto";

const LEGACY_VERSION = "itf-workspace-launch-v1";
const VERSION = "itf-workspace-launch-v2";

export type WorkspacePayload = {
  version: typeof VERSION | typeof LEGACY_VERSION;
  issuer?: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    staffNumber?: string | null;
    officeId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
    unitId?: string | null;
    positionId?: string | null;
  };
  app: {
    slug: string;
    role?: string | null;
    entitled?: boolean;
  };
  authentication?: {
    sessionId: string;
    methods: string[];
    authenticatedAt: number;
  };
};

export function verifyWorkspaceToken(token: string) {
  const secret = process.env.WORKSPACE_LAUNCH_TOKEN_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && secret.length < 32)) throw new Error("Workspace integration is not securely configured.");
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) throw new Error("Invalid launch token.");

  const expected = createHmac("sha256", secret).update(payloadPart).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) throw new Error("Invalid launch token signature.");

  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString()) as WorkspacePayload;
  const now = Math.floor(Date.now() / 1000);
  if (![VERSION, LEGACY_VERSION].includes(payload.version) || payload.app.slug !== "itf-flow") {
    throw new Error("Launch token audience is invalid.");
  }
  if (payload.issuedAt > now + 30 || payload.expiresAt < now || payload.expiresAt - payload.issuedAt > 120) {
    throw new Error("Launch token has expired.");
  }
  if (!payload.user.id || !payload.user.email) {
    throw new Error("Launch token identity is incomplete.");
  }
  if (payload.version === VERSION) {
    const authenticatedAt = payload.authentication?.authenticatedAt ?? 0;
    const mfa = payload.authentication?.methods.some((method) => method.toLowerCase() === "mfa");
    if (payload.issuer !== (process.env.WORKSPACE_TOKEN_ISSUER ?? "itf-workspace") || payload.app.entitled !== true || !payload.authentication?.sessionId || !mfa || authenticatedAt > now + 30 || authenticatedAt < now - 12 * 60 * 60) throw new Error("Workspace entitlement or MFA context is incomplete.");
  }
  if (payload.version === LEGACY_VERSION && process.env.NODE_ENV === "production" && process.env.WORKSPACE_ALLOW_LEGACY_LAUNCH !== "true") throw new Error("Legacy Workspace launch tokens are disabled.");
  return payload;
}
