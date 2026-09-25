import { Classification, UserRole } from "@/lib/generated/prisma/client";

export type DepartmentIdentityInput = {
  department: string | null;
  workspaceDepartmentId: string | null;
};

export type DepartmentRoutingRecipient = DepartmentIdentityInput & {
  id: string;
  role: UserRole;
};

export function departmentIdentity(input: DepartmentIdentityInput) {
  if (input.workspaceDepartmentId) {
    return {
      key: `workspace:${input.workspaceDepartmentId}`,
      name: input.department?.trim() || input.workspaceDepartmentId,
    };
  }
  const name = input.department?.trim();
  if (!name) return null;
  return { key: `name:${name.toLocaleLowerCase("en-NG")}`, name };
}

export function isRestrictedDistribution(classification: Classification) {
  return classification === Classification.CONFIDENTIAL || classification === Classification.SECRET;
}

export function shouldCopyDepartmentSecretary(actorRole: UserRole, classification: Classification) {
  return (actorRole === UserRole.DG || actorRole === UserRole.DIRECTOR) && !isRestrictedDistribution(classification);
}

export function validateConfidentialRoute(input: {
  actorRole: UserRole;
  classification: Classification;
  actionRecipientRoles: UserRole[];
  explicitCopyCount: number;
}) {
  if (!isRestrictedDistribution(input.classification)) return;
  if ((input.actorRole === UserRole.DG || input.actorRole === UserRole.DIRECTOR) && input.explicitCopyCount) {
    throw new Error("Confidential and Secret routing cannot include copy recipients.");
  }
  if (input.actorRole === UserRole.DG && input.actionRecipientRoles.some((role) => role !== UserRole.DIRECTOR)) {
    throw new Error("The DG must route Confidential or Secret correspondence to a Director.");
  }
}

export function routingClassification(input: {
  actorRole: UserRole;
  current: Classification;
  requested?: string | null;
}) {
  const requested = input.requested?.trim();
  if (!requested || requested === input.current) return input.current;
  if (
    (input.actorRole === UserRole.DG || input.actorRole === UserRole.DIRECTOR) &&
    (input.current === Classification.PUBLIC || input.current === Classification.INTERNAL) &&
    requested === Classification.CONFIDENTIAL
  ) {
    return Classification.CONFIDENTIAL;
  }
  throw new Error("Only the DG or a Director may raise Public or Internal correspondence to Confidential during routing.");
}

export async function resolveAutomaticDepartmentSecretaries(input: {
  actorRole: UserRole;
  classification: Classification;
  actionRecipients: DepartmentRoutingRecipient[];
}) {
  if (!shouldCopyDepartmentSecretary(input.actorRole, input.classification)) return [];
  const departments = [...new Map(
    input.actionRecipients
      .map((recipient) => departmentIdentity(recipient))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => [item.key, item]),
  ).values()];
  if (!departments.length) return [];

  const { db } = await import("@/lib/db");
  const assignments = await db.departmentSecretaryAssignment.findMany({
    where: { departmentKey: { in: departments.map((item) => item.key) }, isActive: true, secretary: { isActive: true } },
    include: { secretary: true },
  });
  const byDepartment = new Map(assignments.map((assignment) => [assignment.departmentKey, assignment]));
  const missing = departments.filter((department) => !byDepartment.has(department.key));
  if (missing.length) {
    throw new Error(`Assign an active Department Secretary for ${missing.map((item) => item.name).join(", ")} before routing.`);
  }

  const actionIds = new Set(input.actionRecipients.map((recipient) => recipient.id));
  return [...new Map(
    departments
      .map((department) => byDepartment.get(department.key)!)
      .filter((assignment) => !actionIds.has(assignment.secretaryId))
      .map((assignment) => [assignment.secretaryId, {
        assignmentId: assignment.id,
        departmentKey: assignment.departmentKey,
        departmentName: assignment.departmentName,
        secretary: assignment.secretary,
      }]),
  ).values()];
}
