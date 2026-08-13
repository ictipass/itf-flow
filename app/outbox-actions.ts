"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/lib/generated/prisma/client";
import { processEmailOutbox, retryEmailOutbox } from "@/lib/email-outbox";
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

export async function retryEmailOutboxAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) throw new Error("Only a system administrator can retry email delivery.");
  const outboxId = String(formData.get("outboxId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10 || reason.length > 500) redirect("/admin/email-outbox?error=retry-reason");
  await retryEmailOutbox(outboxId, reason, user.id);
  revalidatePath("/admin/email-outbox");
  redirect("/admin/email-outbox?retried=1");
}
