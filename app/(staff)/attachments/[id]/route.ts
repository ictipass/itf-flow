import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: { correspondence: { include: { workItems: { where: { assigneeId: user.id } } } } },
  });
  if (!attachment) return new NextResponse("Not found", { status: 404 });
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role);
  if (!broadAccess && attachment.correspondence.createdById !== user.id && !attachment.correspondence.workItems.length) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const absolutePath = path.resolve(process.cwd(), "storage", "uploads", attachment.storageKey);
  const storageRoot = path.resolve(process.cwd(), "storage", "uploads");
  if (!absolutePath.startsWith(`${storageRoot}${path.sep}`)) return new NextResponse("Invalid file", { status: 400 });
  const bytes = await readFile(absolutePath);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename="${attachment.originalName.replaceAll('"', "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
