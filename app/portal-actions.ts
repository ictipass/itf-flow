"use server";

import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActorType, ClarificationStatus, CorrespondenceStatus, CorrespondenceType, IntakeSource, PortalSecurityEventType, Priority, Classification } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createExternalSession, destroyExternalSession, requireExternalAccount } from "@/lib/external-session";
import { createReferenceNumber } from "@/lib/reference";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function context() { const h = await headers(); return { ipAddress: (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local").slice(0, 120), userAgent: (h.get("user-agent") ?? "unknown").slice(0, 500) }; }
async function limited(emailHash: string, ipAddress: string, type: PortalSecurityEventType, minutes: number, max: number) { const since = new Date(Date.now() - minutes * 60_000); return await db.portalSecurityEvent.count({ where: { type, createdAt: { gte: since }, OR: [{ emailHash }, { ipAddress }] } }) >= max; }

export async function portalRegisterAction(formData: FormData) {
  const email = z.email().parse(String(formData.get("email") ?? "").trim().toLowerCase()); const ctx = await context(); const emailHash = hash(email);
  if (await limited(emailHash, ctx.ipAddress, PortalSecurityEventType.REGISTERED, 60, 5)) redirect("/portal/register?status=received");
  const name = String(formData.get("name") ?? "").trim(); const organizationName = String(formData.get("organizationName") ?? "").trim(); const password = String(formData.get("password") ?? "");
  if (name.length < 2 || organizationName.length < 2 || password.length < 12) redirect("/portal/register?error=validation");
  const existing = await db.externalAccount.findUnique({ where: { email } });
  await db.portalSecurityEvent.create({ data: { emailHash, ipAddress: ctx.ipAddress, type: PortalSecurityEventType.REGISTERED } });
  if (!existing) {
    const raw = randomBytes(32).toString("base64url"); const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction(async (tx) => { const organization = await tx.externalOrganization.create({ data: { name: organizationName, contactName: name, email, phone: String(formData.get("phone") ?? "") || null } }); const account = await tx.externalAccount.create({ data: { email, name, phone: String(formData.get("phone") ?? "") || null, passwordHash, memberships: { create: { organizationId: organization.id, role: "OWNER" } } } }); const verification = await tx.externalEmailVerificationToken.create({ data: { accountId: account.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } }); const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/portal/verify?token=${encodeURIComponent(raw)}`; await tx.emailOutbox.create({ data: { idempotencyKey: `external-verification:${verification.id}`, toAddress: email, subject: "Verify your ITF stakeholder portal account", textBody: `Verify your account within 24 hours:\n\n${url}\n\nIf you did not request this, ignore this message.`, sourceType: "EXTERNAL_VERIFICATION", sourceId: verification.id } }); });
  } else if (!existing.verifiedAt && existing.isActive) {
    const raw = randomBytes(32).toString("base64url");
    await db.$transaction(async (tx) => { await tx.externalEmailVerificationToken.updateMany({ where: { accountId: existing.id, usedAt: null }, data: { usedAt: new Date() } }); const verification = await tx.externalEmailVerificationToken.create({ data: { accountId: existing.id, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } }); const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/portal/verify?token=${encodeURIComponent(raw)}`; await tx.emailOutbox.create({ data: { idempotencyKey: `external-verification:${verification.id}`, toAddress: email, subject: "Verify your ITF stakeholder portal account", textBody: `Verify your account within 24 hours:\n\n${url}\n\nIf you did not request this, ignore this message.`, sourceType: "EXTERNAL_VERIFICATION", sourceId: verification.id } }); });
  }
  redirect("/portal/register?status=received");
}

export async function portalLoginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase(); const password = String(formData.get("password") ?? ""); const ctx = await context(); const emailHash = hash(email);
  if (await limited(emailHash, ctx.ipAddress, PortalSecurityEventType.LOGIN_FAILED, 15, 10)) redirect("/portal/login?error=locked");
  const account = await db.externalAccount.findUnique({ where: { email } }); const valid = Boolean(account?.isActive && account.verifiedAt && await bcrypt.compare(password, account.passwordHash));
  await db.portalSecurityEvent.create({ data: { emailHash, ipAddress: ctx.ipAddress, type: valid ? PortalSecurityEventType.LOGIN_SUCCEEDED : PortalSecurityEventType.LOGIN_FAILED } });
  if (!valid || !account) redirect("/portal/login?error=credentials"); await createExternalSession(account.id); redirect("/portal");
}
export async function portalLogoutAction() { await destroyExternalSession(); redirect("/portal/login"); }

export async function portalSubmitAction(formData: FormData) {
  const account = await requireExternalAccount(); const organizationId = String(formData.get("organizationId") ?? ""); if (!account.memberships.some((m) => m.organizationId === organizationId)) throw new Error("Invalid organization.");
  const since = new Date(Date.now() - 24 * 60 * 60_000); if (await db.correspondence.count({ where: { submittedByExternalAccountId: account.id, receivedAt: { gte: since } } }) >= 10) throw new Error("Daily submission limit reached.");
  const subject = String(formData.get("subject") ?? "").trim(); const summary = String(formData.get("summary") ?? "").trim(); if (subject.length < 5 || summary.length < 10) throw new Error("Complete the subject and summary."); const ctx = await context();
  const priority = z.enum([Priority.ROUTINE, Priority.URGENT]).parse(formData.get("priority") ?? Priority.ROUTINE);
  const record = await db.$transaction(async (tx) => { const count = await tx.correspondence.count({ where: { referenceNumber: { startsWith: `ITF/FLOW/${new Date().getFullYear()}/` } } }); const created = await tx.correspondence.create({ data: { referenceNumber: createReferenceNumber(count + 1), type: CorrespondenceType.INCOMING_LETTER, classification: Classification.PUBLIC, priority, status: CorrespondenceStatus.SUBMITTED, intakeSource: IntakeSource.PORTAL, subject, summary, body: String(formData.get("body") ?? "").trim() || null, senderName: account.name, senderReference: String(formData.get("senderReference") ?? "").trim() || null, externalOrganizationId: organizationId, submittedByExternalAccountId: account.id } }); await tx.correspondenceEvent.create({ data: { correspondenceId: created.id, actorType: ActorType.EXTERNAL, type: "SUBMITTED", toStatus: CorrespondenceStatus.SUBMITTED, minute: "Submitted through the authenticated stakeholder portal.", metadata: { externalAccountId: account.id, organizationId }, ...ctx } }); await tx.portalSecurityEvent.create({ data: { emailHash: hash(account.email), ipAddress: ctx.ipAddress, type: PortalSecurityEventType.SUBMISSION_CREATED } }); return created; }); redirect(`/portal/submissions/${record.id}`);
}

export async function portalRespondClarificationAction(formData: FormData) { const account = await requireExternalAccount(); const id = String(formData.get("clarificationId") ?? ""); const response = String(formData.get("response") ?? "").trim(); if (response.length < 5) throw new Error("Provide a clear response."); const request = await db.clarificationRequest.findFirst({ where: { id, status: ClarificationStatus.OPEN, correspondence: { externalOrganization: { memberships: { some: { accountId: account.id } } } } } }); if (!request) throw new Error("Clarification is unavailable."); await db.$transaction([db.clarificationRequest.update({ where: { id }, data: { response, status: ClarificationStatus.RESPONDED, respondedAt: new Date(), respondedByExternalAccountId: account.id } }), db.portalSecurityEvent.create({ data: { emailHash: hash(account.email), ipAddress: (await context()).ipAddress, type: PortalSecurityEventType.CLARIFICATION_RESPONDED } })]); redirect(`/portal/submissions/${request.correspondenceId}`); }
