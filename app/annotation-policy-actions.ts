"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { APPEARANCE_CONFIGURATION_ID } from "@/lib/appearance";

const policySchema = z.object({
  version: z.coerce.number().int().positive(),
  reason: z.string().trim().min(10).max(500),
  dg: z.boolean(),
  directors: z.boolean(),
  divisionHeads: z.boolean(),
});

function roleList(policy: { dg: boolean; directors: boolean; divisionHeads: boolean }) {
  return [policy.dg && "DG", policy.directors && "DIRECTOR", policy.divisionHeads && "DIVISION_HEAD"].filter(Boolean).join(",") || "NONE";
}

export async function updateAnnotationAuthenticationPolicyAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const parsed = policySchema.safeParse({
    version: formData.get("version"),
    reason: formData.get("reason"),
    dg: formData.get("dg") === "on",
    directors: formData.get("directors") === "on",
    divisionHeads: formData.get("divisionHeads") === "on",
  });
  if (!parsed.success) redirect("/admin/documents?policyError=validation");

  const outcome = await db.$transaction(async (tx) => {
    const current = await tx.applicationConfiguration.findUnique({ where: { id: APPEARANCE_CONFIGURATION_ID } });
    if (!current) return "missing" as const;
    if (current.version !== parsed.data.version) return "stale" as const;
    const previous = roleList({
      dg: current.annotationMfaRequiredForDg,
      directors: current.annotationMfaRequiredForDirectors,
      divisionHeads: current.annotationMfaRequiredForDivisionHeads,
    });
    const next = roleList(parsed.data);
    if (previous === next) return "unchanged" as const;
    await tx.applicationConfiguration.update({
      where: { id: APPEARANCE_CONFIGURATION_ID },
      data: {
        annotationMfaRequiredForDg: parsed.data.dg,
        annotationMfaRequiredForDirectors: parsed.data.directors,
        annotationMfaRequiredForDivisionHeads: parsed.data.divisionHeads,
        updatedById: user.id,
        version: { increment: 1 },
      },
    });
    await tx.configurationChange.create({
      data: {
        setting: "annotationStrongAuthenticationRoles",
        previousValue: previous,
        newValue: next,
        reason: parsed.data.reason,
        changedById: user.id,
      },
    });
    return "updated" as const;
  });
  if (outcome === "missing") redirect("/admin/documents?policyError=missing");
  if (outcome === "stale") redirect("/admin/documents?policyError=stale");
  if (outcome === "unchanged") redirect("/admin/documents?policyError=unchanged");
  revalidatePath("/admin/documents");
  revalidatePath("/correspondence", "layout");
  redirect("/admin/documents?policyUpdated=1");
}
