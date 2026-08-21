"use server";

import { redirect } from "next/navigation";
import { ActorType, ClarificationStatus, EventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { authorityMetadata, workAuthority } from "@/lib/delegations";
import { requireUser } from "@/lib/session";

export async function requestStakeholderClarificationAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 10 || question.length > 4000) throw new Error("Clarification must be between 10 and 4,000 characters.");
  const [record, authority] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId }, include: { externalOrganization: { include: { memberships: { include: { account: true } } } } } }),
    workAuthority({ correspondenceId, actor: user }),
  ]);
  if (!record?.submittedByExternalAccountId || !record.externalOrganization || !authority) throw new Error("You are not authorized to request clarification for this portal submission.");
  const recipients = record.externalOrganization.memberships.map((membership) => membership.account).filter((account) => account.isActive && account.verifiedAt);
  if (!recipients.length) throw new Error("The stakeholder organization has no verified portal recipient.");
  await db.$transaction(async (tx) => {
    const clarification = await tx.clarificationRequest.create({ data: { correspondenceId, requestedById: user.id, question } });
    await tx.correspondenceEvent.create({ data: { correspondenceId, actorId: user.id, actorType: ActorType.STAFF, type: EventType.COMMENTED, minute: "Clarification requested from the authenticated external stakeholder.", metadata: { clarificationId: clarification.id, ...authorityMetadata(authority) } } });
    for (const recipient of recipients) await tx.emailOutbox.create({ data: { idempotencyKey: `stakeholder-clarification:${clarification.id}:${recipient.id}`, toAddress: recipient.email, subject: `Action required for ITF correspondence ${record.referenceNumber}`, textBody: `A clarification response is required for ${record.referenceNumber}.\n\n${question}\n\nSign in to the ITF stakeholder portal to respond securely. Do not reply to this email with sensitive information.`, sourceType: "STAKEHOLDER_CLARIFICATION", sourceId: clarification.id } });
  });
  redirect(`/correspondence/${correspondenceId}`);
}

export async function closeStakeholderClarificationAction(formData: FormData) {
  const user = await requireUser();
  const clarificationId = String(formData.get("clarificationId") ?? "");
  const request = await db.clarificationRequest.findUnique({ where: { id: clarificationId } });
  if (!request || request.status !== ClarificationStatus.RESPONDED) throw new Error("Only a responded clarification can be closed.");
  const authority = await workAuthority({ correspondenceId: request.correspondenceId, actor: user });
  if (!authority) throw new Error("You are not authorized to close this clarification.");
  await db.$transaction([
    db.clarificationRequest.update({ where: { id: clarificationId }, data: { status: ClarificationStatus.CLOSED, closedAt: new Date() } }),
    db.correspondenceEvent.create({ data: { correspondenceId: request.correspondenceId, actorId: user.id, actorType: ActorType.STAFF, type: EventType.COMMENTED, minute: "External stakeholder clarification reviewed and closed.", metadata: { clarificationId, ...authorityMetadata(authority) } } }),
  ]);
  redirect(`/correspondence/${request.correspondenceId}`);
}
