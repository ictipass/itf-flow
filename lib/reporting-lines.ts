import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

async function getActorRoutingContext(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      department: true,
      workspaceDepartmentId: true,
      supervisorId: true,
      directReports: { where: { isActive: true }, select: { id: true } },
    },
  });
}

async function findPeerIds(
  userId: string,
  role: UserRole,
  department: string | null,
  workspaceDepartmentId: string | null,
) {
  if (role !== UserRole.DIRECTOR && role !== UserRole.DIVISION_HEAD) return [];
  if (role === UserRole.DIVISION_HEAD && !workspaceDepartmentId && !department) return [];
  const peers = await db.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
      role,
      ...(role === UserRole.DIVISION_HEAD
        ? workspaceDepartmentId
          ? { workspaceDepartmentId }
          : { department }
        : {}),
    },
    select: { id: true },
  });
  return peers.map((peer) => peer.id);
}

export async function getRoutingPolicy(userId: string, role: UserRole) {
  if (role === UserRole.SYSTEM_ADMIN) return { permittedIds: null, peerIds: [] as string[] };
  const actor = await getActorRoutingContext(userId);
  if (!actor) return { permittedIds: [] as string[], peerIds: [] as string[] };
  const peerIds = await findPeerIds(
    userId,
    role,
    actor.department,
    actor.workspaceDepartmentId,
  );
  const permittedIds = [...new Set([
    ...(actor.supervisorId ? [actor.supervisorId] : []),
    ...actor.directReports.map((report) => report.id),
    ...peerIds,
  ])];
  return { permittedIds, peerIds };
}

export async function getPermittedActionRecipientIds(userId: string, role: UserRole) {
  return (await getRoutingPolicy(userId, role)).permittedIds;
}

export async function evaluateActionRouting(input: {
  actorId: string;
  actorRole: UserRole;
  recipientIds: string[];
}) {
  const policy = await getRoutingPolicy(input.actorId, input.actorRole);
  const permitted = policy.permittedIds === null || input.recipientIds.every((id) => policy.permittedIds!.includes(id));
  const peerSet = new Set(policy.peerIds);
  return { permitted, isPeerReferral: input.recipientIds.some((id) => peerSet.has(id)) };
}

export async function actionRecipientsFollowReportingLine(input: {
  actorId: string;
  actorRole: UserRole;
  recipientIds: string[];
}) {
  return (await evaluateActionRouting(input)).permitted;
}
