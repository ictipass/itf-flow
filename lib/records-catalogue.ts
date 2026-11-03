import { UserRole, type User } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import type { OrganizationUnitOption, RecordSeriesOption } from "@/lib/records-catalogue-shared";

type DirectoryUser = Pick<User,
  "office" | "department" | "division" | "unit" |
  "workspaceOfficeId" | "workspaceDepartmentId" | "workspaceDivisionId" | "workspaceUnitId"
>;

function slug(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function addOption(target: Map<string, OrganizationUnitOption>, name: string | null, workspaceId: string | null, level: OrganizationUnitOption["level"]) {
  const normalizedName = name?.trim();
  if (!normalizedName) return;
  const key = workspaceId?.trim() ? `workspace:${workspaceId.trim()}` : `name:${slug(normalizedName)}`;
  target.set(key, { key, name: normalizedName, level });
}

export function organizationUnitOptionsFromUsers(users: DirectoryUser[]) {
  const options = new Map<string, OrganizationUnitOption>();
  for (const user of users) {
    addOption(options, user.office, user.workspaceOfficeId, "OFFICE");
    addOption(options, user.department, user.workspaceDepartmentId, "DEPARTMENT");
    addOption(options, user.division, user.workspaceDivisionId, "DIVISION");
    addOption(options, user.unit, user.workspaceUnitId, "UNIT");
  }
  return [...options.values()].sort((left, right) => left.level.localeCompare(right.level) || left.name.localeCompare(right.name));
}

export function preferredOrganizationUnitKey(user: DirectoryUser) {
  const options = new Map<string, OrganizationUnitOption>();
  addOption(options, user.office, user.workspaceOfficeId, "OFFICE");
  addOption(options, user.department, user.workspaceDepartmentId, "DEPARTMENT");
  addOption(options, user.division, user.workspaceDivisionId, "DIVISION");
  addOption(options, user.unit, user.workspaceUnitId, "UNIT");
  const values = [...options.values()];
  return values.find((item) => item.level === "UNIT")?.key
    ?? values.find((item) => item.level === "DIVISION")?.key
    ?? values.find((item) => item.level === "DEPARTMENT")?.key
    ?? values.find((item) => item.level === "OFFICE")?.key
    ?? "";
}

export async function activeOrganizationUnitOptions() {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: {
      office: true, department: true, division: true, unit: true,
      workspaceOfficeId: true, workspaceDepartmentId: true, workspaceDivisionId: true, workspaceUnitId: true,
    },
  });
  return organizationUnitOptionsFromUsers(users);
}

export async function activeRecordSeriesOptions(): Promise<RecordSeriesOption[]> {
  const series = await db.recordSeries.findMany({
    where: { isActive: true, retentionPolicy: { isActive: true } },
    include: { retentionPolicy: true },
    orderBy: [{ category: "asc" }, { title: "asc" }, { version: "desc" }],
  });
  return series.map((item) => ({
    id: item.id,
    code: item.code,
    title: item.title,
    description: item.description,
    category: item.category,
    version: item.version,
    defaultOwnerOrgUnitKey: item.defaultOwnerOrgUnitKey,
    defaultOwnerOrgUnitName: item.defaultOwnerOrgUnitName,
    legacyUnit: item.legacyUnit,
    legacyBoxCategory: item.legacyBoxCategory,
    retentionPolicy: {
      id: item.retentionPolicy.id,
      code: item.retentionPolicy.code,
      name: item.retentionPolicy.name,
      description: item.retentionPolicy.description,
      trigger: item.retentionPolicy.trigger,
      durationYears: item.retentionPolicy.durationYears,
      disposition: item.retentionPolicy.disposition,
      version: item.retentionPolicy.version,
    },
  }));
}

export function canManageRecordsCatalogue(role: UserRole) {
  return role === UserRole.RECORDS_ADMIN || role === UserRole.SYSTEM_ADMIN;
}
