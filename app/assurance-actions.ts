"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AssuranceStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function updateAssuranceCheckAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can maintain assurance evidence.");
  const parsed = z.object({ id: z.string().min(1), status: z.enum(AssuranceStatus), owner: z.string().trim().min(2).max(120), evidence: z.string().trim().min(10).max(2000), expiresAt: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/assurance?error=validation");
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  await db.$transaction([
    db.assuranceCheck.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status, owner: parsed.data.owner, evidence: parsed.data.evidence, expiresAt, reviewedAt: new Date(), updatedById: user.id } }),
    db.operationalEvent.create({ data: { severity: parsed.data.status === AssuranceStatus.FAILED ? "ERROR" : "INFO", component: "assurance", eventType: "CHECK_REVIEWED", message: `Assurance check changed to ${parsed.data.status}.`, metadata: { checkId: parsed.data.id, reviewerId: user.id } } }),
  ]);
  revalidatePath("/admin/assurance");
  redirect("/admin/assurance?updated=1");
}
