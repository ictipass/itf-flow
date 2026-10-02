import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { CorrespondenceStatus, DocumentEventType, RecipientKind, UserRole, WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { readStoredDocument } from "@/lib/document-storage";
import { attachmentPassesDocumentSecurityGate } from "@/lib/document-security";
import { getCurrentUser } from "@/lib/session";
import { activeDelegationsFor } from "@/lib/delegations";
import { canAccessSensitiveRecord, logSensitiveAccess } from "@/lib/sensitive-access";
import { verifyCanonicalSignature } from "@/lib/approval-signatures";
import { registryAuthorizationFor } from "@/lib/registry-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: {
      sourceAnnotations: { select: { id: true } },
      annotationOutput: { select: { canonicalPayload: true, signatureValue: true } },
      correspondence: { include: { workItems: true, accessGroups: { include: { group: { include: { members: true } } } } } },
    },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  if (
    attachment.correspondence.status === CorrespondenceStatus.DRAFT &&
    attachment.correspondence.createdById !== user.id
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  const registryAuthorization = await registryAuthorizationFor(user, attachment.correspondence.classification);
  if (registryAuthorization.needsStepUp) {
    const requestUrl = new URL(_request.url);
    const inline = requestUrl.searchParams.get("inline") === "1";
    const returnTo = `/attachments/${attachment.id}${inline ? "?inline=1" : ""}`;
    return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(returnTo)}`, _request.url));
  }
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role) || registryAuthorization.allowed;
  const delegatedPrincipalIds = (await activeDelegationsFor(user.id)).map((item) => item.principalId);
  const participant = attachment.correspondence.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
  if (!broadAccess && attachment.correspondence.createdById !== user.id && !participant) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const policy = registryAuthorization.allowed ? { allowed: true, needsStepUp: false } : await canAccessSensitiveRecord({ user, classification: attachment.correspondence.classification, createdById: attachment.correspondence.createdById, hasAccessGroups: attachment.correspondence.accessGroups.length > 0, groupMemberIds: [...new Set(attachment.correspondence.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
  const requestUrl = new URL(_request.url);
  const inline = requestUrl.searchParams.get("inline") === "1";
  const returnTo = `/attachments/${attachment.id}${inline ? "?inline=1" : ""}`;
  if (policy.needsStepUp) return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(returnTo)}`, _request.url));
  if (!policy.allowed) return new NextResponse("Forbidden", { status: 403 });
  const unacknowledgedAction = attachment.correspondence.workItems.some((item) =>
    item.kind === RecipientKind.ACTION &&
    item.status === WorkItemStatus.OPEN &&
    (item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId)),
  );
  if (unacknowledgedAction) return new NextResponse("Acknowledge receipt before opening this document.", { status: 428 });
  const preservedAnnotationSource = attachment.sourceAnnotations.length > 0;
  if ((!attachment.isIncluded && !preservedAnnotationSource) || !attachmentPassesDocumentSecurityGate(attachment)) return new NextResponse("Attachment has not passed the document security gate", { status: 423 });
  if (attachment.annotationOutput && !verifyCanonicalSignature(attachment.annotationOutput)) return new NextResponse("The document annotation signature could not be verified", { status: 409 });
  const bytes = await readStoredDocument(attachment.storageKey, attachment.storageProvider);
  if (createHash("sha256").update(bytes).digest("hex") !== attachment.sha256) return new NextResponse("Stored document integrity check failed", { status: 409 });
  const sensitive = attachment.correspondence.classification === "CONFIDENTIAL" || attachment.correspondence.classification === "SECRET";
  if (sensitive) await logSensitiveAccess({ correspondenceId: attachment.correspondenceId, userId: user.id, type: "DOWNLOAD", detail: attachment.originalName, userAgent: _request.headers.get("user-agent"), ipAddress: _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
  await db.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.DOWNLOADED, detail: inline ? "Authorized in-application document view." : "Authorized document download.", metadata: { userId: user.id, sensitive, inline, preservedAnnotationSource } } });
  const controlledName = sensitive ? `CONTROLLED-${user.staffNumber ?? user.id.slice(-8)}-${new Date().toISOString().slice(0, 10)}-${attachment.originalName}` : attachment.originalName;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${controlledName.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
      ...(sensitive ? { "X-ITF-Controlled-Copy": `${user.id};${new Date().toISOString()}`, "X-Content-Type-Options": "nosniff" } : {}),
    },
  });
}
