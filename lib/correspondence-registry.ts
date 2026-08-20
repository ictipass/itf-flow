import {
  Classification,
  CorrespondenceStatus,
  Prisma,
  Priority,
  UserRole,
} from "@/lib/generated/prisma/client";
import { sensitiveRecordScope } from "@/lib/sensitive-access";

export type RegistryParams = {
  q?: string;
  office?: string;
  department?: string;
  classification?: string;
  priority?: string;
  owner?: string;
  status?: string;
  from?: string;
  to?: string;
};

type RegistryUser = { id: string; role: UserRole };

const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];

function enumValue<T extends Record<string, string>>(values: T, value?: string) {
  return value && Object.values(values).includes(value) ? value as T[keyof T] : undefined;
}

function dateValue(value?: string, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+01:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeRegistryParams(raw: Record<string, string | string[] | undefined>): RegistryParams {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => {
    const scalar = Array.isArray(value) ? value[0] : value;
    return [key, scalar?.trim().slice(0, 120) || undefined];
  }));
}

export async function registryWhere(user: RegistryUser, raw: RegistryParams): Promise<Prisma.CorrespondenceWhereInput> {
  const params = normalizeRegistryParams(raw);
  const q = params.q;
  const owner = params.owner;
  const office = params.office;
  const department = params.department;
  const classification = enumValue(Classification, params.classification);
  const priority = enumValue(Priority, params.priority);
  const status = enumValue(CorrespondenceStatus, params.status);
  const now = new Date();
  const receivedAt = { gte: dateValue(params.from), lte: dateValue(params.to, true) };
  const scope: Prisma.CorrespondenceWhereInput = broadRoles.includes(user.role)
    ? {}
    : { OR: [{ createdById: user.id }, { workItems: { some: { assigneeId: user.id } } }, { workItems: { some: { assignee: { authorityDelegations: { some: { delegateId: user.id, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } } } } } } }] };
  const classificationScope = await sensitiveRecordScope(user);
  const peopleFilter: Prisma.UserWhereInput = {
    ...(owner ? { OR: ["name", "email", "staffNumber"].map((field) => ({ [field]: { contains: owner, mode: "insensitive" as const } })) } : {}),
    ...(office ? { office: { contains: office, mode: "insensitive" } } : {}),
    ...(department ? { department: { contains: department, mode: "insensitive" } } : {}),
  };
  const hasPeopleFilter = Boolean(owner || office || department);

  return {
    AND: [
      { status: { not: CorrespondenceStatus.DRAFT } },
      scope,
      classificationScope,
      classification ? { classification } : {},
      priority ? { priority } : {},
      status ? { status } : {},
      receivedAt.gte || receivedAt.lte ? { receivedAt } : {},
      hasPeopleFilter ? { OR: [{ createdBy: peopleFilter }, { workItems: { some: { assignee: peopleFilter, status: { in: ["OPEN", "ACKNOWLEDGED"] } } } }] } : {},
      q ? {
        OR: [
          { referenceNumber: { contains: q, mode: "insensitive" } },
          { senderReference: { contains: q, mode: "insensitive" } },
          { senderName: { contains: q, mode: "insensitive" } },
          { subject: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
          { events: { some: { minute: { contains: q, mode: "insensitive" } } } },
          { secretariatRecord: { is: { trackingCode: { contains: q, mode: "insensitive" } } } },
        ],
      } : {},
    ],
  };
}

export function registryQueryString(params: RegistryParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeRegistryParams(params))) if (value) search.set(key, value);
  return search.toString();
}

export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvResponse(rows: unknown[][], filename: string) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
