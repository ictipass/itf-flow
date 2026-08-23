import { NextResponse } from "next/server";
import { StaffAuthenticationMethod, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyWorkspaceToken } from "@/lib/workspace-token";

function roleFromWorkspace(value?: string | null) {
  return Object.values(UserRole).includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("workspace_launch_token");
  if (!token) return NextResponse.redirect(new URL("/login?error=missing-token", url));

  try {
    const payload = await verifyWorkspaceToken(token);
    const role = roleFromWorkspace(payload.entitlement.role);
    if (!role) throw new Error("No valid ITF Flow role entitlement was supplied.");
    const existingRedemption = await db.launchTokenRedemption.findUnique({
      where: { tokenId: payload.jti },
    });
    if (existingRedemption) throw new Error("Launch token was already used.");

    const provisionedUser = await db.user.findFirst({ where: { OR: [{ workspaceUserId: payload.sub }, { email: payload.identity.email.toLowerCase() }] } });
    if (!provisionedUser?.isActive || (provisionedUser.workspaceUserId && provisionedUser.workspaceUserId !== payload.sub) || provisionedUser.role !== role) throw new Error("Workspace user is not actively provisioned for this role.");
    const user = await db.$transaction(async (tx) => {
      const mappedUser = await tx.user.update({
        where: { id: provisionedUser.id },
        data: {
          workspaceUserId: payload.sub,
          staffNumber: payload.identity.staffNumber ?? undefined,
          workspaceOfficeId: payload.identity.officeId ?? undefined,
          workspaceDepartmentId: payload.identity.departmentId ?? undefined,
          workspaceDivisionId: payload.identity.divisionId ?? undefined,
          workspaceUnitId: payload.identity.unitId ?? undefined,
          workspacePositionId: payload.identity.positionId ?? undefined,
          name: payload.identity.name ?? payload.identity.email,
        },
      });
      await tx.launchTokenRedemption.create({
        data: {
          tokenId: payload.jti,
          workspaceUserId: payload.sub,
          userId: mappedUser.id,
          expiresAt: new Date(payload.exp * 1000),
        },
      });
      return mappedUser;
    });

    const mfaAuthenticatedAt = payload.authentication.methods.includes("totp") && payload.authentication.mfaAuthenticatedAt
      ? new Date(payload.authentication.mfaAuthenticatedAt * 1000)
      : undefined;
    await createSession(user.id, {
      authenticationMethod: StaffAuthenticationMethod.WORKSPACE_LAUNCH,
      identityProvider: payload.iss,
      workspaceSessionId: payload.authentication.workspaceSessionId,
      mfaAuthenticatedAt,
      correlationId: request.headers.get("x-correlation-id") ?? payload.jti,
    });
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-token", url));
  }
}
