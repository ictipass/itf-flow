import { createHash } from "crypto";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { CorrespondenceStatus, DocumentEventType, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { activeDelegationsFor } from "@/lib/delegations";
import { registryAuthorizationFor } from "@/lib/registry-access";
import { canAccessSensitiveRecord, logSensitiveAccess } from "@/lib/sensitive-access";
import { attachmentPassesDocumentSecurityGate } from "@/lib/document-security";
import { readStoredDocument } from "@/lib/document-storage";
import { APPROVAL_SIGNATURE_ALGORITHM, APPROVAL_SIGNATURE_KEY_ID, signApprovalPayload } from "@/lib/approval-signatures";
import { evidencePackageId } from "@/lib/records-governance";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "document";
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const record = await db.correspondence.findUnique({
    where: { id },
    include: {
      createdBy: true, ultimateRecipient: true, recordFile: { include: { subjectUser: true } },
      attachments: { include: { documentEvents: { orderBy: { createdAt: "asc" } }, sourceAnnotations: { select: { id: true } } }, orderBy: { createdAt: "asc" } },
      workItems: { include: { assignee: true }, orderBy: { assignedAt: "asc" } },
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      revisions: { include: { createdBy: true }, orderBy: { version: "asc" } },
      decisionRequests: { include: { requestedBy: true, decidedBy: true, signature: true }, orderBy: { requestedAt: "asc" } },
      documentAnnotations: { orderBy: { version: "asc" } },
      memoOutputs: { orderBy: { version: "asc" } },
      dispatchRecords: { orderBy: { createdAt: "asc" } },
      sensitiveAccessEvents: { orderBy: { createdAt: "asc" } },
      accessGroups: { include: { group: { include: { members: true } } } },
    },
  });
  if (!record || record.status === CorrespondenceStatus.DRAFT) return new NextResponse("Not found", { status: 404 });
  const registryAuthorization = await registryAuthorizationFor(user, record.classification);
  if (registryAuthorization.needsStepUp) return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(`/api/reports/correspondence/${id}/evidence-package`)}`, request.url));
  const delegatedPrincipalIds = (await activeDelegationsFor(user.id)).map((item) => item.principalId);
  const broad = ([UserRole.DG_SECRETARY, UserRole.DG, UserRole.SYSTEM_ADMIN] as UserRole[]).includes(user.role) || registryAuthorization.allowed;
  const participant = record.createdById === user.id || record.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
  if (!broad && !participant) return new NextResponse("Forbidden", { status: 403 });
  const policy = registryAuthorization.allowed ? { allowed: true, needsStepUp: false } : await canAccessSensitiveRecord({ user, classification: record.classification, createdById: record.createdById, hasAccessGroups: record.accessGroups.length > 0, groupMemberIds: [...new Set(record.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
  if (policy.needsStepUp) return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(`/api/reports/correspondence/${id}/evidence-package`)}`, request.url));
  if (!policy.allowed) return new NextResponse("Forbidden", { status: 403 });

  const generatedAt = new Date();
  const packageId = evidencePackageId(record.id, generatedAt);
  const maximumBytes = Number(process.env.EVIDENCE_PACKAGE_MAX_MB ?? "100") * 1024 * 1024;
  const zip = new JSZip();
  const fileManifest: Array<{ attachmentId: string; path: string; originalName: string; sha256: string; sizeBytes: number; mimeType: string; included: boolean }> = [];
  let totalBytes = 0;
  for (const attachment of record.attachments) {
    const preservedSource = attachment.sourceAnnotations.length > 0;
    if ((!attachment.isIncluded && !preservedSource) || !attachmentPassesDocumentSecurityGate(attachment)) continue;
    const bytes = await readStoredDocument(attachment.storageKey, attachment.storageProvider);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== attachment.sha256) return new NextResponse(`Integrity verification failed for ${attachment.id}`, { status: 409 });
    totalBytes += bytes.length;
    if (totalBytes > maximumBytes) return new NextResponse("Evidence package exceeds the configured size limit", { status: 413 });
    const path = `documents/${String(fileManifest.length + 1).padStart(3, "0")}-${attachment.id}-${safeName(attachment.originalName)}`;
    zip.file(path, bytes);
    fileManifest.push({ attachmentId: attachment.id, path, originalName: attachment.originalName, sha256: digest, sizeBytes: bytes.length, mimeType: attachment.mimeType, included: attachment.isIncluded });
  }
  const manifest = {
    schema: "ITF_FLOW_EVIDENCE_PACKAGE_V1",
    packageId,
    generatedAt: generatedAt.toISOString(),
    generatedBy: { id: user.id, name: user.name, staffNumber: user.staffNumber, role: user.role },
    correspondence: { id: record.id, referenceNumber: record.referenceNumber, subject: record.subject, type: record.type, classification: record.classification, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt },
    ultimateRecipient: { type: record.ultimateRecipientType, userId: record.ultimateRecipientUserId, name: record.ultimateRecipient?.name ?? record.ultimateRecipientName, organizationalUnit: record.ultimateRecipientOrgUnitName },
    officialFile: record.recordFile ? { id: record.recordFile.id, fileKey: record.recordFile.fileKey, category: record.recordFile.category, label: record.recordFile.label, filePlanCode: record.recordFile.filePlanCode, retentionClass: record.recordFile.retentionClass, subject: record.recordFile.subjectUser ? { id: record.recordFile.subjectUser.id, staffNumber: record.recordFile.subjectUser.staffNumber, name: record.recordFile.subjectUser.name } : null } : null,
    files: fileManifest,
  };
  const signaturePayload = { manifest, algorithm: APPROVAL_SIGNATURE_ALGORITHM, keyId: APPROVAL_SIGNATURE_KEY_ID };
  zip.file("manifest.json", json(manifest));
  zip.file("manifest-signature.json", json({ ...signaturePayload, signatureValue: signApprovalPayload(signaturePayload) }));
  zip.file("record/correspondence.json", json({ subject: record.subject, summary: record.summary, body: record.body, senderName: record.senderName, senderReference: record.senderReference, priority: record.priority, receivedAt: record.receivedAt, dueAt: record.dueAt, createdBy: record.createdBy && { id: record.createdBy.id, staffNumber: record.createdBy.staffNumber, name: record.createdBy.name, office: record.createdBy.office } }));
  zip.file("audit/movement-path.json", json({ workItems: record.workItems, events: record.events }));
  zip.file("audit/revisions.json", json(record.revisions));
  zip.file("audit/decisions-and-approvals.json", json(record.decisionRequests));
  zip.file("audit/document-annotations.json", json(record.documentAnnotations));
  zip.file("audit/document-events.json", json(record.attachments.flatMap((attachment) => attachment.documentEvents.map((event) => ({ eventId: event.id, attachmentId: event.attachmentId, originalName: attachment.originalName, type: event.type, detail: event.detail, metadata: event.metadata, createdAt: event.createdAt })))));
  zip.file("audit/memo-outputs.json", json(record.memoOutputs));
  zip.file("audit/dispatch.json", json(record.dispatchRecords));
  zip.file("audit/sensitive-access.json", json(record.sensitiveAccessEvents));
  zip.file("README.txt", `ITF Flow correspondence evidence package\nReference: ${record.referenceNumber}\nPackage: ${packageId}\nGenerated: ${generatedAt.toISOString()}\n\nVerify each document against manifest.json. Verify manifest-signature.json inside ITF Flow using the recorded key identifier. This package is an archival export; authorization and retention remain governed by ITF policy.\n`);
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 }, platform: "UNIX" });
  const sensitive = record.classification === "CONFIDENTIAL" || record.classification === "SECRET";
  if (sensitive) await logSensitiveAccess({ correspondenceId: record.id, userId: user.id, type: "EXPORT", detail: `Evidence package ${packageId}`, userAgent: request.headers.get("user-agent"), ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
  await db.documentEvent.createMany({ data: fileManifest.map((file) => ({ attachmentId: file.attachmentId, type: DocumentEventType.DOWNLOADED, detail: "Included in an authorized S29 evidence package.", metadata: { packageId, userId: user.id, export: true } })) });
  const filename = `${safeName(record.referenceNumber)}-evidence-${packageId}.zip`;
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-ITF-Evidence-Package": packageId } });
}
