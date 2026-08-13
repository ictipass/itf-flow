import { StaffUiMode } from "@/lib/generated/prisma/client";
import { requireUser } from "@/lib/session";
import { getDashboardData } from "@/lib/dashboard";
import { getStaffAppearance } from "@/lib/appearance";
import { ClassicDashboard } from "@/components/dashboard/classic-dashboard";
import { ModernDashboard } from "@/components/dashboard/modern-dashboard";
import { SoftUiDashboard } from "@/components/dashboard/soft-ui-dashboard";
import { canDispatch } from "@/lib/permissions";

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, appearance] = await Promise.all([
    getDashboardData(user.id),
    getStaffAppearance(user.role),
  ]);
  const Dashboard = appearance.mode === StaffUiMode.MODERN
    ? ModernDashboard
    : appearance.mode === StaffUiMode.SOFT_UI
      ? SoftUiDashboard
      : ClassicDashboard;
  return <Dashboard firstName={user.name.split(" ")[0]} data={data} showDispatch={canDispatch(user.role)} />;
}
