import { createHash, createHmac, timingSafeEqual } from "crypto";

export const APPROVAL_SIGNATURE_ALGORITHM = "HMAC-SHA256";
export const APPROVAL_SIGNATURE_KEY_ID = "itf-flow-local-v1";

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}

function signingSecret() {
  const value = process.env.APPROVAL_SIGNING_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("APPROVAL_SIGNING_SECRET must contain at least 32 characters.");
  return process.env.SESSION_SECRET ?? "development-only-approval-signing-secret";
}

export function revisionDigest(revision: { version: number; subject: string; summary: string; body: string | null; classification: string; priority: string; senderReference: string | null; dueAt: Date | null; attachments: unknown }) {
  const canonical = JSON.stringify({ version: revision.version, subject: revision.subject, summary: revision.summary, body: revision.body, classification: revision.classification, priority: revision.priority, senderReference: revision.senderReference, dueAt: revision.dueAt?.toISOString() ?? null, attachments: revision.attachments });
  return createHash("sha256").update(canonical).digest("hex");
}

export function signApprovalPayload(payload: Record<string, unknown>) {
  return createHmac("sha256", signingSecret()).update(stableStringify(payload)).digest("hex");
}

export function verifyApprovalSignature(signature: { canonicalPayload: unknown; signatureValue: string; documentDigest: string; revision?: Parameters<typeof revisionDigest>[0] | null }) {
  if (!signature.canonicalPayload || typeof signature.canonicalPayload !== "object" || Array.isArray(signature.canonicalPayload)) return false;
  const expected = signApprovalPayload(signature.canonicalPayload as Record<string, unknown>);
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(signature.signatureValue, "hex");
  const payloadDigest = (signature.canonicalPayload as Record<string, unknown>).documentDigest;
  const revisionMatches = !signature.revision || revisionDigest(signature.revision) === signature.documentDigest;
  return payloadDigest === signature.documentDigest && revisionMatches && expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}
