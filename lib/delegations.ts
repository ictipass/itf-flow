import { DelegationStatus, RecipientKind, UserRole, WorkItemStatus, WorkPurpose } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canReadClassification } from "@/lib/permissions";

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
  actor: { id: string; role: UserRole };
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
    include: { assignee: true, correspondence: true },
  });
  if (!item || !canReadClassification(input.actor.role, item.correspondence.classification)) return null;
  if (item.assigneeId === input.actor.id) return { item, principal: input.actor, delegation: null };
  const delegation = await db.delegation.findFirst({
    where: { ...activeDelegationWhere(input.actor.id), principalId: item.assigneeId, ...(input.requireApproval ? { canApprove: true } : {}) },
    include: { principal: true },
  });
  return delegation ? { item, principal: delegation.principal, delegation } : null;
}

export function authorityMetadata(authority: Awaited<ReturnType<typeof workAuthority>>) {
  return authority?.delegation ? {
    actedUnderDelegationId: authority.delegation.id,
    actedForUserId: authority.principal.id,
    authorityKind: authority.delegation.kind,
    authorityOffice: authority.delegation.officeLabel,
  } : {};
}

export function approvalRequired(purpose: WorkPurpose) {
  return purpose === WorkPurpose.APPROVAL;
}
