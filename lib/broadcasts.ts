import {
  BroadcastCategory,
  BroadcastScopeType,
  UserRole,
  type User,
} from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";

export type AudienceInput = {
  scopeType: BroadcastScopeType;
  scopeValue: string | null;
  label: string;
};

type DirectoryUser = Pick<User, "id" | "name" | "email" | "role" | "office" | "department" | "division" | "unit" | "workspaceOfficeId" | "workspaceDepartmentId" | "workspaceDivisionId" | "workspaceUnitId">;

function userMatchesScope(user: DirectoryUser, audience: AudienceInput) {
  switch (audience.scopeType) {
    case BroadcastScopeType.ORGANIZATION: return true;
    case BroadcastScopeType.OFFICE: return user.office === audience.scopeValue || user.workspaceOfficeId === audience.scopeValue;
    case BroadcastScopeType.DEPARTMENT: return user.department === audience.scopeValue || user.workspaceDepartmentId === audience.scopeValue;
    case BroadcastScopeType.DIVISION: return user.division === audience.scopeValue || user.workspaceDivisionId === audience.scopeValue;
    case BroadcastScopeType.UNIT: return user.unit === audience.scopeValue || user.workspaceUnitId === audience.scopeValue;
    case BroadcastScopeType.ROLE: return user.role === audience.scopeValue;
    case BroadcastScopeType.USER: return user.id === audience.scopeValue;
  }
}

export async function getActiveBroadcastGrants(userId: string) {
  return db.broadcastPublisherGrant.findMany({
    where: { userId, isActive: true },
    orderBy: [{ scopeType: "asc" }, { scopeValue: "asc" }],
  });
}

export async function authorizeBroadcast(input: {
  userId: string;
  category: BroadcastCategory;
  mandatoryAcknowledgement: boolean;
  audiences: AudienceInput[];
}) {
  const grants = await getActiveBroadcastGrants(input.userId);
  if (!grants.length) throw new Error("You do not have broadcast publishing authority.");
  const targetedUsers = input.audiences.some((audience) => audience.scopeType === BroadcastScopeType.USER)
    ? await db.user.findMany({ where: { id: { in: input.audiences.flatMap((audience) => audience.scopeType === BroadcastScopeType.USER && audience.scopeValue ? [audience.scopeValue] : []) }, isActive: true } })
    : [];

  for (const audience of input.audiences) {
    const matchingGrant = grants.find((grant) => {
      if (!grant.allowedCategories.includes(input.category)) return false;
      if (input.mandatoryAcknowledgement && !grant.canRequireAcknowledgement) return false;
      if (grant.scopeType === BroadcastScopeType.ORGANIZATION) return true;
      if (audience.scopeType === grant.scopeType && audience.scopeValue === grant.scopeValue) return true;
      if (audience.scopeType === BroadcastScopeType.USER) {
        const target = targetedUsers.find((user) => user.id === audience.scopeValue);
        return target ? userMatchesScope(target, { scopeType: grant.scopeType, scopeValue: grant.scopeValue, label: "" }) : false;
      }
      return false;
    });
    if (!matchingGrant) throw new Error(`You are not authorized to publish to ${audience.label}.`);
  }
  return grants;
}

export async function resolveBroadcastRecipients(audiences: AudienceInput[]) {
  const candidates = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true, office: true, department: true, division: true, unit: true, workspaceOfficeId: true, workspaceDepartmentId: true, workspaceDivisionId: true, workspaceUnitId: true },
  });
  return candidates.filter((user) => audiences.some((audience) => userMatchesScope(user, audience)));
}

export async function canCreateBroadcast(userId: string) {
  return (await db.broadcastPublisherGrant.count({ where: { userId, isActive: true } })) > 0;
}

export async function getBroadcastComposerData(userId: string) {
  const grants = await getActiveBroadcastGrants(userId);
  const directory = await db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, staffNumber: true, role: true, office: true, department: true, division: true, unit: true } });
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value)))].sort().map((value) => ({ value, label: value }));
  const organizationGrant = grants.some((grant) => grant.scopeType === BroadcastScopeType.ORGANIZATION);
  const exactValues = (scope: BroadcastScopeType) => grants.filter((grant) => grant.scopeType === scope && grant.scopeValue).map((grant) => grant.scopeValue);
  const options: Record<string, Array<{ value: string; label: string }>> = {};
  if (organizationGrant) options.ORGANIZATION = [{ value: "", label: "Entire organization" }];
  const scoped = [[BroadcastScopeType.OFFICE, directory.map((person) => person.office)], [BroadcastScopeType.DEPARTMENT, directory.map((person) => person.department)], [BroadcastScopeType.DIVISION, directory.map((person) => person.division)], [BroadcastScopeType.UNIT, directory.map((person) => person.unit)]] as const;
  for (const [scope, values] of scoped) {
    const allowed = organizationGrant ? unique(values) : unique(exactValues(scope));
    if (allowed.length) options[scope] = allowed;
  }
  if (organizationGrant) {
    options.ROLE = Object.values(UserRole).map((role) => ({ value: role, label: label(role) }));
    options.USER = directory.map((person) => ({ value: person.id, label: `${person.name} · ${person.staffNumber ?? person.role}` }));
  }
  return { grants, options, categories: [...new Set(grants.flatMap((grant) => grant.allowedCategories))], canRequireAcknowledgement: grants.some((grant) => grant.canRequireAcknowledgement) };
}
