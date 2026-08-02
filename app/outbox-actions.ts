"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/lib/generated/prisma/client";
import { processEmailOutbox } from "@/lib/email-outbox";
import { requireUser } from "@/lib/session";

export async function processEmailOutboxAction() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can process email delivery.");
  let destination: string;
  try {
    const result = await processEmailOutbox(20);
    destination = `/admin/email-outbox?considered=${result.considered}&sent=${result.sent}&failed=${result.failed}`;
  } catch {
    destination = "/admin/email-outbox?error=mail-configuration";
  }
  revalidatePath("/admin/email-outbox");
  redirect(destination);
}
