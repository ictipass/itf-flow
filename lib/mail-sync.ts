import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import {
  ActorType,
  Classification,
  CorrespondenceStatus,
  CorrespondenceType,
  EventType,
  IntakeSource,
  Priority,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { storeDocument } from "@/lib/document-storage";
import { getMailConfiguration, isMailEnabled } from "@/lib/mail-config";
import { createReferenceNumber } from "@/lib/reference";
import { captureRevision } from "@/lib/revisions";

function addresses(
  value:
    | { value?: Array<{ address?: string }> }
    | Array<{ value?: Array<{ address?: string }> }>
    | undefined,
) {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.flatMap((entry) => entry.value ?? []).flatMap((entry) => entry.address ? [entry.address.toLowerCase()] : []);
}

export async function verifyMailConnections() {
  const config = getMailConfiguration();
  const imap = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    logger: false,
  });
  await imap.connect();
  await imap.logout();

  const smtp = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  await smtp.verify();
}

export async function syncMailbox() {
  if (!isMailEnabled()) throw new Error("Mailbox synchronization is disabled.");
  const config = getMailConfiguration();
  const run = await db.mailboxSyncRun.create({
    data: { mailbox: config.username, status: "RUNNING" },
  });
  let importedCount = 0;
  let skippedCount = 0;
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.folder);
    try {
      const uidValidity = client.mailbox ? client.mailbox.uidValidity.toString() : "unknown";
      for await (const message of client.fetch(
        { seen: false },
        { uid: true, source: true, envelope: true, internalDate: true },
      )) {
        if (!message.source || message.source.length > config.maximumMessageBytes) {
          skippedCount += 1;
          continue;
        }
        const parsed = await simpleParser(message.source);
        const messageId = parsed.messageId?.trim() || null;
        const duplicate = await db.emailMessage.findFirst({
          where: {
            OR: [
              { mailbox: config.username, folder: config.folder, uidValidity, uid: message.uid },
              ...(messageId ? [{ messageId }] : []),
            ],
          },
          select: { id: true },
        });
        if (duplicate) {
          skippedCount += 1;
          continue;
        }

        const fromAddress = addresses(parsed.from)[0] ?? "unknown@external.invalid";
        const fromName = parsed.from?.value[0]?.name?.trim() || fromAddress;
        const subject = parsed.subject?.trim() || "(No subject)";
        const body = parsed.text?.trim().slice(0, 20000) || "Email received without a plain-text body.";
        const receivedAt = message.internalDate ?? parsed.date ?? new Date();
        const correspondence = await db.$transaction(async (tx) => {
          const count = await tx.correspondence.count({
            where: { referenceNumber: { startsWith: `ITF/FLOW/${new Date().getFullYear()}/` } },
          });
          const organization = await tx.externalOrganization.create({
            data: {
              name: fromAddress.split("@")[1] ?? "External email sender",
              contactName: fromName,
              email: fromAddress,
            },
          });
          const record = await tx.correspondence.create({
            data: {
              referenceNumber: createReferenceNumber(count + 1),
              type: CorrespondenceType.INCOMING_LETTER,
              classification: Classification.PUBLIC,
              priority: Priority.ROUTINE,
              status: CorrespondenceStatus.SUBMITTED,
              intakeSource: IntakeSource.EMAIL,
              subject: subject.slice(0, 250),
              summary: body.slice(0, 2000),
              body,
              senderName: fromName,
              senderReference: messageId,
              receivedAt,
              externalOrganizationId: organization.id,
              emailMessage: {
                create: {
                  mailbox: config.username,
                  folder: config.folder,
                  uidValidity,
                  uid: message.uid,
                  messageId,
                  fromAddress,
                  toAddresses: addresses(parsed.to),
                  ccAddresses: addresses(parsed.cc),
                  sentAt: parsed.date,
                },
              },
            },
          });
          await tx.correspondenceEvent.create({
            data: {
              correspondenceId: record.id,
              actorType: ActorType.SYSTEM,
              type: EventType.EMAIL_IMPORTED,
              toStatus: CorrespondenceStatus.SUBMITTED,
              minute: `Imported from ${config.username} for Secretariat review.`,
              metadata: { messageId, uid: message.uid, mailbox: config.username },
            },
          });
          return record;
        });

        for (const attachment of parsed.attachments) {
          try {
            const stored = await storeDocument({
              correspondenceId: correspondence.id,
              originalName: attachment.filename || "email-attachment",
              mimeType: attachment.contentType,
              bytes: attachment.content,
            });
            await db.attachment.create({
              data: { correspondenceId: correspondence.id, ...stored, documentEvents: { create: { type: "QUARANTINED", detail: "Mailbox attachment stored in quarantine." } } },
            });
          } catch {
            // Unsupported, oversized, or unsafe attachments are not persisted.
            // The email remains available for Secretariat review and audit.
          }
        }
        await db.$transaction((tx) => captureRevision(
          tx,
          correspondence.id,
          null,
          "Initial email import.",
        ));
        importedCount += 1;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await db.mailboxSyncRun.update({
      where: { id: run.id },
      data: { status: "COMPLETED", importedCount, skippedCount, completedAt: new Date() },
    });
    return { importedCount, skippedCount };
  } catch (error) {
    if (client.usable) await client.logout().catch(() => undefined);
    await db.mailboxSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        importedCount,
        skippedCount,
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown synchronization error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
