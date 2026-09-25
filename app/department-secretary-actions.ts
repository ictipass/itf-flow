"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { departmentIdentity } from "@/lib/department-secretaries";
import { requireUser } from "@/lib/session";

async function administrator() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can manage Department Secretary assignments.");
  return user;
}

export async function assignDepartmentSecretaryAction(formData: FormData) {
  const actor = await administrator();
  const parsed = z.object({ secretaryId: z.string().min(1), reason: z.string().trim().min(10).max(500) }).safeParse({ secretaryId: formData.get("secretaryId"), reason: formData.get("reason") });
  if (!parsed.success) redirect("/admin/department-secretaries?error=validation");
  const secretary = await db.user.findFirst({ where: { id: parsed.data.secretaryId, isActive: true } });
  const department = secretary ? departmentIdentity(secretary) : null;
  if (!secretary || !department) redirect("/admin/department-secretaries?error=department");

  await db.$transaction(async (tx) => {
    const current = await tx.departmentSecretaryAssignment.findUnique({ where: { departmentKey: department.key } });
    const saved = await tx.departmentSecretaryAssignment.upsert({
      where: { departmentKey: department.key },
      create: { departmentKey: department.key, departmentName: department.name, secretaryId: secretary.id, assignedById: actor.id, reason: parsed.data.reason },
      update: { departmentName: department.name, secretaryId: secretary.id, assignedById: actor.id, reason: parsed.data.reason, isActive: true, version: { increment: 1 } },
    });
    await tx.configurationChange.create({ data: {
      setting: `departmentSecretary:${department.key}`,
      previousValue: current ? JSON.stringify({ secretaryId: current.secretaryId, isActive: current.isActive, version: current.version }) : "UNASSIGNED",
      newValue: JSON.stringify({ secretaryId: saved.secretaryId, isActive: saved.isActive, version: saved.version }),
      reason: parsed.data.reason,
      changedById: actor.id,
    } });
  });
  revalidatePath("/admin/department-secretaries");
  redirect("/admin/department-secretaries?assigned=1");
}

export async function deactivateDepartmentSecretaryAction(formData: FormData) {
  const actor = await administrator();
  const parsed = z.object({ assignmentId: z.string().min(1), version: z.coerce.number().int().positive(), reason: z.string().trim().min(10).max(500) }).safeParse({ assignmentId: formData.get("assignmentId"), version: formData.get("version"), reason: formData.get("reason") });
  if (!parsed.success) redirect("/admin/department-secretaries?error=validation");
  const current = await db.departmentSecretaryAssignment.findUnique({ where: { id: parsed.data.assignmentId } });
  if (!current || !current.isActive || current.version !== parsed.data.version) redirect("/admin/department-secretaries?error=stale");
  const changed = await db.$transaction(async (tx) => {
    const update = await tx.departmentSecretaryAssignment.updateMany({ where: { id: current.id, version: current.version, isActive: true }, data: { isActive: false, reason: parsed.data.reason, assignedById: actor.id, version: { increment: 1 } } });
    if (!update.count) return false;
    await tx.configurationChange.create({ data: { setting: `departmentSecretary:${current.departmentKey}`, previousValue: JSON.stringify({ secretaryId: current.secretaryId, isActive: true, version: current.version }), newValue: JSON.stringify({ secretaryId: current.secretaryId, isActive: false, version: current.version + 1 }), reason: parsed.data.reason, changedById: actor.id } });
    return true;
  });
  if (!changed) redirect("/admin/department-secretaries?error=stale");
  revalidatePath("/admin/department-secretaries");
  redirect("/admin/department-secretaries?deactivated=1");
}
