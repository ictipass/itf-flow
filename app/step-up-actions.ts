"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { elevateSession, requireUser } from "@/lib/session";

export async function stepUpAction(formData: FormData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/inbox");
  const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/inbox";
  if (!user.passwordHash || !await bcrypt.compare(password, user.passwordHash)) redirect(`/step-up?error=credentials&returnTo=${encodeURIComponent(safeReturn)}`);
  await elevateSession(user.id);
  redirect(safeReturn);
}
