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
    const payload = verifyWorkspaceToken(token);
    const role = roleFromWorkspace(payload.app.role);
    if (!role) throw new Error("No valid ITF Flow role entitlement was supplied.");
    const existingRedemption = await db.launchTokenRedemption.findUnique({
      where: { tokenId: payload.tokenId },
    });
    if (existingRedemption) throw new Error("Launch token was already used.");

    const provisionedUser = await db.user.findFirst({ where: { OR: [{ workspaceUserId: payload.user.id }, { email: payload.user.email!.toLowerCase() }] } });
    if (!provisionedUser?.isActive || (provisionedUser.workspaceUserId && provisionedUser.workspaceUserId !== payload.user.id) || provisionedUser.role !== role) throw new Error("Workspace user is not actively provisioned for this role.");
    const user = await db.$transaction(async (tx) => {
      const mappedUser = await tx.user.update({
        where: { id: provisionedUser.id },
        data: {
          workspaceUserId: payload.user.id,
          staffNumber: payload.user.staffNumber ?? undefined,
          workspaceOfficeId: payload.user.officeId ?? undefined,
          workspaceDepartmentId: payload.user.departmentId ?? undefined,
          workspaceDivisionId: payload.user.divisionId ?? undefined,
          workspaceUnitId: payload.user.unitId ?? undefined,
          workspacePositionId: payload.user.positionId ?? undefined,
          name: payload.user.name ?? payload.user.email!,
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

    const mfaAuthenticatedAt = payload.authentication?.methods.some((method) => method.toLowerCase() === "mfa") ? new Date(payload.authentication.authenticatedAt * 1000) : undefined;
    await createSession(user.id, { authenticationMethod: StaffAuthenticationMethod.WORKSPACE_LAUNCH, identityProvider: payload.issuer ?? "itf-workspace-legacy", workspaceSessionId: payload.authentication?.sessionId, mfaAuthenticatedAt, correlationId: request.headers.get("x-correlation-id") ?? payload.tokenId });
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-token", url));
  }
}
