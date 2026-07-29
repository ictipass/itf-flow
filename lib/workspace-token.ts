import { createHmac, timingSafeEqual } from "crypto";

const VERSION = "itf-workspace-launch-v1";

export type WorkspacePayload = {
  version: typeof VERSION;
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
  };
};

export function verifyWorkspaceToken(token: string) {
  const secret = process.env.WORKSPACE_LAUNCH_TOKEN_SECRET;
  if (!secret) throw new Error("Workspace integration is not configured.");
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
  if (payload.version !== VERSION || payload.app.slug !== "itf-flow") {
    throw new Error("Launch token audience is invalid.");
  }
  if (payload.issuedAt > now + 30 || payload.expiresAt < now) {
    throw new Error("Launch token has expired.");
  }
  if (!payload.user.id || !payload.user.email) {
    throw new Error("Launch token identity is incomplete.");
  }
  return payload;
}
