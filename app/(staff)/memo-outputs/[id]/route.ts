import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/client";
import { verifyCanonicalSignature } from "@/lib/approval-signatures";
import { db } from "@/lib/db";
import { activeDelegationsFor } from "@/lib/delegations";
import { readStoredDocument } from "@/lib/document-storage";
import { canAccessSensitiveRecord, logSensitiveAccess } from "@/lib/sensitive-access";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const output = await db.memoOutput.findUnique({
    where: { id },
    include: { correspondence: { include: { workItems: true, accessGroups: { include: { group: { include: { members: true } } } } } } },
  });
  if (!output) return new NextResponse("Not found", { status: 404 });
  const broadRoles: UserRole[] = [UserRole.DG, UserRole.DG_SECRETARY, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const delegatedPrincipalIds = (await activeDelegationsFor(user.id)).map((item) => item.principalId);
  const participant = output.correspondence.createdById === user.id || output.correspondence.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
  if (!broadRoles.includes(user.role) && !participant) return new NextResponse("Forbidden", { status: 403 });
  const policy = await canAccessSensitiveRecord({ user, classification: output.correspondence.classification, createdById: output.correspondence.createdById, hasAccessGroups: output.correspondence.accessGroups.length > 0, groupMemberIds: [...new Set(output.correspondence.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
  if (policy.needsStepUp) return NextResponse.redirect(new URL(`/step-up?returnTo=${encodeURIComponent(`/memo-outputs/${output.id}`)}`, request.url));
  if (!policy.allowed) return new NextResponse("Forbidden", { status: 403 });
  if (!verifyCanonicalSignature(output)) return new NextResponse("Memo output signature record failed verification", { status: 409 });
  const bytes = await readStoredDocument(output.storageKey, output.storageProvider);
  if (createHash("sha256").update(bytes).digest("hex") !== output.sha256) return new NextResponse("Stored memo output integrity check failed", { status: 409 });
  const sensitive = output.correspondence.classification === "CONFIDENTIAL" || output.correspondence.classification === "SECRET";
  if (sensitive) await logSensitiveAccess({ correspondenceId: output.correspondenceId, userId: user.id, type: "DOWNLOAD", detail: output.originalName, userAgent: request.headers.get("user-agent"), ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() });
  const filename = sensitive ? `CONTROLLED-${user.staffNumber ?? user.id.slice(-8)}-${output.originalName}` : output.originalName;
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename.replaceAll('"', "")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
