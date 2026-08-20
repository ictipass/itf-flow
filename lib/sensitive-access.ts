import { Classification, Prisma, SensitiveAccessType, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canReadClassification } from "@/lib/permissions";
import { hasActiveStepUp } from "@/lib/session";

export type AccessUser = { id: string; role: UserRole };

export async function sensitiveRecordScope(user: AccessUser): Promise<Prisma.CorrespondenceWhereInput> {
  const steppedUp = await hasActiveStepUp();
  return {
    AND: [
      canReadClassification(user.role, Classification.SECRET) && steppedUp ? {} : { classification: { not: Classification.SECRET } },
      { OR: [
        { createdById: user.id },
        { accessGroups: { none: {} } },
        { accessGroups: { some: { group: { isActive: true, members: { some: { userId: user.id } } } } } },
      ] },
    ],
  };
}

export async function canAccessSensitiveRecord(input: { user: AccessUser; classification: Classification; createdById: string | null; hasAccessGroups: boolean; groupMemberIds: string[] }) {
  if (!canReadClassification(input.user.role, input.classification)) return { allowed: false, needsStepUp: false };
  if (input.hasAccessGroups && input.createdById !== input.user.id && !input.groupMemberIds.includes(input.user.id)) return { allowed: false, needsStepUp: false };
  if (input.classification === Classification.SECRET && !await hasActiveStepUp()) return { allowed: false, needsStepUp: true };
  return { allowed: true, needsStepUp: false };
}

export async function logSensitiveAccess(input: { correspondenceId: string; userId: string; type: SensitiveAccessType; detail?: string; ipAddress?: string | null; userAgent?: string | null }) {
  await db.sensitiveAccessEvent.create({ data: input });
}
