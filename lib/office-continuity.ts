import {
  AvailabilityStatus,
  Classification,
  User,
  UserRole,
} from "@/lib/generated/prisma/client";
import { canReadClassification } from "@/lib/permissions";

type Candidate = {
  user: User;
  rank: 1 | 2;
  canApprove: boolean;
  status?: AvailabilityStatus | null;
  unavailableUntil?: Date | null;
};

export function isCurrentlyAvailable(
  availability: { status?: AvailabilityStatus | null; unavailableUntil?: Date | null } | null | undefined,
  now = new Date(),
) {
  if (!availability || availability.status !== AvailabilityStatus.UNAVAILABLE) return true;
  return Boolean(availability.unavailableUntil && availability.unavailableUntil <= now);
}

export function selectContinuityCandidate(input: {
  candidates: Candidate[];
  classification: Classification;
  requireApproval: boolean;
  now?: Date;
}) {
  return input.candidates.find((candidate) =>
    candidate.user.isActive &&
    isCurrentlyAvailable(candidate, input.now) &&
    canReadClassification(candidate.user.role, input.classification) &&
    (!input.requireApproval || candidate.canApprove),
  ) ?? null;
}

export async function resolveContinuityAssignments(input: {
  intendedRecipients: User[];
  classification: Classification;
  requireApproval: boolean;
}) {
  const { db } = await import("@/lib/db");
  const directorIds = input.intendedRecipients
    .filter((recipient) => recipient.role === UserRole.DIRECTOR)
    .map((recipient) => recipient.id);
  const plans = directorIds.length
    ? await db.directorateContinuityPlan.findMany({
        where: { directorId: { in: directorIds }, isActive: true },
        include: {
          director: { include: { staffAvailability: true } },
          firstSuccessor: { include: { staffAvailability: true } },
          secondSuccessor: { include: { staffAvailability: true } },
        },
      })
    : [];
  const byDirector = new Map(plans.map((plan) => [plan.directorId, plan]));
  const assignments = [];
  const oversightDirectors = [];

  for (const intended of input.intendedRecipients) {
    const plan = byDirector.get(intended.id);
    if (!plan || isCurrentlyAvailable(plan.director.staffAvailability)) {
      assignments.push({ intended, assignee: intended, authorityPrincipal: null, plan: null, rank: null, canApprove: false });
      continue;
    }
    const selected = selectContinuityCandidate({
      candidates: [
        { user: plan.firstSuccessor, rank: 1, canApprove: plan.firstCanApprove, ...plan.firstSuccessor.staffAvailability },
        { user: plan.secondSuccessor, rank: 2, canApprove: plan.secondCanApprove, ...plan.secondSuccessor.staffAvailability },
      ],
      classification: input.classification,
      requireApproval: input.requireApproval,
    });
    if (!selected) {
      const qualifier = input.requireApproval ? " available with approval authority" : " available";
      throw new Error(`No next-in-line officer is${qualifier} for ${plan.departmentName}. Restore availability or update the continuity plan before routing.`);
    }
    assignments.push({
      intended,
      assignee: selected.user,
      authorityPrincipal: plan.director,
      plan,
      rank: selected.rank,
      canApprove: selected.canApprove,
    });
    oversightDirectors.push(plan.director);
  }

  return {
    assignments: [...new Map(assignments.map((assignment) => [assignment.assignee.id, assignment])).values()],
    oversightDirectors: [...new Map(oversightDirectors.map((director) => [director.id, director])).values()],
  };
}

export async function continuityMembership(userId: string) {
  const { db } = await import("@/lib/db");
  return db.directorateContinuityPlan.findMany({
    where: {
      isActive: true,
      OR: [{ directorId: userId }, { firstSuccessorId: userId }, { secondSuccessorId: userId }],
    },
    include: {
      director: { include: { staffAvailability: true } },
      firstSuccessor: { include: { staffAvailability: true } },
      secondSuccessor: { include: { staffAvailability: true } },
    },
    orderBy: { departmentName: "asc" },
  });
}
