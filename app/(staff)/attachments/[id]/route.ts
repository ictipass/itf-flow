import { NextResponse } from "next/server";
import { CorrespondenceStatus, DocumentEventType, DocumentProcessingStatus, MalwareScanStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { readStoredDocument } from "@/lib/document-storage";
import { getCurrentUser } from "@/lib/session";
import { activeDelegationsFor } from "@/lib/delegations";
import { canAccessSensitiveRecord, logSensitiveAccess } from "@/lib/sensitive-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { correspondence: { include: { workItems: true, accessGroups: { include: { group: { include: { members: true } } } } } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  if (
    attachment.correspondence.status === CorrespondenceStatus.DRAFT &&
    attachment.correspondence.createdById !== user.id
  ) {
    return new NextResponse("Not found", { status: 404 });
  }
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role);
  const delegatedPrincipalIds = (await activeDelegationsFor(user.id)).map((item) => item.principalId);
  const participant = attachment.correspondence.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
  if (!broadAccess && attachment.correspondence.createdById !== user.id && !participant) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const policy = await canAccessSensitiveRecord({ user, classification: attachment.correspondence.classification, createdById: attachment.correspondence.createdById, hasAccessGroups: attachment.correspondence.accessGroups.length > 0, groupMemberIds: [...new Set(attachment.correspondence.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
  if (policy.needsStepUp) return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(`/attachments/${attachment.id}`)}`, _request.url));
  if (!policy.allowed) return new NextResponse("Forbidden", { status: 403 });
  if (!attachment.isIncluded || attachment.processingStatus !== DocumentProcessingStatus.AVAILABLE || attachment.malwareScanStatus !== MalwareScanStatus.CLEAN) return new NextResponse("Attachment has not passed the document security gate", { status: 423 });
  const bytes = await readStoredDocument(attachment.storageKey, attachment.storageProvider);
  const sensitive = attachment.correspondence.classification === "CONFIDENTIAL" || attachment.correspondence.classification === "SECRET";
  if (sensitive) await logSensitiveAccess({ correspondenceId: attachment.correspondenceId, userId: user.id, type: "DOWNLOAD", detail: attachment.originalName, userAgent: _request.headers.get("user-agent"), ipAddress: _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
  await db.documentEvent.create({ data: { attachmentId: attachment.id, type: DocumentEventType.DOWNLOADED, detail: "Authorized document download.", metadata: { userId: user.id, sensitive } } });
  const controlledName = sensitive ? `CONTROLLED-${user.staffNumber ?? user.id.slice(-8)}-${new Date().toISOString().slice(0, 10)}-${attachment.originalName}` : attachment.originalName;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${controlledName.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
      ...(sensitive ? { "X-ITF-Controlled-Copy": `${user.id};${new Date().toISOString()}`, "X-Content-Type-Options": "nosniff" } : {}),
    },
  });
}
