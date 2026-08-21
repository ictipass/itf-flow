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
  DecisionOutcome,
  DuplicateReviewStatus,
  DispatchChannel,
  DispatchStatus,
  EventType,
  IntakeSource,
  NotificationType,
  Priority,
  RecipientKind,
  UserRole,
  WorkPurpose,
  WorkItemStatus,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { storeDocument } from "@/lib/document-storage";
import { createReferenceNumber } from "@/lib/reference";
import { captureRevision } from "@/lib/revisions";
import { canDispatch, canMinute, canOriginate, canReadClassification, canRegister } from "@/lib/permissions";
import { evaluateActionRouting } from "@/lib/reporting-lines";
import { enqueueNotifications } from "@/lib/notifications";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { syncMailbox, verifyMailConnections } from "@/lib/mail-sync";
import { approvalRequired, authorityMetadata, workAuthority } from "@/lib/delegations";
import { APPROVAL_SIGNATURE_ALGORITHM, APPROVAL_SIGNATURE_KEY_ID, revisionDigest, signApprovalPayload, verifyApprovalSignature } from "@/lib/approval-signatures";

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

const draftSchema = z.object({
  type: z.enum(CorrespondenceType),
  classification: z.enum(Classification),
  priority: z.enum(Priority),
  subject: z.string().trim().max(250),
  summary: z.string().trim().max(2000),
  body: z.string().trim().max(20000).optional(),
  senderName: z.string().trim().max(200),
  senderReference: z.string().trim().max(100).optional(),
  dueAt: z.string().optional(),
});

function draftData(formData: FormData) {
  return draftSchema.parse({
    type: formData.get("type"),
    classification: formData.get("classification"),
    priority: formData.get("priority"),
    subject: formData.get("subject") ?? "",
    summary: formData.get("summary") ?? "",
    body: formData.get("body") || undefined,
    senderName: formData.get("senderName") ?? "",
    senderReference: formData.get("senderReference") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });
}

function workPurpose(formData: FormData) {
  const parsed = z.enum(WorkPurpose).safeParse(formData.get("workPurpose") ?? WorkPurpose.ACTION);
  return parsed.success ? parsed.data : WorkPurpose.ACTION;
}

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
  redirect(process.env.NEXT_PUBLIC_WORKSPACE_LOGOUT_URL ?? "/");
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
  await db.$transaction((tx) => captureRevision(tx, correspondence.id, null, "Initial external submission."));
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
  if (!canReadClassification(user.role, parsed.classification)) throw new Error("Your role cannot originate Secret correspondence.");
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

  const instruction = String(formData.get("instruction") ?? "").trim();
  const purpose = isSecretariatIntake ? WorkPurpose.ACTION : workPurpose(formData);
  const routingPolicy = isSecretariatIntake
    ? { permitted: true, isPeerReferral: false }
    : await evaluateActionRouting({
        actorId: user.id,
        actorRole: user.role,
        recipientIds: actionRecipients.map((recipient) => recipient.id),
      });
  if (!routingPolicy.permitted) {
    throw new Error("New correspondence must follow an authorized hierarchy or peer-referral path.");
  }
  if (routingPolicy.isPeerReferral && instruction.length < 10) {
    throw new Error("A peer referral requires a clear purpose of at least 10 characters.");
  }
  if (purpose !== WorkPurpose.ACTION && instruction.length < 10) {
    throw new Error("A review, concurrence, or approval request requires a clear purpose of at least 10 characters.");
  }
  if (purpose !== WorkPurpose.ACTION && actionRecipients.length !== 1) {
    throw new Error("Select exactly one decision recipient. Additional staff may be copied.");
  }
  const draftId = String(formData.get("draftId") ?? "");
  const existingDraft = draftId
    ? await db.correspondence.findFirst({
        where: { id: draftId, createdById: user.id, status: CorrespondenceStatus.DRAFT },
      })
    : null;
  if (draftId && !existingDraft) throw new Error("This draft cannot be submitted.");
  const context = await requestContext();
  const record = await db.$transaction(async (tx) => {
    const destinationStatus = actionRecipients[0].role === UserRole.DG
      ? CorrespondenceStatus.WITH_DG
      : CorrespondenceStatus.ASSIGNED;
    const values = {
        ...parsed,
        dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
        createdById: user.id,
        requiresApproval: purpose === WorkPurpose.APPROVAL || existingDraft?.requiresApproval === true,
        status: destinationStatus,
        currentOwnerId: actionRecipients[0].id,
    };
    const created = existingDraft
      ? await tx.correspondence.update({
          where: { id: existingDraft.id },
          data: { ...values, referenceNumber: await nextReference(tx) },
        })
      : await tx.correspondence.create({
          data: { ...values, referenceNumber: await nextReference(tx) },
        });
    const actionItems = await Promise.all(actionRecipients.map((recipient) =>
      tx.workItem.create({
        data: {
          correspondenceId: created.id,
          assigneeId: recipient.id,
          kind: RecipientKind.ACTION,
          purpose,
          instruction: instruction || "For attention and necessary action.",
          dueAt: created.dueAt,
        },
      }),
    ));
    const copyItems = await Promise.all(copyRecipients.map((recipient) => tx.workItem.create({
      data: {
          correspondenceId: created.id,
          assigneeId: recipient.id,
          kind: RecipientKind.COPY,
          instruction: "For your information.",
          dueAt: created.dueAt,
      },
    })));
    if (purpose !== WorkPurpose.ACTION) await tx.decisionRequest.createMany({
      data: actionItems.map((item) => ({
        correspondenceId: created.id,
        workItemId: item.id,
        requestedById: user.id,
        purpose,
      })),
    });
    await enqueueNotifications(tx, [
      ...actionItems.map((item) => ({
        userId: item.assigneeId, actorId: user.id,
        type: purpose !== WorkPurpose.ACTION ? NotificationType.DECISION_REQUESTED : routingPolicy.isPeerReferral ? NotificationType.PEER_REFERRED : NotificationType.ASSIGNED,
        title: purpose !== WorkPurpose.ACTION ? `${purpose.toLowerCase()} requested` : routingPolicy.isPeerReferral ? "Peer referral received" : "Correspondence assigned",
        message: `${created.referenceNumber} requires your attention.`, href: `/correspondence/${created.id}`,
        sourceType: "WORK_ITEM", sourceId: item.id,
      })),
      ...copyItems.map((item) => ({ userId: item.assigneeId, actorId: user.id, type: NotificationType.COPIED, title: "Copied on correspondence", message: `${created.referenceNumber} was shared with you for information.`, href: `/correspondence/${created.id}`, sourceType: "WORK_ITEM", sourceId: item.id })),
    ]);
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: created.id,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: purpose !== WorkPurpose.ACTION
          ? EventType.DECISION_REQUESTED
          : routingPolicy.isPeerReferral
          ? EventType.REFERRED
          : existingDraft
            ? EventType.SUBMITTED
            : EventType.REGISTERED,
        fromStatus: existingDraft ? CorrespondenceStatus.DRAFT : null,
        toStatus: created.status,
        minute: isSecretariatIntake
          ? "Registered by the DG Secretariat and submitted to the DG."
          : instruction || "Raised internally and routed through the formal hierarchy.",
        metadata: {
          actionRecipientIds: actionRecipients.map((recipient) => recipient.id),
          copyRecipientIds: copyRecipients.map((recipient) => recipient.id),
          routeKind: routingPolicy.isPeerReferral ? "PEER_REFERRAL" : "HIERARCHICAL",
          workPurpose: purpose,
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
  await db.$transaction((tx) => captureRevision(
    tx,
    record.id,
    user.id,
    existingDraft ? "Draft finalized and submitted." : "Initial submitted version.",
  ));
  redirect(`/correspondence/${record.id}`);
}

async function persistDraft(formData: FormData) {
  const user = await requireUser();
  if (!canOriginate(user.role)) throw new Error("You cannot create correspondence drafts.");
  const parsed = draftData(formData);
  const draftId = String(formData.get("draftId") ?? "");
  const data = {
    ...parsed,
    senderName: parsed.senderName || user.name,
    dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    draftActionRecipientIds: formData.getAll("actionRecipientIds").map(String).filter(Boolean),
    draftCopyRecipientIds: formData.getAll("copyRecipientIds").map(String).filter(Boolean),
    draftInstruction: String(formData.get("instruction") ?? "").trim() || null,
    draftWorkPurpose: workPurpose(formData),
  };
  if (draftId) {
    const draft = await db.correspondence.findFirst({
      where: { id: draftId, createdById: user.id, status: CorrespondenceStatus.DRAFT },
    });
    if (!draft) throw new Error("This draft is unavailable or no longer editable.");
    await db.$transaction([
      db.correspondence.update({ where: { id: draft.id }, data }),
      db.correspondenceEvent.create({
        data: {
          correspondenceId: draft.id,
          actorId: user.id,
          actorType: ActorType.STAFF,
          type: EventType.DRAFT_UPDATED,
          fromStatus: CorrespondenceStatus.DRAFT,
          toStatus: CorrespondenceStatus.DRAFT,
          minute: "Draft changes saved.",
          ...(await requestContext()),
        },
      }),
    ]);
    return draft.id;
  }
  const context = await requestContext();
  const draft = await db.$transaction(async (tx) => {
    const created = await tx.correspondence.create({
      data: {
        ...data,
        referenceNumber: `DRAFT-${user.id}-${Date.now()}`,
        createdById: user.id,
        status: CorrespondenceStatus.DRAFT,
      },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: created.id,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.DRAFTED,
        toStatus: CorrespondenceStatus.DRAFT,
        minute: "Correspondence draft created.",
        ...context,
      },
    });
    return created;
  });
  return draft.id;
}

export async function saveDraftAction(formData: FormData) {
  const draftId = await persistDraft(formData);
  const file = formData.get("attachment");
  if (file instanceof File && file.size) {
    const stored = await persistAttachment(file, draftId);
    if (stored) await db.attachment.create({ data: { correspondenceId: draftId, ...stored } });
  }
  redirect(`/correspondence/${draftId}/edit?saved=1`);
}

export async function autosaveDraftAction(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) return { saved: false, savedAt: null };
  await persistDraft(formData);
  return { saved: true, savedAt: new Date().toISOString() };
}

export async function acceptExternalSubmissionAction(formData: FormData) {
  const user = await requireUser();
  if (!canRegister(user.role)) throw new Error("You cannot register correspondence.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const dg = await db.user.findFirst({ where: { role: UserRole.DG, isActive: true } });
  const record = await db.correspondence.findUnique({ where: { id: correspondenceId }, include: { secretariatRecord: true } });
  if (
    !record ||
    record.status !== CorrespondenceStatus.SUBMITTED ||
    record.claimedById !== user.id ||
    !dg
  ) {
    throw new Error("This submission cannot be registered.");
  }
  if (record.secretariatRecord?.duplicateStatus === DuplicateReviewStatus.CONFIRMED_DUPLICATE) {
    throw new Error("A confirmed duplicate cannot be registered as a new DG submission.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.WITH_DG, currentOwnerId: dg.id },
    });
    const item = await tx.workItem.create({
      data: { correspondenceId, assigneeId: dg.id, kind: RecipientKind.ACTION },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.REGISTERED,
        fromStatus: CorrespondenceStatus.SUBMITTED,
        toStatus: CorrespondenceStatus.WITH_DG,
        minute: "External submission verified by the DG Secretariat and submitted to the DG.",
        metadata: { recipientIds: [dg.id] },
        ...context,
      },
    });
    await enqueueNotifications(tx, [{
      userId: dg.id, actorId: user.id, type: NotificationType.ASSIGNED,
      title: "Secretariat correspondence registered", message: `${record.referenceNumber} is ready for DG attention.`,
      href: `/correspondence/${correspondenceId}`, sourceType: "WORK_ITEM", sourceId: item.id,
    }]);
  });
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
  const [record, authority] = await Promise.all([db.correspondence.findUnique({ where: { id: correspondenceId } }), workAuthority({ correspondenceId, actor: user })]);
  if (!record?.createdById || !authority) {
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
    const returnedItem = await tx.workItem.create({
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
    await enqueueNotifications(tx, [{
      userId: returnedItem.assigneeId, actorId: user.id, type: NotificationType.RETURNED,
      title: "Correspondence returned for correction", message: `${record.referenceNumber} was returned with a correction request.`,
      href: `/correspondence/${correspondenceId}`, sourceType: "WORK_ITEM", sourceId: returnedItem.id,
    }]);
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.RETURNED,
        fromStatus: record.status,
        toStatus: CorrespondenceStatus.RETURNED,
        minute: reason,
        metadata: { returnedToId: record.createdById, returnedById: user.id, ...authorityMetadata(authority) },
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
      revisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const returnedById = record?.events[0]?.actorId;
  if (
    !record ||
    record.createdById !== user.id ||
    record.status !== CorrespondenceStatus.RETURNED ||
    !returnedById ||
    !record.revisions[0] ||
    record.revisions[0].createdAt <= record.events[0].createdAt
  ) {
    throw new Error("Create a corrected document version before resubmitting this correspondence.");
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
    const resubmittedItem = await tx.workItem.create({
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
    await enqueueNotifications(tx, [{
      userId: resubmittedItem.assigneeId, actorId: user.id, type: NotificationType.ASSIGNED,
      title: "Corrected correspondence resubmitted", message: `${record.referenceNumber} has been corrected and resubmitted.`,
      href: `/correspondence/${correspondenceId}`, sourceType: "WORK_ITEM", sourceId: resubmittedItem.id,
    }]);
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

export async function reviseReturnedCorrespondenceAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const changeNote = String(formData.get("changeNote") ?? "").trim();
  if (changeNote.length < 5) throw new Error("Describe the correction made.");
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
  const [record, activeItem] = await Promise.all([
    db.correspondence.findFirst({
      where: {
        id: correspondenceId,
        createdById: user.id,
        status: CorrespondenceStatus.RETURNED,
      },
    }),
    db.workItem.findFirst({
      where: {
        correspondenceId,
        assigneeId: user.id,
        kind: RecipientKind.ACTION,
        status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      },
    }),
  ]);
  if (!record || !activeItem) throw new Error("Only the author holding a returned correspondence can revise it.");

  const file = formData.get("attachment");
  if (file instanceof File && file.size) {
    const stored = await persistAttachment(file, correspondenceId);
    if (stored) await db.attachment.create({ data: { correspondenceId, ...stored } });
  }
  const context = await requestContext();
  const revision = await db.$transaction(async (tx) => {
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: {
        subject: parsed.subject,
        summary: parsed.summary,
        body: parsed.body,
        classification: parsed.classification,
        priority: parsed.priority,
        senderReference: parsed.senderReference,
        dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
      },
    });
    const created = await captureRevision(tx, correspondenceId, user.id, changeNote);
    await tx.decisionRequest.updateMany({
      where: {
        correspondenceId,
        outcome: { in: [DecisionOutcome.RECOMMENDED, DecisionOutcome.CONCURRED, DecisionOutcome.APPROVED] },
        supersededAt: null,
      },
      data: { supersededAt: new Date(), supersededByVersion: created.version },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.REVISED,
        fromStatus: CorrespondenceStatus.RETURNED,
        toStatus: CorrespondenceStatus.RETURNED,
        minute: changeNote,
        metadata: { version: created.version },
        ...context,
      },
    });
    return created;
  });
  revalidatePath(`/correspondence/${correspondenceId}`);
  redirect(`/correspondence/${correspondenceId}?revision=${revision.version}`);
}

export async function routeCorrespondenceAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const minute = String(formData.get("minute") ?? "").trim();
  const purpose = workPurpose(formData);
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
  const authority = await workAuthority({ correspondenceId, actor: user });
  if (!authority || !canMinute(authority.principal.role)) throw new Error("You do not hold current authority to route this correspondence.");
  const [record, actionRecipients, copyRecipients] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId } }),
    db.user.findMany({ where: { id: { in: actionRecipientIds }, isActive: true } }),
    db.user.findMany({ where: { id: { in: copyRecipientIds }, isActive: true } }),
  ]);
  if (
    !record ||
    actionRecipients.length !== new Set(actionRecipientIds).size ||
    copyRecipients.length !== new Set(copyRecipientIds).size
  ) {
    throw new Error("Invalid routing request.");
  }
  const routingPolicy = await evaluateActionRouting({
      actorId: authority.principal.id,
      actorRole: authority.principal.role,
      recipientIds: actionRecipients.map((recipient) => recipient.id),
    });
  if (!routingPolicy.permitted) throw new Error("Routing must follow an authorized hierarchy or peer-referral path.");
  if (routingPolicy.isPeerReferral && minute.length < 10) {
    throw new Error("A peer referral requires a clear purpose of at least 10 characters.");
  }
  if (purpose !== WorkPurpose.ACTION && minute.length < 10) {
    throw new Error("A review, concurrence, or approval request requires a clear purpose of at least 10 characters.");
  }
  if (purpose !== WorkPurpose.ACTION && actionRecipients.length !== 1) {
    throw new Error("Select exactly one decision recipient. Additional staff may be copied.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.workItem.updateMany({
      where: { correspondenceId, assigneeId: authority.item.assigneeId, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
    });
    const actionItems = await Promise.all(actionRecipients.map((recipient) =>
      tx.workItem.create({
        data: {
          correspondenceId,
          assigneeId: recipient.id,
          kind: RecipientKind.ACTION,
          purpose,
          instruction: minute,
          dueAt: record.dueAt,
        },
      }),
    ));
    const copyItems = await Promise.all(copyRecipients.map((recipient) => tx.workItem.create({
      data: {
          correspondenceId,
          assigneeId: recipient.id,
          kind: RecipientKind.COPY,
          instruction: "For your information.",
          dueAt: record.dueAt,
      },
    })));
    if (purpose !== WorkPurpose.ACTION) await tx.decisionRequest.createMany({
      data: actionItems.map((item) => ({
        correspondenceId,
        workItemId: item.id,
        requestedById: user.id,
        purpose,
      })),
    });
    await enqueueNotifications(tx, [
      ...actionItems.map((item) => ({ userId: item.assigneeId, actorId: user.id, type: purpose !== WorkPurpose.ACTION ? NotificationType.DECISION_REQUESTED : routingPolicy.isPeerReferral ? NotificationType.PEER_REFERRED : NotificationType.ASSIGNED, title: purpose !== WorkPurpose.ACTION ? `${purpose.toLowerCase()} requested` : routingPolicy.isPeerReferral ? "Peer referral received" : "Correspondence assigned", message: `${record.referenceNumber} requires your attention.`, href: `/correspondence/${correspondenceId}`, sourceType: "WORK_ITEM", sourceId: item.id })),
      ...copyItems.map((item) => ({ userId: item.assigneeId, actorId: user.id, type: NotificationType.COPIED, title: "Copied on correspondence", message: `${record.referenceNumber} was shared with you for information.`, href: `/correspondence/${correspondenceId}`, sourceType: "WORK_ITEM", sourceId: item.id })),
    ]);
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: {
        status: CorrespondenceStatus.ASSIGNED,
        currentOwnerId: actionRecipients[0].id,
        requiresApproval: purpose === WorkPurpose.APPROVAL ? true : record.requiresApproval,
      },
    });
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: purpose !== WorkPurpose.ACTION
          ? EventType.DECISION_REQUESTED
          : routingPolicy.isPeerReferral
            ? EventType.REFERRED
            : EventType.MINUTED,
        fromStatus: record.status,
        toStatus: CorrespondenceStatus.ASSIGNED,
        minute,
        metadata: {
          actionRecipientIds,
          copyRecipientIds,
          routeKind: routingPolicy.isPeerReferral ? "PEER_REFERRAL" : "HIERARCHICAL",
          workPurpose: purpose,
          ...authorityMetadata(authority),
        },
        ...context,
      },
    });
  });
  revalidatePath(`/correspondence/${correspondenceId}`);
  redirect(`/correspondence/${correspondenceId}`);
}

const dispatchSchema = z.object({
  channel: z.enum(DispatchChannel),
  recipientName: z.string().trim().min(2).max(200),
  recipientOrganization: z.string().trim().max(200).optional(),
  recipientEmail: z.string().trim().max(254).optional(),
  recipientAddress: z.string().trim().max(1000).optional(),
  trackingNumber: z.string().trim().max(150).optional(),
  dispatchNote: z.string().trim().max(2000).optional(),
});

async function assertDispatchable(correspondenceId: string) {
  const record = await db.correspondence.findUnique({
    where: { id: correspondenceId },
    include: {
      decisionRequests: {
        where: { purpose: WorkPurpose.APPROVAL, outcome: DecisionOutcome.APPROVED, supersededAt: null },
        include: { signature: { include: { revision: true } } },
        take: 1,
      },
    },
  });
  if (!record || record.type !== CorrespondenceType.OUTGOING_LETTER) {
    throw new Error("Only outgoing correspondence can be dispatched.");
  }
  if (record.requiresApproval && !record.decisionRequests.length) {
    throw new Error("This correspondence requires a current approval before dispatch.");
  }
  if (record.decisionRequests[0]?.signature && !verifyApprovalSignature(record.decisionRequests[0].signature)) throw new Error("The current approval signature could not be verified; dispatch is blocked.");
  return record;
}

export async function prepareDispatchAction(formData: FormData) {
  const user = await requireUser();
  if (!canDispatch(user.role)) throw new Error("You are not authorized to prepare dispatch records.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const parsed = dispatchSchema.parse({
    channel: formData.get("channel"),
    recipientName: formData.get("recipientName"),
    recipientOrganization: formData.get("recipientOrganization") || undefined,
    recipientEmail: formData.get("recipientEmail") || undefined,
    recipientAddress: formData.get("recipientAddress") || undefined,
    trackingNumber: formData.get("trackingNumber") || undefined,
    dispatchNote: formData.get("dispatchNote") || undefined,
  });
  const record = await assertDispatchable(correspondenceId);
  if (parsed.channel === DispatchChannel.OFFICIAL_EMAIL && !z.email().safeParse(parsed.recipientEmail).success) {
    throw new Error("A valid recipient email is required for official email dispatch.");
  }
  if (
    (parsed.channel === DispatchChannel.PHYSICAL_DELIVERY || parsed.channel === DispatchChannel.COURIER) &&
    !parsed.recipientAddress
  ) {
    throw new Error("A recipient address is required for physical or courier dispatch.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const count = await tx.dispatchRecord.count({ where: { outgoingReference: { startsWith: `ITF/OUT/${year}/` } } });
    const outgoingReference = `ITF/OUT/${year}/${String(count + 1).padStart(6, "0")}`;
    const dispatch = await tx.dispatchRecord.create({
      data: { correspondenceId, outgoingReference, createdById: user.id, ...parsed },
    });
    if (parsed.channel === DispatchChannel.OFFICIAL_EMAIL && parsed.recipientEmail) {
      const sensitive = record.classification === Classification.CONFIDENTIAL || record.classification === Classification.SECRET;
      await tx.emailOutbox.create({ data: {
        idempotencyKey: `official-email-dispatch:${dispatch.id}`,
        toAddress: parsed.recipientEmail,
        subject: sensitive ? `Official ITF correspondence ${outgoingReference}` : `${outgoingReference}: ${record.subject}`,
        textBody: [
          `An official correspondence has been prepared for ${parsed.recipientName}.`,
          `Reference: ${outgoingReference}`,
          sensitive ? "The subject and document content are omitted from email because of their classification." : `Subject: ${record.subject}`,
          "Please contact the Industrial Training Fund through the official channel for the controlled document and delivery confirmation.",
          "Attachments are not included until the production malware-scanning and document-release gate is operational.",
        ].join("\n\n"),
        sourceType: "OFFICIAL_EMAIL_DISPATCH", sourceId: dispatch.id,
      } });
    }
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.DISPATCH_PREPARED,
        fromStatus: record.status,
        toStatus: record.status,
        minute: parsed.dispatchNote || `Dispatch prepared for ${parsed.recipientName}.`,
        metadata: { dispatchId: dispatch.id, outgoingReference, channel: parsed.channel },
        ...context,
      },
    });
  });
  revalidatePath("/dispatch");
  revalidatePath(`/correspondence/${correspondenceId}`);
  redirect(`/correspondence/${correspondenceId}`);
}

export async function updateDispatchStatusAction(formData: FormData) {
  const user = await requireUser();
  if (!canDispatch(user.role)) throw new Error("You are not authorized to update dispatch records.");
  const dispatchId = String(formData.get("dispatchId") ?? "");
  const nextStatus = z.enum(DispatchStatus).parse(formData.get("status"));
  const note = String(formData.get("note") ?? "").trim();
  const dispatch = await db.dispatchRecord.findUnique({ where: { id: dispatchId }, include: { correspondence: true } });
  if (!dispatch) throw new Error("Dispatch record not found.");
  if (dispatch.channel === DispatchChannel.OFFICIAL_EMAIL && nextStatus === DispatchStatus.DISPATCHED) {
    throw new Error("Official email is marked dispatched only after the protected worker receives SMTP acceptance.");
  }
  const transitions: Record<DispatchStatus, DispatchStatus[]> = {
    [DispatchStatus.PREPARED]: [DispatchStatus.DISPATCHED, DispatchStatus.FAILED],
    [DispatchStatus.DISPATCHED]: [DispatchStatus.DELIVERED, DispatchStatus.FAILED],
    [DispatchStatus.DELIVERED]: [],
    [DispatchStatus.FAILED]: [DispatchStatus.DISPATCHED],
  };
  if (!transitions[dispatch.status].includes(nextStatus)) throw new Error("Invalid dispatch status transition.");
  if ((nextStatus === DispatchStatus.DELIVERED || nextStatus === DispatchStatus.FAILED) && note.length < 5) {
    throw new Error("A delivery or failure note of at least 5 characters is required.");
  }
  const now = new Date();
  const eventType = nextStatus === DispatchStatus.DELIVERED
    ? EventType.DELIVERY_CONFIRMED
    : nextStatus === DispatchStatus.FAILED
      ? EventType.DELIVERY_FAILED
      : EventType.DISPATCHED;
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.dispatchRecord.update({
      where: { id: dispatch.id },
      data: {
        status: nextStatus,
        dispatchNote: nextStatus === DispatchStatus.DISPATCHED ? note || dispatch.dispatchNote : dispatch.dispatchNote,
        deliveryNote: nextStatus === DispatchStatus.DELIVERED || nextStatus === DispatchStatus.FAILED ? note : dispatch.deliveryNote,
        dispatchedAt: nextStatus === DispatchStatus.DISPATCHED ? now : dispatch.dispatchedAt,
        deliveredAt: nextStatus === DispatchStatus.DELIVERED ? now : null,
        failedAt: nextStatus === DispatchStatus.FAILED ? now : null,
      },
    });
    const remainingDeliveries = nextStatus === DispatchStatus.DELIVERED
      ? await tx.dispatchRecord.count({ where: { correspondenceId: dispatch.correspondenceId, id: { not: dispatch.id }, status: { not: DispatchStatus.DELIVERED } } })
      : 1;
    const closesCorrespondence = nextStatus === DispatchStatus.DELIVERED && remainingDeliveries === 0;
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId: dispatch.correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: eventType,
        fromStatus: dispatch.correspondence.status,
        toStatus: closesCorrespondence ? CorrespondenceStatus.CLOSED : dispatch.correspondence.status,
        minute: note || `${dispatch.outgoingReference} marked ${nextStatus.toLowerCase()}.`,
        metadata: { dispatchId: dispatch.id, outgoingReference: dispatch.outgoingReference, channel: dispatch.channel, dispatchStatus: nextStatus },
        ...context,
      },
    });
    if (nextStatus === DispatchStatus.FAILED) {
      const recipientIds = [...new Set([dispatch.createdById, dispatch.correspondence.createdById].filter((id): id is string => Boolean(id)))];
      await enqueueNotifications(tx, recipientIds.map((userId) => ({
        userId, actorId: user.id, type: NotificationType.DISPATCH_FAILED,
        title: "Dispatch delivery failed", message: `${dispatch.outgoingReference} requires attention before retry.`,
        href: `/correspondence/${dispatch.correspondenceId}`, sourceType: "DISPATCH_FAILURE", sourceId: `${dispatch.id}:${now.toISOString()}`,
      })));
    }
    if (closesCorrespondence) {
      await tx.correspondence.update({ where: { id: dispatch.correspondenceId }, data: { status: CorrespondenceStatus.CLOSED, currentOwnerId: null } });
      await tx.workItem.updateMany({ where: { correspondenceId: dispatch.correspondenceId, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } }, data: { status: WorkItemStatus.COMPLETED, completedAt: now } });
    }
  });
  revalidatePath("/dispatch");
  revalidatePath(`/correspondence/${dispatch.correspondenceId}`);
  redirect(`/correspondence/${dispatch.correspondenceId}`);
}

export async function recordDecisionAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const decisionRequestId = String(formData.get("decisionRequestId") ?? "");
  const outcome = z.enum(DecisionOutcome).parse(formData.get("outcome"));
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 5) throw new Error("A decision note of at least 5 characters is required.");

  const request = await db.decisionRequest.findFirst({
    where: {
      id: decisionRequestId,
      correspondenceId,
      outcome: null,
      workItem: { kind: RecipientKind.ACTION, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
    },
    include: { correspondence: true, workItem: true },
  });
  if (!request) throw new Error("This decision request is unavailable or has already been decided.");
  const authority = await workAuthority({ correspondenceId, actor: user, requireApproval: approvalRequired(request.purpose) });
  if (!authority || authority.item.id !== request.workItemId) throw new Error("You do not hold the required authority for this decision.");

  const allowed: Record<WorkPurpose, DecisionOutcome[]> = {
    [WorkPurpose.ACTION]: [],
    [WorkPurpose.REVIEW]: [DecisionOutcome.RECOMMENDED, DecisionOutcome.RETURNED],
    [WorkPurpose.CONCURRENCE]: [DecisionOutcome.CONCURRED, DecisionOutcome.REJECTED, DecisionOutcome.RETURNED],
    [WorkPurpose.APPROVAL]: [DecisionOutcome.APPROVED, DecisionOutcome.REJECTED, DecisionOutcome.RETURNED],
  };
  if (!allowed[request.purpose].includes(outcome)) {
    throw new Error("That decision is not valid for this request.");
  }

  const createsSignature = request.purpose === WorkPurpose.APPROVAL && outcome === DecisionOutcome.APPROVED;
  const latestRevision = createsSignature ? await db.correspondenceRevision.findFirst({ where: { correspondenceId }, orderBy: { version: "desc" } }) : null;
  if (createsSignature) {
    const password = String(formData.get("approvalPassword") ?? "");
    if (!user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) throw new Error("Password re-confirmation failed; approval was not recorded.");
    if (!latestRevision) throw new Error("The document has no immutable revision to sign.");
  }

  const returnsToRequester = outcome === DecisionOutcome.REJECTED || outcome === DecisionOutcome.RETURNED;
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    const changed = await tx.decisionRequest.updateMany({
      where: { id: request.id, outcome: null },
      data: { outcome, decisionNote: note, decidedById: user.id, decidedAt: new Date() },
    });
    if (changed.count !== 1) throw new Error("This decision was already recorded.");
    if (createsSignature && latestRevision) {
      const signedAt = new Date();
      const documentDigest = revisionDigest(latestRevision);
      const payload = {
        schema: "ITF_FLOW_APPROVAL_V1", decisionRequestId: request.id, correspondenceId,
        revisionId: latestRevision.id, revisionVersion: latestRevision.version, documentDigest,
        outcome, decisionNote: note, signerId: user.id, signerName: user.name, signerRole: user.role,
        authorityPrincipalId: authority.delegation ? authority.principal.id : null,
        authorityPrincipalName: authority.delegation ? authority.principal.name : null,
        delegationId: authority.delegation?.id ?? null, authenticationMethod: "PASSWORD_RECONFIRMATION",
        signedAt: signedAt.toISOString(), algorithm: APPROVAL_SIGNATURE_ALGORITHM, keyId: APPROVAL_SIGNATURE_KEY_ID,
      };
      await tx.approvalSignature.create({ data: {
        decisionRequestId: request.id, correspondenceId, revisionId: latestRevision.id,
        revisionVersion: latestRevision.version, documentDigest, canonicalPayload: payload,
        signatureValue: signApprovalPayload(payload), algorithm: APPROVAL_SIGNATURE_ALGORITHM,
        keyId: APPROVAL_SIGNATURE_KEY_ID, authenticationMethod: "PASSWORD_RECONFIRMATION",
        signerId: user.id, signerName: user.name, signerRole: user.role, signerPosition: user.position,
        authorityPrincipalId: authority.delegation ? authority.principal.id : null,
        authorityPrincipalName: authority.delegation ? authority.principal.name : null,
        delegationId: authority.delegation?.id ?? null, signedAt,
      } });
    }
    if (returnsToRequester) {
      await tx.workItem.update({
        where: { id: request.workItemId },
        data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
      });
      await tx.workItem.create({
        data: {
          correspondenceId,
          assigneeId: request.requestedById,
          kind: RecipientKind.ACTION,
          purpose: WorkPurpose.ACTION,
          instruction: note,
          dueAt: request.correspondence.dueAt,
        },
      });
      await tx.correspondence.update({
        where: { id: correspondenceId },
        data: { status: CorrespondenceStatus.RETURNED, currentOwnerId: request.requestedById },
      });
    } else {
      await tx.correspondence.update({
        where: { id: correspondenceId },
        data: { status: CorrespondenceStatus.IN_PROGRESS, currentOwnerId: authority.item.assigneeId },
      });
    }
    await tx.correspondenceEvent.create({
      data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.DECISION_RECORDED,
        fromStatus: request.correspondence.status,
        toStatus: returnsToRequester ? CorrespondenceStatus.RETURNED : CorrespondenceStatus.IN_PROGRESS,
        minute: note,
        metadata: {
          decisionRequestId: request.id,
          requestedById: request.requestedById,
          workPurpose: request.purpose,
          outcome,
          returnedToId: returnsToRequester ? request.requestedById : undefined,
          ...authorityMetadata(authority),
        },
        ...context,
      },
    });
    await enqueueNotifications(tx, [{
      userId: request.requestedById, actorId: user.id, type: NotificationType.DECISION_RECORDED,
      title: `${request.purpose.toLowerCase()} decision recorded`,
      message: `${request.correspondence.referenceNumber}: ${outcome.toLowerCase()}.`,
      href: `/correspondence/${correspondenceId}`, sourceType: "DECISION_REQUEST", sourceId: request.id,
    }]);
  });
  revalidatePath("/inbox");
  revalidatePath(`/correspondence/${correspondenceId}`);
  redirect(`/correspondence/${correspondenceId}`);
}

export async function acknowledgeAction(formData: FormData) {
  const user = await requireUser();
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const authority = await workAuthority({ correspondenceId, actor: user });
  if (!authority) throw new Error("You do not hold current authority for this correspondence.");
  await db.workItem.updateMany({
    where: { correspondenceId, assigneeId: authority.item.assigneeId, status: WorkItemStatus.OPEN },
    data: { status: WorkItemStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
  });
  await db.correspondenceEvent.create({
    data: {
      correspondenceId,
      actorId: user.id,
      actorType: ActorType.STAFF,
      type: EventType.ACKNOWLEDGED,
      minute: authority.delegation ? `Receipt acknowledged by ${user.name} acting for ${authority.principal.name}.` : "Receipt acknowledged.",
      metadata: authorityMetadata(authority),
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
  const [record, authority] = await Promise.all([db.correspondence.findUnique({ where: { id: correspondenceId } }), workAuthority({ correspondenceId, actor: user })]);
  if (!record || !authority) {
    throw new Error("Only a current action recipient can resolve correspondence.");
  }
  await db.$transaction([
    db.workItem.updateMany({
      where: { correspondenceId, assigneeId: authority.item.assigneeId, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
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
        metadata: authorityMetadata(authority),
        ...(await requestContext()),
      },
    }),
  ]);
  revalidatePath(`/correspondence/${correspondenceId}`);
}
