import nodemailer from "nodemailer";
import { ActorType, DispatchStatus, EmailOutboxStatus, EventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getMailConfiguration, isMailEnabled } from "@/lib/mail-config";

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const value = error as Record<string, unknown>;
  return String(value.code ?? value.responseCode ?? "UNKNOWN").slice(0, 80);
}

export async function processEmailOutbox(limit = 20) {
  if (!isMailEnabled()) throw new Error("Mailbox delivery is disabled.");
  const config = getMailConfiguration();
  const transport = nodemailer.createTransport({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
  });
  const candidates = await db.emailOutbox.findMany({
    where: { OR: [
      { status: { in: [EmailOutboxStatus.QUEUED, EmailOutboxStatus.FAILED] }, nextAttemptAt: { lte: new Date() } },
      { status: EmailOutboxStatus.PROCESSING, lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    ] },
    orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 100),
  });
  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const claimed = await db.emailOutbox.updateMany({
      where: { id: candidate.id, status: candidate.status, attemptCount: candidate.attemptCount },
      data: { status: EmailOutboxStatus.PROCESSING, lockedAt: new Date(), attemptCount: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    const attempt = candidate.attemptCount + 1;
    try {
      await transport.sendMail({ from: config.username, to: candidate.toAddress, subject: candidate.subject, text: candidate.textBody });
      const acceptedAt = new Date();
      await db.$transaction(async (tx) => {
        await tx.emailOutbox.update({ where: { id: candidate.id }, data: { status: EmailOutboxStatus.SENT, sentAt: acceptedAt, lockedAt: null, lastErrorCode: null } });
        await tx.emailDeliveryAttempt.create({ data: { outboxId: candidate.id, attempt, successful: true } });
        if (candidate.sourceType === "OFFICIAL_EMAIL_DISPATCH") {
          const dispatch = await tx.dispatchRecord.findUnique({ where: { id: candidate.sourceId }, include: { correspondence: true } });
          if (dispatch && dispatch.status !== DispatchStatus.DISPATCHED && dispatch.status !== DispatchStatus.DELIVERED) {
            await tx.dispatchRecord.update({ where: { id: dispatch.id }, data: { status: DispatchStatus.DISPATCHED, dispatchedAt: acceptedAt, failedAt: null } });
            await tx.correspondenceEvent.create({ data: {
              correspondenceId: dispatch.correspondenceId, actorType: ActorType.SYSTEM, type: EventType.DISPATCHED,
              fromStatus: dispatch.correspondence.status, toStatus: dispatch.correspondence.status,
              minute: `${dispatch.outgoingReference} accepted by the configured SMTP server.`,
              metadata: { dispatchId: dispatch.id, outgoingReference: dispatch.outgoingReference, channel: dispatch.channel, dispatchStatus: DispatchStatus.DISPATCHED, smtpAccepted: true },
            } });
          }
        }
      });
      sent += 1;
    } catch (error) {
      const code = errorCode(error);
      const dead = attempt >= candidate.maxAttempts;
      const retryMinutes = Math.min(2 ** attempt, 60);
      await db.$transaction(async (tx) => {
        await tx.emailOutbox.update({ where: { id: candidate.id }, data: { status: dead ? EmailOutboxStatus.DEAD_LETTER : EmailOutboxStatus.FAILED, lockedAt: null, lastErrorCode: code, nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000) } });
        await tx.emailDeliveryAttempt.create({ data: { outboxId: candidate.id, attempt, successful: false, errorCode: code } });
        if (candidate.sourceType === "OFFICIAL_EMAIL_DISPATCH") {
          const dispatch = await tx.dispatchRecord.findUnique({ where: { id: candidate.sourceId }, include: { correspondence: true } });
          if (dispatch) await tx.correspondenceEvent.create({ data: {
            correspondenceId: dispatch.correspondenceId, actorType: ActorType.SYSTEM, type: EventType.DELIVERY_FAILED,
            fromStatus: dispatch.correspondence.status, toStatus: dispatch.correspondence.status,
            minute: dead ? "Automated email dispatch reached the maximum delivery attempts." : "Automated email dispatch failed and is scheduled for retry.",
            metadata: { dispatchId: dispatch.id, outgoingReference: dispatch.outgoingReference, attempt, deadLetter: dead, errorCode: code },
          } });
        }
      });
      failed += 1;
    }
  }
  return { considered: candidates.length, sent, failed };
}

export async function retryEmailOutbox(outboxId: string, reason: string, actorId: string) {
  const item = await db.emailOutbox.findUnique({ where: { id: outboxId } });
  if (!item || (item.status !== EmailOutboxStatus.FAILED && item.status !== EmailOutboxStatus.DEAD_LETTER)) {
    throw new Error("Only failed or dead-letter messages can be retried.");
  }
  await db.$transaction(async (tx) => {
    await tx.emailOutbox.update({ where: { id: item.id }, data: { status: EmailOutboxStatus.QUEUED, maxAttempts: { increment: 5 }, nextAttemptAt: new Date(), lockedAt: null, lastErrorCode: null } });
    if (item.sourceType === "OFFICIAL_EMAIL_DISPATCH") {
      const dispatch = await tx.dispatchRecord.findUnique({ where: { id: item.sourceId }, include: { correspondence: true } });
      if (dispatch) await tx.correspondenceEvent.create({ data: {
        correspondenceId: dispatch.correspondenceId, actorId, actorType: ActorType.STAFF, type: EventType.COMMENTED,
        fromStatus: dispatch.correspondence.status, toStatus: dispatch.correspondence.status,
        minute: `Email delivery administratively retried: ${reason}`,
        metadata: { dispatchId: dispatch.id, outboxId: item.id, administrativeRetry: true },
      } });
    }
  });
}
