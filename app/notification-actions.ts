"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function openNotificationAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");
  const notification = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!notification) throw new Error("Notification not found.");
  if (!notification.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  redirect(notification.href);
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications"); revalidatePath("/dashboard");
}
