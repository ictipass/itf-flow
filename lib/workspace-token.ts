import { createPublicKey, verify as verifyBytes, type JsonWebKey } from "node:crypto";

const VERSION = "itf-workspace-launch-v2";
const TOKEN_TYPE = "itf-workspace-launch+jwt";
const DEFAULT_ISSUER = "http://localhost:3000";
const DEFAULT_AUDIENCE = "itf-flow";
const DEFAULT_APP_SLUG = "itf-flow";
const JWKS_CACHE_SECONDS = 300;

export type WorkspacePayload = {
  version: typeof VERSION;
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  identity: {
    name?: string | null;
    email: string;
    staffNumber?: string | null;
    workspaceRole: string;
    officeId?: string | null;
    departmentId?: string | null;
    divisionId?: string | null;
    unitId?: string | null;
    positionId?: string | null;
  };
  entitlement: {
    appId: string;
    slug: string;
    role: string;
    requiredAssurance: "STANDARD" | "SENSITIVE";
  };
  authentication: {
    workspaceSessionId: string;
    methods: string[];
    authenticatedAt: number;
    mfaAuthenticatedAt?: number;
  };
};

export type WorkspaceLaunchReceiverConfiguration = {
  issuer: string;
  audience: string;
  appSlug: string;
  jwksUrl: string;
  ttlSeconds: number;
  clockSkewSeconds: number;
  stepUpSeconds: number;
};

type JwkSet = { keys: JsonWebKey[] };
type CacheEntry = { expiresAt: number; jwks: JwkSet };
const jwksCache = new Map<string, CacheEntry>();

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number, name: string) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function normalizedUrl(value: string, name: string, production: boolean) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== "https:")) {
    throw new Error(`${name} must use ${production ? "https" : "http or https"}.`);
  }
  if (url.username || url.password) throw new Error(`${name} must not contain credentials.`);
  return url.toString();
}

export function resolveWorkspaceLaunchReceiverConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): WorkspaceLaunchReceiverConfiguration {
  const production = environment.NODE_ENV === "production";
  const issuerValue = environment.WORKSPACE_LAUNCH_ISSUER?.trim() || (production ? "" : DEFAULT_ISSUER);
  const audience = environment.WORKSPACE_LAUNCH_AUDIENCE?.trim() || (production ? "" : DEFAULT_AUDIENCE);
  const appSlug = environment.WORKSPACE_APP_SLUG?.trim() || DEFAULT_APP_SLUG;
  if (!issuerValue) throw new Error("WORKSPACE_LAUNCH_ISSUER is required.");
  if (!audience) throw new Error("WORKSPACE_LAUNCH_AUDIENCE is required.");
  const issuer = normalizedUrl(issuerValue, "WORKSPACE_LAUNCH_ISSUER", production);
  const jwksUrl = normalizedUrl(
    environment.WORKSPACE_LAUNCH_JWKS_URL?.trim() || new URL("/api/integrations/workspace/v2/jwks", issuer).toString(),
    "WORKSPACE_LAUNCH_JWKS_URL",
    production
  );
  return {
    issuer,
    audience,
    appSlug,
    jwksUrl,
    ttlSeconds: boundedInteger(environment.WORKSPACE_LAUNCH_TTL_SECONDS, 120, 30, 300, "WORKSPACE_LAUNCH_TTL_SECONDS"),
    clockSkewSeconds: boundedInteger(environment.WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS, 30, 0, 60, "WORKSPACE_LAUNCH_CLOCK_SKEW_SECONDS"),
    stepUpSeconds: boundedInteger(environment.WORKSPACE_MFA_STEP_UP_SECONDS, 600, 60, 3600, "WORKSPACE_MFA_STEP_UP_SECONDS"),
  };
}

function decodeJson(value: string, label: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new Error(`Invalid Workspace launch ${label}.`);
  }
}

function parseToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("Invalid Workspace launch token structure.");
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart, "header") as { alg?: unknown; typ?: unknown; kid?: unknown };
  if (header.alg !== "RS256" || header.typ !== TOKEN_TYPE || typeof header.kid !== "string" || !header.kid) {
    throw new Error("Workspace launch token header is not allowed.");
  }
  return { header, headerPart, payloadPart, signaturePart };
}

function usableJwk(value: JsonWebKey, keyId: string) {
  const record = value as JsonWebKey & Record<string, unknown>;
  const privateMembers = ["d", "p", "q", "dp", "dq", "qi", "oth"];
  return record.kid === keyId && record.kty === "RSA" && record.alg === "RS256" && record.use === "sig" &&
    typeof record.n === "string" && typeof record.e === "string" &&
    !privateMembers.some((name) => name in record);
}

export function verifyWorkspaceTokenWithJwks(
  token: string,
  jwks: JwkSet,
  configuration: WorkspaceLaunchReceiverConfiguration,
  now = new Date()
) {
  const parsed = parseToken(token);
  const publicJwk = jwks.keys.find((key) => usableJwk(key, parsed.header.kid as string));
  if (!publicJwk) throw new Error("Workspace launch signing key is unknown or invalid.");
  const signatureValid = verifyBytes(
    "RSA-SHA256",
    Buffer.from(`${parsed.headerPart}.${parsed.payloadPart}`),
    createPublicKey({ key: publicJwk, format: "jwk" }),
    Buffer.from(parsed.signaturePart, "base64url")
  );
  if (!signatureValid) throw new Error("Invalid Workspace launch token signature.");

  const payload = decodeJson(parsed.payloadPart, "payload") as WorkspacePayload;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const skew = configuration.clockSkewSeconds;
  if (
    payload.version !== VERSION || payload.iss !== configuration.issuer ||
    payload.aud !== configuration.audience || payload.entitlement?.slug !== configuration.appSlug ||
    !payload.sub || !payload.jti || !payload.identity?.email || !payload.entitlement?.appId ||
    !payload.entitlement?.role || !payload.authentication?.workspaceSessionId ||
    !Array.isArray(payload.authentication.methods) || !payload.authentication.methods.includes("pwd") ||
    !Number.isInteger(payload.authentication.authenticatedAt) ||
    !["STANDARD", "SENSITIVE"].includes(payload.entitlement.requiredAssurance)
  ) throw new Error("Workspace launch claims are invalid.");
  if (
    !Number.isInteger(payload.iat) || !Number.isInteger(payload.nbf) || !Number.isInteger(payload.exp) ||
    payload.iat > nowSeconds + skew || payload.nbf > nowSeconds + skew || payload.exp + skew < nowSeconds ||
    payload.exp <= payload.iat || payload.exp - payload.iat > configuration.ttlSeconds ||
    payload.authentication.authenticatedAt > payload.iat + skew
  ) throw new Error("Workspace launch timing is invalid.");
  if (payload.entitlement.requiredAssurance === "SENSITIVE") {
    const mfaAt = payload.authentication.mfaAuthenticatedAt;
    if (!payload.authentication.methods.includes("totp") || !Number.isInteger(mfaAt) ||
      mfaAt! > payload.iat + skew || mfaAt! < payload.iat - configuration.stepUpSeconds) {
      throw new Error("Fresh Workspace TOTP is required for this sensitive entitlement.");
    }
  }
  return payload;
}

async function fetchJwks(url: string, forceRefresh = false) {
  const cached = jwksCache.get(url);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.jwks;
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error("Workspace signing keys are unavailable.");
  const value = await response.json() as { keys?: unknown };
  if (!Array.isArray(value.keys) || value.keys.length === 0 || value.keys.length > 50) {
    throw new Error("Workspace signing key response is invalid.");
  }
  const jwks = { keys: value.keys as JsonWebKey[] };
  jwksCache.set(url, { jwks, expiresAt: Date.now() + JWKS_CACHE_SECONDS * 1000 });
  return jwks;
}

export async function verifyWorkspaceToken(token: string) {
  const configuration = resolveWorkspaceLaunchReceiverConfiguration();
  const keyId = parseToken(token).header.kid as string;
  let jwks = await fetchJwks(configuration.jwksUrl);
  if (!jwks.keys.some((key) => usableJwk(key, keyId))) {
    jwks = await fetchJwks(configuration.jwksUrl, true);
  }
  return verifyWorkspaceTokenWithJwks(token, jwks, configuration);
}
