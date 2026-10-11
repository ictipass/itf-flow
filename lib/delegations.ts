import { DelegationStatus, RecipientKind, UserRole, WorkItemStatus, WorkPurpose } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canAccessSensitiveRecord } from "@/lib/sensitive-access";
import { isCurrentlyAvailable } from "@/lib/office-continuity";

export const activeDelegationWhere = (delegateId: string, now = new Date()) => ({
  delegateId,
  status: DelegationStatus.ACTIVE,
  startsAt: { lte: now },
  endsAt: { gte: now },
} as const);

export async function activeDelegationsFor(delegateId: string) {
  return db.delegation.findMany({
    where: activeDelegationWhere(delegateId),
    include: { principal: true },
    orderBy: { endsAt: "asc" },
  });
}

export async function workAuthority(input: {
  correspondenceId: string;
  actor: { id: string; role: UserRole; name: string };
  requireApproval?: boolean;
}) {
  const item = await db.workItem.findFirst({
    where: {
      correspondenceId: input.correspondenceId,
      kind: RecipientKind.ACTION,
      status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] },
      OR: [
        { assigneeId: input.actor.id },
        { assignee: { authorityDelegations: { some: { ...activeDelegationWhere(input.actor.id), ...(input.requireApproval ? { canApprove: true } : {}) } } } },
      ],
    },
    include: {
      assignee: { include: { staffAvailability: true } },
      authorityPrincipal: true,
      continuityPlan: true,
      correspondence: { include: { accessGroups: { include: { group: { include: { members: true } } } } } },
    },
  });
  if (!item) return null;
  const policy = await canAccessSensitiveRecord({ user: input.actor, classification: item.correspondence.classification, createdById: item.correspondence.createdById, hasAccessGroups: item.correspondence.accessGroups.length > 0, groupMemberIds: [...new Set(item.correspondence.accessGroups.flatMap((entry) => entry.group.isActive ? entry.group.members.map((member) => member.userId) : []))] });
  if (!policy.allowed) return null;
  if (item.assigneeId === input.actor.id) {
    if (item.continuityPlanId && !isCurrentlyAvailable(item.assignee.staffAvailability)) return null;
    if (input.requireApproval && item.continuityPlanId && !item.continuityCanApprove) return null;
    return {
      item,
      principal: item.authorityPrincipal ?? input.actor,
      delegation: null,
      continuity: item.continuityPlanId ? item.continuityPlan : null,
    };
  }
  const delegation = await db.delegation.findFirst({
    where: { ...activeDelegationWhere(input.actor.id), principalId: item.assigneeId, ...(input.requireApproval ? { canApprove: true } : {}) },
    include: { principal: true },
  });
  return delegation ? { item, principal: delegation.principal, delegation, continuity: null } : null;
}

export function authorityMetadata(authority: Awaited<ReturnType<typeof workAuthority>>) {
  if (authority?.delegation) return {
    actedUnderDelegationId: authority.delegation.id,
    actedForUserId: authority.principal.id,
    authorityKind: authority.delegation.kind,
    authorityOffice: authority.delegation.officeLabel,
  };
  if (authority?.continuity) return {
    actedUnderContinuityPlanId: authority.continuity.id,
    actedForUserId: authority.principal.id,
    authorityKind: "DIRECTORATE_CONTINUITY",
    authorityOffice: authority.continuity.departmentName,
    continuityRank: authority.item.continuityRank,
    continuityPlanVersion: authority.continuity.version,
  };
  return {};
}

export function approvalRequired(purpose: WorkPurpose) {
  return purpose === WorkPurpose.APPROVAL;
}
