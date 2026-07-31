"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  ActorType,
  Classification,
  CorrespondenceStatus,
  CorrespondenceType,
  EventType,
  IntakeSource,
  Priority,
  RecipientKind,
  UserRole,
  WorkItemStatus,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { storeDocument } from "@/lib/document-storage";
import { createReferenceNumber } from "@/lib/reference";
import { canMinute, canOriginate, canRegister } from "@/lib/permissions";
import { actionRecipientsFollowReportingLine } from "@/lib/reporting-lines";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { syncMailbox, verifyMailConnections } from "@/lib/mail-sync";

const correspondenceSchema = z.object({
  type: z.enum(CorrespondenceType),
  classification: z.enum(Classification),
  priority: z.enum(Priority),
  subject: z.string().trim().min(5).max(250),
  summary: z.string().trim().min(10).max(2000),
  body: z.string().trim().max(20000).optional(),
  senderName: z.string().trim().min(2).max(200),
  senderReference: z.string().trim().max(100).optional(),
  dueAt: z.string().optional(),
});

async function requestContext() {
  const values = await headers();
  return {
    ipAddress: values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
    userAgent: values.get("user-agent") ?? "unknown",
  };
}

function mailFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const values = typeof error === "object" && error
    ? error as Record<string, unknown>
    : {};
  const details = [
    values.code,
    values.responseStatus,
    values.responseText,
    values.responseCode,
    values.command,
  ].map(String).join(" ").toLowerCase();
  const combined = `${message} ${details}`;
  if (combined.includes("auth") || combined.includes("login") || combined.includes("535")) {
    return "authentication";
  }
  if (combined.includes("timeout") || combined.includes("timed out")) return "timeout";
  if (combined.includes("certificate") || combined.includes("tls")) return "tls";
  if (combined.includes("mailbox") || combined.includes("folder")) return "folder";
  return "unknown";
}

async function persistAttachment(file: File, correspondenceId: string) {
  if (!file.size) return null;
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Portal attachments cannot exceed 10 MB.");
  }
  return storeDocument({
    correspondenceId,
    originalName: file.name,
    mimeType: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
  });
}

async function nextReference(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  const year = new Date().getFullYear();
  const count = await tx.correspondence.count({
    where: { referenceNumber: { startsWith: `ITF/FLOW/${year}/` } },
  });
  return createReferenceNumber(count + 1);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findFirst({ where: { email, isActive: true } });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?error=credentials");
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function syncMailboxAction() {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You cannot synchronize the Secretariat mailbox.");
  let destination: string;
  try {
    const result = await syncMailbox();
    destination = `/intake?mail=success&imported=${result.importedCount}&skipped=${result.skippedCount}`;
  } catch (error) {
    destination = `/intake?mail=failed&reason=${mailFailureReason(error)}`;
  }
  redirect(destination);
}

export async function testMailConnectionAction() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) {
    throw new Error("Only a system administrator can test mail-server credentials.");
  }
  let destination: string;
  try {
    await verifyMailConnections();
    destination = "/intake?mail=connected";
  } catch (error) {
    destination = `/intake?mail=connection-failed&reason=${mailFailureReason(error)}`;
  }
  redirect(destination);
}

export async function externalSubmitAction(formData: FormData) {
  const parsed = correspondenceSchema.safeParse({
    type: CorrespondenceType.INCOMING_LETTER,
    classification: formData.get("classification"),
    priority: formData.get("priority"),
    subject: formData.get("subject"),
    summary: formData.get("summary"),
    body: formData.get("body") || undefined,
    senderName: formData.get("contactName"),
    senderReference: formData.get("senderReference") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!parsed.success || organizationName.length < 2 || !z.email().safeParse(email).success) {
    redirect("/submit?error=validation");
  }
  const context = await requestContext();
  const correspondence = await db.$transaction(async (tx) => {
    const organization = await tx.externalOrganization.create({
      data: {
        name: organizationName,
        contactName: parsed.data.senderName,
        email,
        phone: String(formData.get("phone") ?? "") || null,
        address: String(formData.get("address") ?? "") || null,
      },
    });
    const record = await tx.correspondence.create({
      data: {
        ...parsed.data,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        referenceNumber: await nextReference(tx),
        externalOrganizationId: organization.id,
        intakeSource: IntakeSource.PORTAL,
      },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: record.id,
        actorType: ActorType.EXTERNAL,
        type: EventType.SUBMITTED,
        toStatus: CorrespondenceStatus.SUBMITTED,
        minute: "Submitted through the external correspondence portal.",
        metadata: { organizationName, email },
        ...context,
      },
    });
    return record;
  });
  const file = formData.get("attachment");
  if (file instanceof File && file.size) {
    const stored = await persistAttachment(file, correspondence.id);
    if (stored) await db.attachment.create({ data: { correspondenceId: correspondence.id, ...stored } });
  }
  redirect(`/submitted?reference=${encodeURIComponent(correspondence.referenceNumber)}`);
}

export async function registerCorrespondenceAction(formData: FormData) {
  const user = await requireUser();
  if (!canOriginate(user.role)) throw new Error("You cannot raise correspondence.");
  const parsed = correspondenceSchema.parse({
    type: formData.get("type"),
    classification: formData.get("classification"),
    priority: formData.get("priority"),
    subject: formData.get("subject"),
    summary: formData.get("summary"),
    body: formData.get("body") || undefined,
    senderName: formData.get("senderName"),
    senderReference: formData.get("senderReference") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });
  const isSecretariatIntake =
    canRegister(user.role) && parsed.type === CorrespondenceType.INCOMING_LETTER;
  const actionRecipientIds = formData
    .getAll("actionRecipientIds")
    .map(String)
    .filter(Boolean);
  const copyRecipientIds = formData
    .getAll("copyRecipientIds")
    .map(String)
    .filter(Boolean)
    .filter((id) => !actionRecipientIds.includes(id));
  const actionRecipients = isSecretariatIntake
    ? await db.user.findMany({ where: { role: UserRole.DG, isActive: true }, take: 1 })
    : await db.user.findMany({
        where: { id: { in: actionRecipientIds }, isActive: true },
        orderBy: { hierarchyLevel: "desc" },
      });
  const copyRecipients = await db.user.findMany({
    where: { id: { in: copyRecipientIds }, isActive: true },
    orderBy: { name: "asc" },
  });

  if (
    !actionRecipients.length ||
    (!isSecretariatIntake &&
      actionRecipients.length !== new Set(actionRecipientIds).size) ||
    copyRecipients.length !== new Set(copyRecipientIds).size
  ) {
    throw new Error("Select at least one valid recipient.");
  }

  if (
    !isSecretariatIntake &&
    !(await actionRecipientsFollowReportingLine({
      actorId: user.id,
      actorRole: user.role,
      recipientIds: actionRecipients.map((recipient) => recipient.id),
    }))
  ) {
    throw new Error("New correspondence must follow the formal communication hierarchy.");
  }

  const instruction = String(formData.get("instruction") ?? "").trim();
  const context = await requestContext();
  const record = await db.$transaction(async (tx) => {
    const created = await tx.correspondence.create({
      data: {
        ...parsed,
        dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
        referenceNumber: await nextReference(tx),
        createdById: user.id,
        status:
          actionRecipients[0].role === UserRole.DG
            ? CorrespondenceStatus.WITH_DG
            : CorrespondenceStatus.ASSIGNED,
        currentOwnerId: actionRecipients[0].id,
      },
    });
    await tx.workItem.createMany({
      data: [
        ...actionRecipients.map((recipient) => ({
          correspondenceId: created.id,
          assigneeId: recipient.id,
          kind: RecipientKind.ACTION,
          instruction: instruction || "For attention and necessary action.",
          dueAt: created.dueAt,
        })),
        ...copyRecipients.map((recipient) => ({
          correspondenceId: created.id,
          assigneeId: recipient.id,
          kind: RecipientKind.COPY,
          instruction: "For your information.",
          dueAt: created.dueAt,
        })),
      ],
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: created.id,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.REGISTERED,
        toStatus: created.status,
        minute: isSecretariatIntake
          ? "Registered by the DG Secretariat and submitted to the DG."
          : instruction || "Raised internally and routed through the formal hierarchy.",
        metadata: {
          actionRecipientIds: actionRecipients.map((recipient) => recipient.id),
          copyRecipientIds: copyRecipients.map((recipient) => recipient.id),
        },
        ...context,
      },
    });
    return created;
  });
  const file = formData.get("attachment");
  if (file instanceof File && file.size) {
    const stored = await persistAttachment(file, record.id);
    if (stored) await db.attachment.create({ data: { correspondenceId: record.id, ...stored } });
  }
  redirect(`/correspondence/${record.id}`);
}

export async function acceptExternalSubmissionAction(formData: FormData) {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You cannot register correspondence.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const dg = await db.user.findFirst({ where: { role: UserRole.DG, isActive: true } });
  const record = await db.correspondence.findUnique({ where: { id: correspondenceId } });
  if (
    !record ||
    record.status !== CorrespondenceStatus.SUBMITTED ||
    record.claimedById !== user.id ||
    !dg
  ) {
    throw new Error("This submission cannot be registered.");
  }
  await db.$transaction([
    db.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.WITH_DG, currentOwnerId: dg.id },
    }),
    db.workItem.create({
      data: { correspondenceId, assigneeId: dg.id, kind: RecipientKind.ACTION },
    }),
    db.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.REGISTERED,
        fromStatus: CorrespondenceStatus.SUBMITTED,
        toStatus: CorrespondenceStatus.WITH_DG,
        minute: "External submission verified by the DG Secretariat and submitted to the DG.",
        metadata: { recipientIds: [dg.id] },
        ...(await requestContext()),
      },
    }),
  ]);
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function claimIntakeAction(formData: FormData) {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You cannot claim Secretariat intake.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const claimedAt = new Date();
  const result = await db.correspondence.updateMany({
    where: {
      id: correspondenceId,
      status: CorrespondenceStatus.SUBMITTED,
      claimedById: null,
    },
    data: { claimedById: user.id, claimedAt },
  });
  if (result.count !== 1) {
    throw new Error("This correspondence has already been claimed by another secretary.");
  }
  await db.correspondenceEvent.create({
    data: {
      correspondenceId,
      actorId: user.id,
      actorType: ActorType.STAFF,
      type: EventType.CLAIMED,
      minute: `Claimed for Secretariat review by ${user.name}.`,
      metadata: { claimedById: user.id, office: user.office },
      ...(await requestContext()),
    },
  });
  revalidatePath("/intake");
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function releaseIntakeAction(formData: FormData) {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You cannot release Secretariat intake.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const result = await db.correspondence.updateMany({
    where: {
      id: correspondenceId,
      status: CorrespondenceStatus.SUBMITTED,
      claimedById: user.id,
    },
    data: { claimedById: null, claimedAt: null },
  });
  if (result.count !== 1) throw new Error("Only the secretary handling this item can release it.");
  await db.correspondenceEvent.create({
    data: {
      correspondenceId,
      actorId: user.id,
      actorType: ActorType.STAFF,
      type: EventType.RELEASED,
      minute: `Released back to the shared Secretariat queue by ${user.name}.`,
      ...(await requestContext()),
    },
  });
  revalidatePath("/intake");
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function returnToInitiatorAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) throw new Error("Give a clear reason for returning the correspondence.");
  const [record, activeActionItem] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId } }),
    db.workItem.findFirst({
      where: {
        correspondenceId,
        assigneeId: user.id,
        kind: RecipientKind.ACTION,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
    }),
  ]);
  if (!record?.createdById || !activeActionItem) {
    throw new Error("Only the current action recipient can return staff-originated correspondence.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.workItem.updateMany({
      where: {
        correspondenceId,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
      data: { status: WorkItemStatus.CANCELLED, completedAt: new Date() },
    });
    await tx.workItem.create({
      data: {
        correspondenceId,
        assigneeId: record.createdById!,
        kind: RecipientKind.ACTION,
        instruction: reason,
      },
    });
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.RETURNED, currentOwnerId: record.createdById },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.RETURNED,
        fromStatus: record.status,
        toStatus: CorrespondenceStatus.RETURNED,
        minute: reason,
        metadata: { returnedToId: record.createdById, returnedById: user.id },
        ...context,
      },
    });
  });
  revalidatePath("/inbox");
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function resubmitReturnedAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 5) throw new Error("Describe the correction made.");
  const record = await db.correspondence.findUnique({
    where: { id: correspondenceId },
    include: {
      events: {
        where: { type: EventType.RETURNED },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const returnedById = record?.events[0]?.actorId;
  if (
    !record ||
    record.createdById !== user.id ||
    record.status !== CorrespondenceStatus.RETURNED ||
    !returnedById
  ) {
    throw new Error("This correspondence cannot be resubmitted.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.workItem.updateMany({
      where: {
        correspondenceId,
        assigneeId: user.id,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
      data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
    });
    await tx.workItem.create({
      data: {
        correspondenceId,
        assigneeId: returnedById,
        kind: RecipientKind.ACTION,
        instruction: note,
      },
    });
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.ASSIGNED, currentOwnerId: returnedById },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.RESUBMITTED,
        fromStatus: CorrespondenceStatus.RETURNED,
        toStatus: CorrespondenceStatus.ASSIGNED,
        minute: note,
        metadata: { resubmittedToId: returnedById },
        ...context,
      },
    });
  });
  revalidatePath("/inbox");
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function routeCorrespondenceAction(formData: FormData) {
  const user = await requireUser();
  if (!canMinute(user.role)) throw new Error("You cannot minute or route correspondence.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const minute = String(formData.get("minute") ?? "").trim();
  const actionRecipientIds = formData
    .getAll("actionRecipientIds")
    .map(String)
    .filter(Boolean);
  const copyRecipientIds = formData
    .getAll("copyRecipientIds")
    .map(String)
    .filter(Boolean)
    .filter((id) => !actionRecipientIds.includes(id));
  if (!correspondenceId || minute.length < 3 || actionRecipientIds.length === 0) {
    throw new Error("A minute and at least one action recipient are required.");
  }
  const [record, currentActionItem, actionRecipients, copyRecipients] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId } }),
    db.workItem.findFirst({
      where: {
        correspondenceId,
        assigneeId: user.id,
        kind: RecipientKind.ACTION,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
    }),
    db.user.findMany({ where: { id: { in: actionRecipientIds }, isActive: true } }),
    db.user.findMany({ where: { id: { in: copyRecipientIds }, isActive: true } }),
  ]);
  if (
    !record ||
    !currentActionItem ||
    actionRecipients.length !== new Set(actionRecipientIds).size ||
    copyRecipients.length !== new Set(copyRecipientIds).size
  ) {
    throw new Error("Invalid routing request.");
  }
  if (
    !(await actionRecipientsFollowReportingLine({
      actorId: user.id,
      actorRole: user.role,
      recipientIds: actionRecipients.map((recipient) => recipient.id),
    }))
  ) {
    throw new Error("Routing must follow the formal communication hierarchy.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.workItem.updateMany({
      where: { correspondenceId, assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
    });
    await tx.workItem.createMany({
      data: [
        ...actionRecipients.map((recipient) => ({
          correspondenceId,
          assigneeId: recipient.id,
          kind: RecipientKind.ACTION,
          instruction: minute,
          dueAt: record.dueAt,
        })),
        ...copyRecipients.map((recipient) => ({
          correspondenceId,
          assigneeId: recipient.id,
          kind: RecipientKind.COPY,
          instruction: "For your information.",
          dueAt: record.dueAt,
        })),
      ],
    });
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: {
        status: CorrespondenceStatus.ASSIGNED,
        currentOwnerId: actionRecipients[0].id,
      },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.MINUTED,
        fromStatus: record.status,
        toStatus: CorrespondenceStatus.ASSIGNED,
        minute,
        metadata: { actionRecipientIds, copyRecipientIds },
        ...context,
      },
    });
  });
  revalidatePath(`/correspondence/${correspondenceId}`);
  redirect(`/correspondence/${correspondenceId}`);
}

export async function acknowledgeAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  await db.workItem.updateMany({
    where: { correspondenceId, assigneeId: user.id, status: WorkItemStatus.OPEN },
    data: { status: WorkItemStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
  });
  await db.correspondenceEvent.create({
    data: {
      correspondenceId,
      actorId: user.id,
      actorType: ActorType.STAFF,
      type: EventType.ACKNOWLEDGED,
      minute: "Receipt acknowledged.",
      ...(await requestContext()),
    },
  });
  revalidatePath(`/correspondence/${correspondenceId}`);
}

export async function resolveAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const minute = String(formData.get("minute") ?? "").trim();
  if (minute.length < 3) throw new Error("A resolution note is required.");
  const [record, currentActionItem] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId } }),
    db.workItem.findFirst({
      where: {
        correspondenceId,
        assigneeId: user.id,
        kind: RecipientKind.ACTION,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
    }),
  ]);
  if (!record || !currentActionItem) {
    throw new Error("Only a current action recipient can resolve correspondence.");
  }
  await db.$transaction([
    db.workItem.updateMany({
      where: { correspondenceId, assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
    }),
    db.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.RESOLVED },
    }),
    db.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.RESOLVED,
        fromStatus: record.status,
        toStatus: CorrespondenceStatus.RESOLVED,
        minute,
        ...(await requestContext()),
      },
    }),
  ]);
  revalidatePath(`/correspondence/${correspondenceId}`);
}
