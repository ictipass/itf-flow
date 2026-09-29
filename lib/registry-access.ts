import { Classification, RegistryScope, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getApplicationConfiguration } from "@/lib/appearance";
import { hasActiveEnterpriseMfa } from "@/lib/session";
import { activeRegistryAppointmentWhere, registryCanRead } from "@/lib/records-governance";

export type RegistryAccessUser = { id: string; role: UserRole };

export async function activeRegistryScope(user: RegistryAccessUser) {
  const appointments = await db.registryAppointment.findMany({
    where: activeRegistryAppointmentWhere(user.id),
    select: { scope: true },
  });
  if (appointments.some((item) => item.scope === RegistryScope.SECRET)) return RegistryScope.SECRET;
  if (appointments.some((item) => item.scope === RegistryScope.OPEN)) return RegistryScope.OPEN;
  return user.role === UserRole.RECORDS_ADMIN ? RegistryScope.OPEN : null;
}

export async function registryAuthorizationFor(user: RegistryAccessUser, classification: Classification) {
  const scope = await activeRegistryScope(user);
  if (!scope || !registryCanRead(scope, classification)) return { scope, allowed: false, needsStepUp: false };
  if (scope === RegistryScope.SECRET && (classification === Classification.CONFIDENTIAL || classification === Classification.SECRET)) {
    const configuration = await getApplicationConfiguration();
    if (configuration.secretRegistryMfaRequired && !await hasActiveEnterpriseMfa()) return { scope, allowed: false, needsStepUp: true };
  }
  return { scope, allowed: true, needsStepUp: false };
}

export async function registryListAuthorization(user: RegistryAccessUser) {
  const scope = await activeRegistryScope(user);
  if (!scope) return { scope: null, allowed: false, needsStepUp: false };
  if (scope === RegistryScope.SECRET) {
    const configuration = await getApplicationConfiguration();
    if (configuration.secretRegistryMfaRequired && !await hasActiveEnterpriseMfa()) return { scope, allowed: false, needsStepUp: true };
  }
  return { scope, allowed: true, needsStepUp: false };
}
