import { requireUser } from "@/lib/session";
import { StaffUiMode } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getStaffAppearance } from "@/lib/appearance";
import { getStaffNavigation } from "@/lib/staff-navigation";
import { ClassicStaffShell } from "@/components/staff-shell/classic-staff-shell";
import { ModernStaffShell } from "@/components/staff-shell/modern-staff-shell";
import { clearStaffUiPreviewAction } from "@/app/appearance-actions";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unreadNotifications, appearance] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    getStaffAppearance(user.role),
  ]);
  const navigation = getStaffNavigation(user.role, unreadNotifications);
  const Shell = appearance.mode === StaffUiMode.MODERN ? ModernStaffShell : ClassicStaffShell;
  return (
    <Shell user={user} navigation={navigation}>
      {appearance.isPreview ? <div className="ui-preview-banner"><span><strong>Preview mode</strong> · Only you can see this interface.</span><form action={clearStaffUiPreviewAction}><button type="submit">Exit preview</button></form></div> : null}
      {children}
    </Shell>
  );
}
