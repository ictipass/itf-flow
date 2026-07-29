"use server";

import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
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
  Priority,
  RecipientKind,
  UserRole,
  WorkItemStatus,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createReferenceNumber } from "@/lib/reference";
import { canMinute, canOriginate, canRegister, getAdjacentRoles } from "@/lib/permissions";
import { createSession, destroySession, requireUser } from "@/lib/session";

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

async function persistAttachment(file: File, correspondenceId: string) {
  if (!file.size) return null;
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Attachments must be PDF, JPEG, or PNG files no larger than 10 MB.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${correspondenceId}/${crypto.randomUUID()}-${safeName}`;
  const base = path.join(process.cwd(), "storage", "uploads", correspondenceId);
  await mkdir(base, { recursive: true });
  await writeFile(path.join(process.cwd(), "storage", "uploads", key), bytes, { flag: "wx" });
  return {
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    storageKey: key,
    sha256,
  };
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
  const requestedRecipientIds = formData.getAll("recipientIds").map(String).filter(Boolean);
  const recipients = isSecretariatIntake
    ? await db.user.findMany({ where: { role: UserRole.DG, isActive: true }, take: 1 })
    : await db.user.findMany({
        where: { id: { in: requestedRecipientIds }, isActive: true },
        orderBy: { hierarchyLevel: "desc" },
      });

  if (
    !recipients.length ||
    (!isSecretariatIntake && recipients.length !== new Set(requestedRecipientIds).size)
  ) {
    throw new Error("Select at least one valid recipient.");
  }

  const allowedRoles = getAdjacentRoles(user.role);
  if (
    !isSecretariatIntake &&
    user.role !== UserRole.SYSTEM_ADMIN &&
    recipients.some((recipient) => !allowedRoles.includes(recipient.role))
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
          recipients[0].role === UserRole.DG
            ? CorrespondenceStatus.WITH_DG
            : CorrespondenceStatus.ASSIGNED,
        currentOwnerId: recipients[0].id,
      },
    });
    await tx.workItem.createMany({
      data: recipients.map((recipient, index) => ({
        correspondenceId: created.id,
        assigneeId: recipient.id,
        kind: index === 0 ? RecipientKind.ACTION : RecipientKind.COPY,
        instruction: instruction || "For attention and necessary action.",
        dueAt: created.dueAt,
      })),
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
        metadata: { recipientIds: recipients.map((recipient) => recipient.id) },
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
  if (!record || record.status !== CorrespondenceStatus.SUBMITTED || !dg) {
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

export async function routeCorrespondenceAction(formData: FormData) {
  const user = await requireUser();
  if (!canMinute(user.role)) throw new Error("You cannot minute or route correspondence.");
  const correspondenceId = String(formData.get("correspondenceId") ?? "");
  const minute = String(formData.get("minute") ?? "").trim();
  const recipientIds = formData.getAll("recipientIds").map(String).filter(Boolean);
  if (!correspondenceId || minute.length < 3 || recipientIds.length === 0) {
    throw new Error("A minute and at least one recipient are required.");
  }
  const [record, recipients] = await Promise.all([
    db.correspondence.findUnique({ where: { id: correspondenceId } }),
    db.user.findMany({ where: { id: { in: recipientIds }, isActive: true } }),
  ]);
  if (!record || recipients.length !== new Set(recipientIds).size) throw new Error("Invalid routing request.");
  const permittedRoles = getAdjacentRoles(user.role);
  if (user.role !== UserRole.SYSTEM_ADMIN && recipients.some((recipient) => !permittedRoles.includes(recipient.role))) {
    throw new Error("Routing must follow the formal communication hierarchy.");
  }
  const context = await requestContext();
  await db.$transaction(async (tx) => {
    await tx.workItem.updateMany({
      where: { correspondenceId, assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      data: { status: WorkItemStatus.COMPLETED, completedAt: new Date() },
    });
    await tx.workItem.createMany({
      data: recipients.map((recipient, index) => ({
        correspondenceId,
        assigneeId: recipient.id,
        kind: index === 0 ? RecipientKind.ACTION : RecipientKind.COPY,
        instruction: minute,
        dueAt: record.dueAt,
      })),
    });
    await tx.correspondence.update({
      where: { id: correspondenceId },
      data: { status: CorrespondenceStatus.ASSIGNED, currentOwnerId: recipients[0].id },
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
        metadata: { recipientIds },
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
  const record = await db.correspondence.findUnique({ where: { id: correspondenceId } });
  if (!record) throw new Error("Correspondence not found.");
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
