import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { StaffAuthenticationMethod, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyWorkspaceToken } from "@/lib/workspace-token";
import { resolveProvisioningIdentity } from "@/lib/workspace-directory-contract";
import { classifyWorkspaceLaunchFailure, WorkspaceLaunchFailure, type WorkspaceLaunchFailureStage } from "@/lib/workspace-launch-diagnostics";

function roleFromWorkspace(value?: string | null) {
  return Object.values(UserRole).includes(value as UserRole)
    ? (value as UserRole)
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("workspace_launch_token");
  if (!token) return NextResponse.redirect(new URL("/login?error=missing-token", url));

  const reference = randomUUID();
  let stage: WorkspaceLaunchFailureStage = "VERIFY_TOKEN";
  try {
    const payload = await verifyWorkspaceToken(token);
    stage = "PROVISIONING";
    const role = roleFromWorkspace(payload.entitlement.role);
    if (!role) throw new WorkspaceLaunchFailure("ROLE_UNSUPPORTED");
    const user = await db.$transaction(async (tx) => {
      const email = payload.identity.email.toLowerCase();
      const [byWorkspaceId, byEmail] = await Promise.all([
        tx.user.findUnique({ where: { workspaceUserId: payload.sub } }),
        tx.user.findUnique({ where: { email } }),
      ]);
      let resolution: ReturnType<typeof resolveProvisioningIdentity>;
      try {
        resolution = resolveProvisioningIdentity(payload.sub, byWorkspaceId, byEmail);
      } catch {
        throw new WorkspaceLaunchFailure("IDENTITY_CONFLICT");
      }
      if (resolution.operation === "create") {
        throw new WorkspaceLaunchFailure("USER_NOT_PROVISIONED");
      }
      const provisionedUser = byWorkspaceId ?? byEmail;
      if (!provisionedUser?.isActive) throw new WorkspaceLaunchFailure("USER_INACTIVE");
      if (provisionedUser.role !== role) throw new WorkspaceLaunchFailure("ROLE_MISMATCH");
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
      stage = "REDEMPTION";
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
    stage = "CREATE_SESSION";
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
      correlationId: reference,
    });
    return NextResponse.redirect(new URL("/dashboard", url));
  } catch (error) {
    console.error(JSON.stringify({ event: "workspace_launch_failed", reference, stage, code: classifyWorkspaceLaunchFailure(error, stage) }));
    const destination = new URL("/login", url);
    destination.searchParams.set("error", "invalid-token");
    destination.searchParams.set("reference", reference);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
