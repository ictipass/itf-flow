import { NextResponse } from "next/server";
import { CorrespondenceStatus, MalwareScanStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { readStoredDocument } from "@/lib/document-storage";
import { getCurrentUser } from "@/lib/session";
import { activeDelegationsFor } from "@/lib/delegations";
import { canReadClassification } from "@/lib/permissions";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { correspondence: { include: { workItems: true } } },
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
  if ((!broadAccess && attachment.correspondence.createdById !== user.id && !participant) || !canReadClassification(user.role, attachment.correspondence.classification)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (
    attachment.malwareScanStatus === MalwareScanStatus.INFECTED ||
    attachment.malwareScanStatus === MalwareScanStatus.QUARANTINED
  ) {
    return new NextResponse("Attachment is quarantined", { status: 423 });
  }
  if (attachment.storageProvider !== "LOCAL") {
    return new NextResponse("Document provider is not available", { status: 503 });
  }
  const bytes = await readStoredDocument(attachment.storageKey);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.originalName.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
