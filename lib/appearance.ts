import { cookies } from "next/headers";
import { cache } from "react";
import { StaffUiMode, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";

export const APPEARANCE_CONFIGURATION_ID = "default";
export const UI_PREVIEW_COOKIE = "itf_flow_ui_preview";

export const getApplicationConfiguration = cache(async function getApplicationConfiguration() {
  const configuration = await db.applicationConfiguration.findUnique({
    where: { id: APPEARANCE_CONFIGURATION_ID },
    include: { updatedBy: true },
  });
  if (!configuration) throw new Error("Application configuration is unavailable. Apply the latest database migration.");
  return configuration;
});

export async function getStaffAppearance(role: UserRole) {
  if (role === UserRole.SYSTEM_ADMIN) {
    const preview = (await cookies()).get(UI_PREVIEW_COOKIE)?.value;
    if (preview === StaffUiMode.CLASSIC || preview === StaffUiMode.MODERN) {
      return { mode: preview, isPreview: true };
    }
  }
  return { mode: (await getApplicationConfiguration()).staffUiMode, isPreview: false };
}
