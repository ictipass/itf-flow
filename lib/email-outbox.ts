import nodemailer from "nodemailer";
import { EmailOutboxStatus } from "@/lib/generated/prisma/client";
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
      await db.$transaction([
        db.emailOutbox.update({ where: { id: candidate.id }, data: { status: EmailOutboxStatus.SENT, sentAt: new Date(), lockedAt: null, lastErrorCode: null } }),
        db.emailDeliveryAttempt.create({ data: { outboxId: candidate.id, attempt, successful: true } }),
      ]);
      sent += 1;
    } catch (error) {
      const code = errorCode(error);
      const dead = attempt >= candidate.maxAttempts;
      const retryMinutes = Math.min(2 ** attempt, 60);
      await db.$transaction([
        db.emailOutbox.update({ where: { id: candidate.id }, data: { status: dead ? EmailOutboxStatus.DEAD_LETTER : EmailOutboxStatus.FAILED, lockedAt: null, lastErrorCode: code, nextAttemptAt: new Date(Date.now() + retryMinutes * 60_000) } }),
        db.emailDeliveryAttempt.create({ data: { outboxId: candidate.id, attempt, successful: false, errorCode: code } }),
      ]);
      failed += 1;
    }
  }
  return { considered: candidates.length, sent, failed };
}
