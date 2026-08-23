import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IntegrationEventType, StaffAuthenticationMethod } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { effectiveSessionExpiry } from "@/lib/session-policy";

const COOKIE_NAME = "itf_flow_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;

type SessionPayload = { userId: string; sessionId: string; expiresAt: number };

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return "development-only-session-secret-change-me";
}
const sign = (value: string) => createHmac("sha256", getSecret()).update(value).digest("base64url");
function makeToken(payload: SessionPayload) { const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${encoded}.${sign(encoded)}`; }
function readToken(value: string): SessionPayload | null { const [encoded, signature] = value.split("."); if (!encoded || !signature) return null; const expected = sign(encoded); const a = Buffer.from(signature); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null; try { const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload; return payload.expiresAt > Date.now() && Boolean(payload.sessionId && payload.userId) ? payload : null; } catch { return null; } }

export async function createSession(userId: string, options: { authenticationMethod?: StaffAuthenticationMethod; identityProvider?: string; workspaceSessionId?: string; upstreamExpiresAt?: Date; mfaAuthenticatedAt?: Date; correlationId?: string } = {}) {
  const now = new Date();
  const expiresAt = effectiveSessionExpiry(now, MAX_AGE_SECONDS, options.upstreamExpiresAt);
  const correlationId = options.correlationId ?? randomUUID();
  const session = await db.$transaction(async (tx) => {
    const configuredStepUpSeconds = Number(process.env.WORKSPACE_MFA_STEP_UP_SECONDS ?? "600");
    const stepUpSeconds = Number.isInteger(configuredStepUpSeconds) && configuredStepUpSeconds >= 60 && configuredStepUpSeconds <= 3600 ? configuredStepUpSeconds : 600;
    const recentMfa = options.mfaAuthenticatedAt && options.mfaAuthenticatedAt.getTime() > Date.now() - stepUpSeconds * 1000;
    const created = await tx.staffSession.create({ data: { userId, authenticationMethod: options.authenticationMethod ?? StaffAuthenticationMethod.LOCAL_PASSWORD, identityProvider: options.identityProvider, workspaceSessionId: options.workspaceSessionId, mfaAuthenticatedAt: options.mfaAuthenticatedAt, stepUpUntil: recentMfa ? new Date(options.mfaAuthenticatedAt!.getTime() + stepUpSeconds * 1000) : undefined, expiresAt } });
    await tx.integrationEvent.create({ data: { eventId: randomUUID(), correlationId, source: "itf-flow", type: IntegrationEventType.SESSION_CREATED, userId, sessionId: created.id, metadata: { authenticationMethod: created.authenticationMethod, identityProvider: created.identityProvider, mfa: Boolean(created.mfaAuthenticatedAt), expiresAt: created.expiresAt.toISOString(), upstreamExpiresAt: options.upstreamExpiresAt?.toISOString() } } });
    return created;
  });
  const maxAge = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
  (await cookies()).set(COOKIE_NAME, makeToken({ userId, sessionId: session.id, expiresAt: expiresAt.getTime() }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return session;
}

async function currentSession() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = value ? readToken(value) : null;
  if (!payload) return null;
  const configuredIdleMinutes = Number(process.env.STAFF_SESSION_IDLE_MINUTES ?? "30");
  const idleMinutes = Number.isFinite(configuredIdleMinutes) ? Math.max(5, configuredIdleMinutes) : 30;
  const session = await db.staffSession.findFirst({ where: { id: payload.sessionId, userId: payload.userId, revokedAt: null, expiresAt: { gt: new Date() }, lastSeenAt: { gt: new Date(Date.now() - idleMinutes * 60_000) }, user: { isActive: true } }, include: { user: true } });
  if (session && session.lastSeenAt < new Date(Date.now() - 5 * 60_000)) await db.staffSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return session;
}

export async function elevateSession(userId: string) { const session = await currentSession(); if (!session || session.userId !== userId) throw new Error("Active session required."); await db.staffSession.update({ where: { id: session.id }, data: { stepUpUntil: new Date(Date.now() + 15 * 60_000) } }); }
export async function hasActiveStepUp() { const session = await currentSession(); return Boolean(session?.stepUpUntil && session.stepUpUntil > new Date()); }
export async function hasActiveEnterpriseMfa() {
  const session = await currentSession();
  return Boolean(session?.stepUpUntil && session.stepUpUntil > new Date() && session.mfaAuthenticatedAt && session.authenticationMethod !== StaffAuthenticationMethod.LOCAL_PASSWORD);
}
export async function destroySession(reason = "User signed out") { const session = await currentSession(); if (session) await db.$transaction([db.staffSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), revocationReason: reason } }), db.integrationEvent.create({ data: { eventId: randomUUID(), correlationId: randomUUID(), source: "itf-flow", type: IntegrationEventType.SESSION_REVOKED, userId: session.userId, sessionId: session.id, metadata: { reason } } })]); (await cookies()).delete(COOKIE_NAME); }
export async function getCurrentUser() { return (await currentSession())?.user ?? null; }
export async function requireUser() { const user = await getCurrentUser(); if (!user) redirect("/login"); return user; }
