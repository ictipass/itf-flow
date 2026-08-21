import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE = "itf_flow_external_session";
const MAX_AGE = 8 * 60 * 60;
const secret = () => {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must contain at least 32 characters in production.");
  return "development-only-session-secret-change-me";
};
function sign(value: string) { return createHmac("sha256", secret()).update(`external:${value}`).digest("base64url"); }
function token(accountId: string) { const payload = Buffer.from(JSON.stringify({ accountId, expiresAt: Date.now() + MAX_AGE * 1000 })).toString("base64url"); return `${payload}.${sign(payload)}`; }
function parse(value?: string) { if (!value) return null; const [payload, signature] = value.split("."); if (!payload || !signature) return null; const expected = sign(payload); const a = Buffer.from(signature); const b = Buffer.from(expected); if (a.length !== b.length || !timingSafeEqual(a, b)) return null; try { const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { accountId: string; expiresAt: number }; return data.expiresAt > Date.now() ? data : null; } catch { return null; } }
export async function createExternalSession(accountId: string) { (await cookies()).set(COOKIE, token(accountId), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/portal", maxAge: MAX_AGE }); }
export async function destroyExternalSession() { (await cookies()).delete(COOKIE); }
export async function getExternalAccount() { const data = parse((await cookies()).get(COOKIE)?.value); return data ? db.externalAccount.findFirst({ where: { id: data.accountId, isActive: true, verifiedAt: { not: null } }, include: { memberships: { include: { organization: true } } } }) : null; }
export async function requireExternalAccount() { const account = await getExternalAccount(); if (!account) redirect("/portal/login"); return account; }
