"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { processWorkflowReminders, REMINDER_POLICY_ID } from "@/lib/reminders";
import { requireUser } from "@/lib/session";

async function requireAdministrator() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can manage workflow reminders.");
  return user;
}

function validTimeZone(value: string) {
  try { new Intl.DateTimeFormat("en-NG", { timeZone: value }); return true; } catch { return false; }
}

export async function updateReminderPolicyAction(formData: FormData) {
  const user = await requireAdministrator();
  const parsed = z.object({
    reminderLeadDays: z.coerce.number().int().min(0).max(30),
    escalationAfterDays: z.coerce.number().int().min(0).max(30),
    timeZone: z.string().trim().min(3).max(80).refine(validTimeZone),
    version: z.coerce.number().int().positive(),
    reason: z.string().trim().min(10).max(500),
  }).safeParse({ reminderLeadDays: formData.get("reminderLeadDays"), escalationAfterDays: formData.get("escalationAfterDays"), timeZone: formData.get("timeZone"), version: formData.get("version"), reason: formData.get("reason") });
  if (!parsed.success) redirect("/admin/reminders?error=validation");
  const enabled = formData.get("enabled") === "on";
  const executiveDigestEnabled = formData.get("executiveDigestEnabled") === "on";
  const result = await db.$transaction(async (tx) => {
    const current = await tx.workflowReminderPolicy.findUnique({ where: { id: REMINDER_POLICY_ID } });
    if (!current || current.version !== parsed.data.version) return "stale" as const;
    const before = JSON.stringify({ enabled: current.enabled, reminderLeadDays: current.reminderLeadDays, escalationAfterDays: current.escalationAfterDays, executiveDigestEnabled: current.executiveDigestEnabled, timeZone: current.timeZone });
    const after = JSON.stringify({ enabled, reminderLeadDays: parsed.data.reminderLeadDays, escalationAfterDays: parsed.data.escalationAfterDays, executiveDigestEnabled, timeZone: parsed.data.timeZone });
    await tx.workflowReminderPolicy.update({ where: { id: current.id }, data: { enabled, reminderLeadDays: parsed.data.reminderLeadDays, escalationAfterDays: parsed.data.escalationAfterDays, executiveDigestEnabled, timeZone: parsed.data.timeZone, version: { increment: 1 }, updatedById: user.id } });
    await tx.configurationChange.create({ data: { setting: "workflowReminderPolicy", previousValue: before, newValue: after, reason: parsed.data.reason, changedById: user.id } });
    return "updated" as const;
  });
  if (result === "stale") redirect("/admin/reminders?error=stale");
  revalidatePath("/admin/reminders");
  redirect("/admin/reminders?updated=1");
}

export async function runReminderAutomationAction() {
  await requireAdministrator();
  let destination: string;
  try {
    const result = await processWorkflowReminders();
    revalidatePath("/admin/reminders");
    destination = `/admin/reminders?ran=1&reminders=${result.reminders}&overdue=${result.overdue}&escalations=${result.escalations}&digests=${result.digests}`;
  } catch {
    destination = "/admin/reminders?error=run";
  }
  redirect(destination);
}
