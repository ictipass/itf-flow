"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RegistryScope, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { APPEARANCE_CONFIGURATION_ID } from "@/lib/appearance";

async function administrator() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  return user;
}

export async function createRegistryAppointmentAction(formData: FormData) {
  const actor = await administrator();
  const parsed = z.object({ userId: z.string().min(1), scope: z.enum(RegistryScope), reason: z.string().trim().min(10).max(500), endsAt: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/records?error=validation");
  const user = await db.user.findFirst({ where: { id: parsed.data.userId, isActive: true }, select: { id: true } });
  if (!user) redirect("/admin/records?error=user");
  const endsAt = parsed.data.endsAt ? new Date(`${parsed.data.endsAt}T23:59:59.999+01:00`) : null;
  if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= new Date())) redirect("/admin/records?error=date");
  await db.$transaction(async (tx) => {
    const created = await tx.registryAppointment.create({ data: { userId: user.id, scope: parsed.data.scope, reason: parsed.data.reason, endsAt, createdById: actor.id } });
    await tx.configurationChange.create({ data: { setting: "REGISTRY_APPOINTMENT_CREATED", previousValue: "NONE", newValue: `${created.id}:${created.scope}:${created.userId}`, reason: parsed.data.reason, changedById: actor.id } });
  });
  revalidatePath("/admin/records");
  revalidatePath("/records");
  redirect("/admin/records?created=1");
}

export async function revokeRegistryAppointmentAction(formData: FormData) {
  const actor = await administrator();
  const parsed = z.object({ appointmentId: z.string().min(1), reason: z.string().trim().min(10).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/records?error=validation");
  const now = new Date();
  const updated = await db.registryAppointment.updateMany({ where: { id: parsed.data.appointmentId, revokedAt: null }, data: { revokedAt: now, revokedById: actor.id } });
  if (!updated.count) redirect("/admin/records?error=stale");
  await db.configurationChange.create({ data: { setting: "REGISTRY_APPOINTMENT_REVOKED", previousValue: parsed.data.appointmentId, newValue: "REVOKED", reason: parsed.data.reason, changedById: actor.id } });
  revalidatePath("/admin/records");
  revalidatePath("/records");
  redirect("/admin/records?revoked=1");
}

export async function updateSecretRegistryMfaPolicyAction(formData: FormData) {
  const actor = await administrator();
  const parsed = z.object({ version: z.coerce.number().int().positive(), reason: z.string().trim().min(10).max(500), required: z.boolean() }).safeParse({ version: formData.get("version"), reason: formData.get("reason"), required: formData.get("required") === "on" });
  if (!parsed.success) redirect("/admin/records?error=policy-validation");
  const outcome = await db.$transaction(async (tx) => {
    const configuration = await tx.applicationConfiguration.findUnique({ where: { id: APPEARANCE_CONFIGURATION_ID } });
    if (!configuration) return "missing";
    if (configuration.version !== parsed.data.version) return "stale";
    if (configuration.secretRegistryMfaRequired === parsed.data.required) return "unchanged";
    await tx.applicationConfiguration.update({ where: { id: configuration.id }, data: { secretRegistryMfaRequired: parsed.data.required, updatedById: actor.id, version: { increment: 1 } } });
    await tx.configurationChange.create({ data: { setting: "secretRegistryMfaRequired", previousValue: String(configuration.secretRegistryMfaRequired), newValue: String(parsed.data.required), reason: parsed.data.reason, changedById: actor.id } });
    return "updated";
  });
  if (outcome !== "updated") redirect(`/admin/records?error=${outcome}`);
  revalidatePath("/admin/records");
  revalidatePath("/records");
  redirect("/admin/records?policy=1");
}
