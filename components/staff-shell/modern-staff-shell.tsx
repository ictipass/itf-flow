import Image from "next/image";
import Link from "next/link";
import {
  Bell, BookOpen, Boxes, Building2, FileClock, FilePlus2, Files, Home, Inbox,
  LogOut, MailCheck, Megaphone, Menu, Palette, PenLine, Send, Settings2,
} from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { User } from "@/lib/generated/prisma/client";
import { label } from "@/lib/reference";
import type { StaffNavigationItem } from "@/lib/staff-navigation";

const navigationIcons: Record<string, typeof Home> = {
  "/dashboard": Home,
  "/intake": MailCheck,
  "/inbox": Inbox,
  "/notifications": Bell,
  "/drafts": FileClock,
  "/correspondence": Files,
  "/dispatch": Send,
  "/correspondence/new": FilePlus2,
  "/broadcasts": Megaphone,
  "/guide": BookOpen,
  "/admin/appearance": Palette,
  "/admin/provisioning": Building2,
  "/admin/email-outbox": Boxes,
};

function NavigationLinks({ navigation }: { navigation: StaffNavigationItem[] }) {
  return navigation.map((item) => {
    const Icon = navigationIcons[item.href] ?? Settings2;
    return <Link className="modern-nav-link" key={item.href} href={item.href} title={item.label}>
      <Icon size={20} aria-hidden="true" /><span>{item.shortLabel}</span>
      {item.notificationCount ? <b aria-label={`${item.notificationCount} unread`}>{item.notificationCount}</b> : null}
    </Link>;
  });
}

export function ModernStaffShell({ user, navigation, children }: {
  user: User;
  navigation: StaffNavigationItem[];
  children: React.ReactNode;
}) {
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  return <div className="modern-shell">
    <aside className="modern-rail">
      <Link href="/dashboard" className="modern-logo" aria-label="ITF Flow home"><Image src="/itf-logo.png" alt="" width={44} height={44} priority /></Link>
      <nav aria-label="Staff navigation"><NavigationLinks navigation={navigation} /></nav>
    </aside>
    <div className="modern-workspace">
      <header className="modern-header">
        <details className="modern-mobile-menu">
          <summary aria-label="Open navigation"><Menu size={22} /></summary>
          <nav aria-label="Mobile staff navigation"><NavigationLinks navigation={navigation} /></nav>
        </details>
        <div className="modern-product"><strong>ITF Flow</strong><span>Correspondence workspace</span></div>
        <div className="modern-header-actions">
          <Link className="modern-create" href="/correspondence/new"><PenLine size={17} /> <span>Raise correspondence</span></Link>
          <Link className="modern-alert-button" href="/notifications" aria-label="Open notifications"><Bell size={20} />{navigation.find((item) => item.href === "/notifications")?.notificationCount ? <i /> : null}</Link>
          <div className="modern-user"><span>{initials}</span><div><strong>{user.name}</strong><small>{label(user.role)} · {user.office}</small></div></div>
          <form action={logoutAction}><button className="modern-logout" type="submit" title="Sign out"><LogOut size={19} /><span className="sr-only">Sign out</span></button></form>
        </div>
      </header>
      <main className="modern-content">{children}</main>
    </div>
  </div>;
}
