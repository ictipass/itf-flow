"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { StaffUiMode, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { APPEARANCE_CONFIGURATION_ID, UI_PREVIEW_COOKIE } from "@/lib/appearance";

async function requireSystemAdministrator() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can change the staff experience.");
  return user;
}

export async function previewStaffUiAction(formData: FormData) {
  await requireSystemAdministrator();
  const mode = z.enum(StaffUiMode).parse(formData.get("mode"));
  (await cookies()).set(UI_PREVIEW_COOKIE, mode, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });
  redirect("/dashboard");
}

export async function clearStaffUiPreviewAction() {
  await requireSystemAdministrator();
  (await cookies()).delete(UI_PREVIEW_COOKIE);
  redirect("/admin/appearance");
}

export async function activateStaffUiAction(formData: FormData) {
  const user = await requireSystemAdministrator();
  const parsed = z.object({
    mode: z.enum(StaffUiMode),
    reason: z.string().trim().min(10).max(500),
    version: z.coerce.number().int().positive(),
  }).safeParse({
    mode: formData.get("mode"),
    reason: formData.get("reason"),
    version: formData.get("version"),
  });
  if (!parsed.success) redirect("/admin/appearance?error=validation");

  const result = await db.$transaction(async (tx) => {
    const current = await tx.applicationConfiguration.findUnique({ where: { id: APPEARANCE_CONFIGURATION_ID } });
    const previousMode = current?.staffUiMode ?? StaffUiMode.CLASSIC;
    const currentVersion = current?.version ?? 1;
    if (current && currentVersion !== parsed.data.version) return "stale" as const;
    if (previousMode === parsed.data.mode) return "unchanged" as const;

    await tx.applicationConfiguration.upsert({
      where: { id: APPEARANCE_CONFIGURATION_ID },
      create: { id: APPEARANCE_CONFIGURATION_ID, staffUiMode: parsed.data.mode, updatedById: user.id, version: 2 },
      update: { staffUiMode: parsed.data.mode, updatedById: user.id, version: { increment: 1 } },
    });
    await tx.configurationChange.create({
      data: {
        setting: "staffUiMode",
        previousValue: previousMode,
        newValue: parsed.data.mode,
        reason: parsed.data.reason,
        changedById: user.id,
      },
    });
    return "updated" as const;
  });

  if (result === "stale") redirect("/admin/appearance?error=stale");
  if (result === "unchanged") redirect("/admin/appearance?error=unchanged");
  (await cookies()).delete(UI_PREVIEW_COOKIE);
  revalidatePath("/", "layout");
  redirect("/admin/appearance?updated=1");
}
