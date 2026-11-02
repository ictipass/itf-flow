"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const profileSchema = z.object({
  departmentKey: z.string().trim().min(3).max(200),
  emailAddress: z.email().max(254),
  addressLines: z.string().trim().min(10).max(1000),
  reason: z.string().trim().min(10).max(500),
});

export async function configureDepartmentCorrespondenceProfileAction(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/department-correspondence?error=validation");
  const plan = await db.directorateContinuityPlan.findFirst({
    where: { departmentKey: parsed.data.departmentKey, isActive: true },
    include: { director: true },
  });
  if (!plan) redirect("/admin/department-correspondence?error=department");
  const addressLines = parsed.data.addressLines.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (addressLines.length < 2 || addressLines.length > 8) redirect("/admin/department-correspondence?error=address");
  await db.$transaction(async (tx) => {
    const current = await tx.departmentCorrespondenceProfile.findUnique({ where: { departmentKey: plan.departmentKey } });
    const saved = await tx.departmentCorrespondenceProfile.upsert({
      where: { departmentKey: plan.departmentKey },
      create: {
        departmentKey: plan.departmentKey,
        departmentName: plan.departmentName,
        emailAddress: parsed.data.emailAddress.toLowerCase(),
        addressLines,
        reason: parsed.data.reason,
        configuredById: actor.id,
      },
      update: {
        departmentName: plan.departmentName,
        emailAddress: parsed.data.emailAddress.toLowerCase(),
        addressLines,
        reason: parsed.data.reason,
        configuredById: actor.id,
        isActive: true,
        version: { increment: 1 },
      },
    });
    await tx.configurationChange.create({ data: {
      setting: `departmentCorrespondenceProfile:${plan.departmentKey}`,
      previousValue: current ? JSON.stringify({ emailAddress: current.emailAddress, addressLines: current.addressLines, version: current.version, isActive: current.isActive }) : "UNCONFIGURED",
      newValue: JSON.stringify({ emailAddress: saved.emailAddress, addressLines: saved.addressLines, version: saved.version, isActive: saved.isActive }),
      reason: parsed.data.reason,
      changedById: actor.id,
    } });
  });
  revalidatePath("/admin/department-correspondence");
  redirect("/admin/department-correspondence?saved=1");
}
