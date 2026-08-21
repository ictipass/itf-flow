import { UserRole } from "@/lib/generated/prisma/client";
import { canDispatch } from "@/lib/permissions";

export type StaffNavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  notificationCount?: number;
};

export function getStaffNavigation(role: UserRole, unreadNotifications: number): StaffNavigationItem[] {
  const items: Array<StaffNavigationItem | false> = [
    { href: "/dashboard", label: "Overview", shortLabel: "Home" },
    ([UserRole.DG_SECRETARY, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN] as UserRole[]).includes(role) &&
      { href: "/intake", label: "Shared Secretariat intake", shortLabel: "Intake" },
    { href: "/inbox", label: "My inbox", shortLabel: "Inbox" },
    { href: "/notifications", label: "Notifications", shortLabel: "Alerts", notificationCount: unreadNotifications },
    { href: "/drafts", label: "My drafts", shortLabel: "Drafts" },
    { href: "/correspondence", label: "All correspondence", shortLabel: "Registry" },
    canDispatch(role) && { href: "/dispatch", label: "Dispatch registry", shortLabel: "Dispatch" },
    { href: "/correspondence/new", label: "Raise correspondence", shortLabel: "Create" },
    { href: "/broadcasts", label: "Announcements", shortLabel: "News" },
    { href: "/guide", label: "How it works", shortLabel: "Guide" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/appearance", label: "Appearance", shortLabel: "Display" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/provisioning", label: "Provisioning admin", shortLabel: "Directory" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/email-outbox", label: "Email outbox", shortLabel: "Outbox" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/reminders", label: "Reminder automation", shortLabel: "Reminders" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/delegations", label: "Delegations and acting", shortLabel: "Acting" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/access-groups", label: "Need-to-know access", shortLabel: "Access" },
    role === UserRole.SYSTEM_ADMIN && { href: "/admin/documents", label: "Document security", shortLabel: "Documents" },
  ];
  return items.filter((item): item is StaffNavigationItem => Boolean(item));
}
