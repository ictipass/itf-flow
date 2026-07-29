import { NextResponse } from "next/server";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyWorkspaceToken } from "@/lib/workspace-token";

function roleFromWorkspace(value?: string | null) {
  return Object.values(UserRole).includes(value as UserRole)
    ? (value as UserRole)
    : UserRole.OFFICER;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("workspace_launch_token");
  if (!token) return NextResponse.redirect(new URL("/login?error=missing-token", url));

  try {
    const payload = verifyWorkspaceToken(token);
    const existingRedemption = await db.launchTokenRedemption.findUnique({
      where: { tokenId: payload.tokenId },
    });
    if (existingRedemption) throw new Error("Launch token was already used.");

    const user = await db.$transaction(async (tx) => {
      const mappedUser = await tx.user.upsert({
        where: { email: payload.user.email!.toLowerCase() },
        update: {
          workspaceUserId: payload.user.id,
          staffNumber: payload.user.staffNumber ?? undefined,
          name: payload.user.name ?? payload.user.email!,
          isActive: true,
        },
        create: {
          workspaceUserId: payload.user.id,
          staffNumber: payload.user.staffNumber ?? null,
          email: payload.user.email!.toLowerCase(),
          name: payload.user.name ?? payload.user.email!,
          role: roleFromWorkspace(payload.app.role),
          office: "ITF",
          hierarchyLevel: 1,
        },
      });
      await tx.launchTokenRedemption.create({
        data: {
          tokenId: payload.tokenId,
          workspaceUserId: payload.user.id,
          userId: mappedUser.id,
          expiresAt: new Date(payload.expiresAt * 1000),
        },
      });
      return mappedUser;
    });

    await createSession(user.id);
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-token", url));
  }
}
