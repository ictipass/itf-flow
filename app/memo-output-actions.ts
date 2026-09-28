"use server";

import { readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { ActorType, CorrespondenceStatus, CorrespondenceType, EventType, RecipientKind, SignatureProfileStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { activeDelegationsFor } from "@/lib/delegations";
import { storeSystemGeneratedPdf } from "@/lib/document-storage";
import { MEMO_TEMPLATE_VERSION, renderMemoOutput } from "@/lib/memo-output";
import { APPROVAL_SIGNATURE_ALGORITHM, APPROVAL_SIGNATURE_KEY_ID, signApprovalPayload } from "@/lib/approval-signatures";
import { requireUser } from "@/lib/session";
import { canAccessSensitiveRecord } from "@/lib/sensitive-access";

export type MemoOutputState = { status: "idle" | "error" | "success"; message: string; outputId?: string; attempt: number };

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const allowed = new Set([
    "Only resolved internal memos can produce the governed memo output.",
    "The memo originator has no approved signature profile.",
    "You are not authorized to generate this memo output.",
    "Complete the required Secret step-up authentication before generating an output.",
    "The correspondence changed while the output was being generated. Reload and try again.",
    "The approved signature profile changed while the output was being generated. Reload and try again.",
  ]);
  if (allowed.has(message)) return message;
  console.error("Memo output generation failed unexpectedly.", error);
  return "The memo output could not be generated. No official output record was created; try again or contact the system administrator.";
}

export async function generateMemoOutputAction(previous: MemoOutputState, formData: FormData): Promise<MemoOutputState> {
  try {
    const user = await requireUser();
    const correspondenceId = String(formData.get("correspondenceId") ?? "");
    const record = await db.correspondence.findUnique({
      where: { id: correspondenceId },
      include: {
        createdBy: true,
        revisions: { orderBy: { version: "desc" }, take: 1 },
        workItems: { include: { assignee: true }, orderBy: { assignedAt: "asc" } },
        events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
        attachments: { where: { isIncluded: true }, orderBy: { createdAt: "asc" } },
        decisionRequests: { include: { decidedBy: true }, orderBy: { requestedAt: "asc" } },
        accessGroups: { include: { group: { include: { members: true } } } },
      },
    });
    if (!record || record.type !== CorrespondenceType.INTERNAL_MEMO || (record.status !== CorrespondenceStatus.RESOLVED && record.status !== CorrespondenceStatus.CLOSED)) {
      throw new Error("Only resolved internal memos can produce the governed memo output.");
    }
    const delegatedPrincipalIds = (await activeDelegationsFor(user.id)).map((item) => item.principalId);
    const broadRoles: UserRole[] = [UserRole.DG, UserRole.DG_SECRETARY, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
    const participant = record.createdById === user.id || record.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
    if (!broadRoles.includes(user.role) && !participant) throw new Error("You are not authorized to generate this memo output.");
    const access = await canAccessSensitiveRecord({ user, classification: record.classification, createdById: record.createdById, hasAccessGroups: record.accessGroups.length > 0, groupMemberIds: [...new Set(record.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
    if (access.needsStepUp) throw new Error("Complete the required Secret step-up authentication before generating an output.");
    if (!access.allowed) throw new Error("You are not authorized to generate this memo output.");
    if (!record.createdBy || !record.revisions[0]) throw new Error("The memo originator has no approved signature profile.");
    const signatureProfile = await db.signatureProfile.findFirst({
      where: { userId: record.createdBy.id, status: SignatureProfileStatus.APPROVED },
      orderBy: { version: "desc" },
    });
    if (!signatureProfile) throw new Error("The memo originator has no approved signature profile.");

    const version = ((await db.memoOutput.aggregate({ where: { correspondenceId }, _max: { version: true } }))._max.version ?? 0) + 1;
    const outputId = randomUUID();
    const generatedAt = new Date();
    const logoPng = await readFile(path.join(process.cwd(), "public", "itf-logo.png"));
    const routingNames = [...new Set(record.workItems.filter((item) => item.kind === RecipientKind.ACTION).map((item) => `${item.assignee.name}${item.assignee.position ? ` (${item.assignee.position})` : ""}`))];
    const bytes = await renderMemoOutput({
      outputId,
      referenceNumber: record.referenceNumber,
      classification: record.classification,
      priority: record.priority,
      status: record.status,
      subject: record.subject,
      summary: record.summary,
      body: record.body,
      senderReference: record.senderReference,
      receivedAt: record.receivedAt,
      revisionVersion: record.revisions[0].version,
      originator: { name: record.createdBy.name, position: record.createdBy.position, office: record.createdBy.office, department: record.createdBy.department },
      routingNames,
      generatedBy: user.name,
      generatedAt,
      signaturePng: Buffer.from(signatureProfile.imageBytes),
      signatureProfileVersion: signatureProfile.version,
      signatureSha256: signatureProfile.sha256,
      events: record.events.map((event) => ({ type: event.type, minute: event.minute, createdAt: event.createdAt, actorName: event.actor?.name ?? "System / external sender" })),
      attachments: record.attachments.map((attachment) => ({ name: attachment.originalName, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes, sha256: attachment.sha256 })),
      decisions: record.decisionRequests.map((decision) => ({ purpose: decision.purpose, outcome: decision.outcome, note: decision.decisionNote, decidedAt: decision.decidedAt, decidedBy: decision.decidedBy?.name ?? null })),
      logoPng,
    });
    const safeReference = record.referenceNumber.replace(/[^a-zA-Z0-9._-]/g, "-");
    const stored = await storeSystemGeneratedPdf({ correspondenceId, originalName: `${safeReference}-memo-output-v${version}.pdf`, bytes });
    const payload = {
      schema: "ITF_FLOW_MEMO_OUTPUT_V1",
      outputId,
      correspondenceId,
      referenceNumber: record.referenceNumber,
      outputVersion: version,
      revisionId: record.revisions[0].id,
      revisionVersion: record.revisions[0].version,
      templateVersion: MEMO_TEMPLATE_VERSION,
      outputSha256: stored.sha256,
      originatorId: record.createdBy.id,
      signatureProfileId: signatureProfile.id,
      signatureProfileVersion: signatureProfile.version,
      signatureProfileSha256: signatureProfile.sha256,
      generatedById: user.id,
      generatedAt: generatedAt.toISOString(),
      algorithm: APPROVAL_SIGNATURE_ALGORITHM,
      keyId: APPROVAL_SIGNATURE_KEY_ID,
    };
    await db.$transaction(async (tx) => {
      const [current, currentRevision, currentSignature] = await Promise.all([
        tx.correspondence.findUnique({ where: { id: correspondenceId }, select: { updatedAt: true, status: true } }),
        tx.correspondenceRevision.findFirst({ where: { correspondenceId }, orderBy: { version: "desc" }, select: { id: true } }),
        tx.signatureProfile.findUnique({ where: { id: signatureProfile.id }, select: { status: true, sha256: true } }),
      ]);
      if (!current || current.updatedAt.getTime() !== record.updatedAt.getTime() || current.status !== record.status || currentRevision?.id !== record.revisions[0].id) {
        throw new Error("The correspondence changed while the output was being generated. Reload and try again.");
      }
      if (currentSignature?.status !== SignatureProfileStatus.APPROVED || currentSignature.sha256 !== signatureProfile.sha256) {
        throw new Error("The approved signature profile changed while the output was being generated. Reload and try again.");
      }
      await tx.memoOutput.create({ data: {
        id: outputId,
        correspondenceId,
        version,
        revisionId: record.revisions[0].id,
        revisionVersion: record.revisions[0].version,
        generatedById: user.id,
        originatorId: record.createdBy!.id,
        signatureProfileId: signatureProfile.id,
        templateVersion: MEMO_TEMPLATE_VERSION,
        ...stored,
        canonicalPayload: payload,
        signatureValue: signApprovalPayload(payload),
        algorithm: APPROVAL_SIGNATURE_ALGORITHM,
        keyId: APPROVAL_SIGNATURE_KEY_ID,
        generatedAt,
      } });
      await tx.correspondenceEvent.create({ data: {
        correspondenceId,
        actorId: user.id,
        actorType: ActorType.STAFF,
        type: EventType.MEMO_OUTPUT_GENERATED,
        fromStatus: record.status,
        toStatus: record.status,
        minute: `Generated governed ITF memo output version ${version}.`,
        metadata: { outputId, outputVersion: version, revisionVersion: record.revisions[0].version, outputSha256: stored.sha256, signatureProfileId: signatureProfile.id, templateVersion: MEMO_TEMPLATE_VERSION },
      } });
    });
    revalidatePath(`/correspondence/${correspondenceId}`);
    return { status: "success", message: `Memo output version ${version} generated and recorded.`, outputId, attempt: previous.attempt + 1 };
  } catch (error) {
    return { status: "error", message: safeMessage(error), attempt: previous.attempt + 1 };
  }
}
