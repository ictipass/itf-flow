import { NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const profile = await db.signatureProfile.findUnique({ where: { id }, select: { userId: true, mimeType: true, imageBytes: true } });
  if (!profile) return new NextResponse("Not found", { status: 404 });
  if (profile.userId !== user.id && user.role !== UserRole.SYSTEM_ADMIN) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(new Uint8Array(profile.imageBytes), {
    headers: { "Content-Type": profile.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
