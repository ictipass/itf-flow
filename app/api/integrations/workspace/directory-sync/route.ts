import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { IntegrationEventType } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { correlationId } from "@/lib/integration-auth";
import {
  directoryBatchDigest,
  resolveProvisioningIdentity,
  provisioningChangeRequiresSessionRevocation,
  WORKSPACE_DIRECTORY_VERSION,
  workspaceDirectoryBatchSchema,
} from "@/lib/workspace-directory-contract";

function authorized(request: Request) {
  const configured = process.env.WORKSPACE_DIRECTORY_SYNC_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || configured.length < 32 || !supplied) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

type CompletedMetadata = {
  requestDigest?: string;
  runId?: string;
  createdCount?: number;
  updatedCount?: number;
  inactiveCount?: number;
};

export async function POST(request: Request) {
  const requestCorrelationId = correlationId(request);
  const respond = (body: unknown, status = 200) => NextResponse.json(body, {
    status,
    headers: { "X-Correlation-Id": requestCorrelationId, "Cache-Control": "no-store" },
  });
  if (!authorized(request)) return respond({ error: "Unauthorized" }, 401);

  const parsed = workspaceDirectoryBatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respond({ error: "Invalid directory payload.", details: parsed.error.flatten() }, 400);
  }
  const expectedAppSlug = process.env.WORKSPACE_APP_SLUG?.trim() || "itf-flow";
  if (parsed.data.targetAppSlug !== expectedAppSlug) {
    return respond({ error: "Directory batch is not addressed to this application." }, 400);
  }
  const requestDigest = directoryBatchDigest(parsed.data);

  try {
    const result = await db.$transaction(async (tx) => {
      const inserted = await tx.integrationEvent.createMany({
        data: [{
          eventId: parsed.data.requestId,
          correlationId: requestCorrelationId,
          source: parsed.data.source,
          type: IntegrationEventType.DIRECTORY_SYNCHRONIZED,
          metadata: {
            version: parsed.data.version,
            requestDigest,
            targetAppSlug: parsed.data.targetAppSlug,
            batch: parsed.data.batch,
          },
        }],
        skipDuplicates: true,
      });
      if (inserted.count === 0) {
        const existing = await tx.integrationEvent.findUnique({
          where: { eventId: parsed.data.requestId },
          select: { source: true, type: true, metadata: true },
        });
        const metadata = (existing?.metadata ?? {}) as CompletedMetadata;
        if (
          existing?.source !== parsed.data.source ||
          existing.type !== IntegrationEventType.DIRECTORY_SYNCHRONIZED ||
          metadata.requestDigest !== requestDigest
        ) {
          return { conflict: true as const };
        }
        return {
          conflict: false as const,
          duplicate: true,
          runId: metadata.runId,
          createdCount: metadata.createdCount ?? 0,
          updatedCount: metadata.updatedCount ?? 0,
          inactiveCount: metadata.inactiveCount ?? 0,
        };
      }

      const run = await tx.provisioningRun.create({
        data: {
          source: `${parsed.data.source}:${parsed.data.version}`,
          status: "RUNNING",
          receivedCount: parsed.data.users.length,
        },
      });
      let createdCount = 0;
      let updatedCount = 0;
      let inactiveCount = 0;
      const mappedUserIds = new Map<string, string>();
      const securityChangedUserIds = new Set<string>();
      const knownUsers = await tx.user.findMany({
        where: {
          OR: [
            {
              workspaceUserId: {
                in: parsed.data.users.flatMap((user) =>
                  user.supervisorWorkspaceUserId
                    ? [user.workspaceUserId, user.supervisorWorkspaceUserId]
                    : [user.workspaceUserId]
                ),
              },
            },
            { email: { in: parsed.data.users.map((user) => user.email) } },
          ],
        },
        select: {
          id: true,
          workspaceUserId: true,
          email: true,
          role: true,
          isActive: true,
        },
      });
      const knownByWorkspaceId = new Map(
        knownUsers
          .filter((user) => user.workspaceUserId)
          .map((user) => [user.workspaceUserId!, user])
      );
      const knownByEmail = new Map(knownUsers.map((user) => [user.email, user]));

      for (const item of parsed.data.users) {
        const byWorkspaceId = knownByWorkspaceId.get(item.workspaceUserId) ?? null;
        const byEmail = knownByEmail.get(item.email) ?? null;
        const resolution = resolveProvisioningIdentity(item.workspaceUserId, byWorkspaceId, byEmail);
        const commonData = {
          passwordHash: null,
          workspaceUserId: item.workspaceUserId,
          staffNumber: item.staffNumber,
          email: item.email,
          name: item.name,
          role: item.role,
          isActive: item.isActive,
          office: item.office?.name ?? "ITF",
          department: item.department?.name,
          division: item.division?.name,
          unit: item.unit?.name,
          position: item.position?.name,
          workspaceOfficeId: item.office?.id,
          workspaceDepartmentId: item.department?.id,
          workspaceDivisionId: item.division?.id,
          workspaceUnitId: item.unit?.id,
          workspacePositionId: item.position?.id,
        };

        if (resolution.operation === "update") {
          const previous = byWorkspaceId ?? byEmail!;
          const updated = await tx.user.update({
            where: { id: resolution.userId },
            data: commonData,
          });
          if (provisioningChangeRequiresSessionRevocation({
            previousRole: previous.role,
            nextRole: item.role,
            previouslyActive: previous.isActive,
            nextActive: item.isActive,
          })) {
            securityChangedUserIds.add(updated.id);
          }
          mappedUserIds.set(item.workspaceUserId, updated.id);
          knownByWorkspaceId.set(item.workspaceUserId, updated);
          knownByEmail.set(item.email, updated);
          updatedCount += 1;
        } else {
          const created = await tx.user.create({
            data: { ...commonData, hierarchyLevel: 1 },
          });
          mappedUserIds.set(item.workspaceUserId, created.id);
          knownByWorkspaceId.set(item.workspaceUserId, created);
          knownByEmail.set(item.email, created);
          createdCount += 1;
        }
        if (!item.isActive) inactiveCount += 1;
      }

      for (const item of parsed.data.users) {
        const userId = mappedUserIds.get(item.workspaceUserId)!;
        const supervisorId = item.supervisorWorkspaceUserId
          ? mappedUserIds.get(item.supervisorWorkspaceUserId) ??
            knownByWorkspaceId.get(item.supervisorWorkspaceUserId)?.id
          : null;
        await tx.user.update({ where: { id: userId }, data: { supervisorId: supervisorId ?? null } });
      }

      const changedUserIds = [...securityChangedUserIds];
      if (changedUserIds.length) {
        await tx.staffSession.updateMany({
          where: { userId: { in: changedUserIds }, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revocationReason: "Workspace directory synchronization changed this identity or role.",
          },
        });
      }

      await tx.provisioningRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          createdCount,
          updatedCount,
          inactiveCount,
          completedAt: new Date(),
        },
      });
      await tx.integrationEvent.update({
        where: { eventId: parsed.data.requestId },
        data: {
          metadata: {
            version: parsed.data.version,
            requestDigest,
            targetAppSlug: parsed.data.targetAppSlug,
            batch: parsed.data.batch,
            runId: run.id,
            createdCount,
            updatedCount,
            inactiveCount,
            sessionsRevokedForChangedIdentityCount: changedUserIds.length,
          },
        },
      });
      return { conflict: false as const, duplicate: false, runId: run.id, createdCount, updatedCount, inactiveCount };
    });

    if (result.conflict) {
      return respond({
        version: WORKSPACE_DIRECTORY_VERSION,
        requestId: parsed.data.requestId,
        error: "Directory request ID was already used for a different payload.",
      }, 409);
    }

    return respond({
      version: WORKSPACE_DIRECTORY_VERSION,
      requestId: parsed.data.requestId,
      ...result,
    });
  } catch (error) {
    let runId: string | undefined;
    try {
      const failed = await db.provisioningRun.create({
        data: {
          source: `${parsed.data.source}:${parsed.data.version}`,
          status: "FAILED",
          receivedCount: parsed.data.users.length,
          error: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
          completedAt: new Date(),
        },
      });
      runId = failed.id;
    } catch {
      // The response remains fail-closed if even the failure ledger is unavailable.
    }
    return respond({
      version: WORKSPACE_DIRECTORY_VERSION,
      requestId: parsed.data.requestId,
      error: "Directory synchronization failed.",
      runId,
    }, 500);
  }
}
