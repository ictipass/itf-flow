import { Classification, UserRole } from "@/lib/generated/prisma/client";

const secretReaders = new Set<UserRole>([
  UserRole.DG,
  UserRole.DG_SECRETARY,
  UserRole.SYSTEM_ADMIN,
]);

export function canReadClassification(role: UserRole, classification: Classification) {
  return classification !== Classification.SECRET || secretReaders.has(role);
}

export function canRegister(role: UserRole) {
  const roles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  return roles.includes(role);
}

export function canOriginate(role: UserRole) {
  return Object.values(UserRole).includes(role);
}

const adjacentRoleMap: Partial<Record<UserRole, UserRole[]>> = {
  [UserRole.OFFICER]: [UserRole.UNIT_HEAD],
  [UserRole.UNIT_HEAD]: [UserRole.OFFICER, UserRole.DIVISION_HEAD],
  [UserRole.DIVISION_HEAD]: [UserRole.UNIT_HEAD, UserRole.DIRECTOR],
  [UserRole.DIRECTOR]: [UserRole.DIVISION_HEAD, UserRole.DG],
  [UserRole.DG]: [UserRole.DIRECTOR],
};

export function getAdjacentRoles(role: UserRole) {
  return adjacentRoleMap[role] ?? [];
}

export function canMinute(role: UserRole) {
  const roles: UserRole[] = [
    UserRole.DG,
    UserRole.DIRECTOR,
    UserRole.DIVISION_HEAD,
    UserRole.UNIT_HEAD,
    UserRole.OFFICER,
    UserRole.SYSTEM_ADMIN,
  ];
  return roles.includes(role);
}
