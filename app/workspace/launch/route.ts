import { NextResponse } from "next/server";
import { StaffAuthenticationMethod, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyWorkspaceToken } from "@/lib/workspace-token";
import { resolveProvisioningIdentity } from "@/lib/workspace-directory-contract";

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
    const user = await db.$transaction(async (tx) => {
      const email = payload.identity.email.toLowerCase();
      const [byWorkspaceId, byEmail] = await Promise.all([
        tx.user.findUnique({ where: { workspaceUserId: payload.sub } }),
        tx.user.findUnique({ where: { email } }),
      ]);
      const resolution = resolveProvisioningIdentity(payload.sub, byWorkspaceId, byEmail);
      if (resolution.operation === "create") {
        throw new Error("Workspace user has not been provisioned in ITF Flow.");
      }
      const provisionedUser = byWorkspaceId ?? byEmail;
      if (!provisionedUser?.isActive || provisionedUser.role !== role) {
        throw new Error("Workspace user is not actively provisioned for this role.");
      }
      const mappedUser = await tx.user.update({
        where: { id: resolution.userId },
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
      upstreamExpiresAt: new Date(
        Math.min(
          payload.authentication.idleExpiresAt,
          payload.authentication.absoluteExpiresAt
        ) * 1000
      ),
      mfaAuthenticatedAt,
      correlationId: request.headers.get("x-correlation-id") ?? payload.jti,
    });
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-token", url));
  }
}
