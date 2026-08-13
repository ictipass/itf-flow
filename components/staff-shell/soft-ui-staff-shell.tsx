import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Menu, PenLine } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { User } from "@/lib/generated/prisma/client";
import { label } from "@/lib/reference";
import type { StaffNavigationItem } from "@/lib/staff-navigation";

function SoftNavigation({ navigation }: { navigation: StaffNavigationItem[] }) {
  return navigation.map((item) => <Link key={item.href} href={item.href}>
    <span>{item.shortLabel}</span>{item.notificationCount ? <b>{item.notificationCount}</b> : null}
  </Link>);
}

export function SoftUiStaffShell({ user, navigation, children }: {
  user: User;
  navigation: StaffNavigationItem[];
  children: React.ReactNode;
}) {
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  return <div className="soft-shell">
    <header className="soft-header">
      <Link href="/dashboard" className="soft-brand"><span><Image src="/itf-logo.png" alt="Industrial Training Fund logo" width={42} height={42} priority /></span><div><strong>ITF Flow</strong><small>Correspondence workspace</small></div></Link>
      <nav className="soft-nav" aria-label="Staff navigation"><SoftNavigation navigation={navigation} /></nav>
      <div className="soft-header-actions">
        <Link className="soft-icon-button" href="/notifications" aria-label="Notifications"><Bell size={19} />{navigation.find((item) => item.href === "/notifications")?.notificationCount ? <i /> : null}</Link>
        <div className="soft-profile"><span>{initials}</span><div><strong>{user.name}</strong><small>{label(user.role)}</small></div></div>
        <form action={logoutAction}><button className="soft-icon-button" title="Sign out"><LogOut size={18} /><span className="sr-only">Sign out</span></button></form>
      </div>
      <details className="soft-mobile-menu"><summary aria-label="Open navigation"><Menu size={21} /></summary><nav><SoftNavigation navigation={navigation} /></nav></details>
    </header>
    <main className="soft-content">
      <div className="soft-context-bar"><div><span>Industrial Training Fund</span><strong>{user.office}</strong></div><Link href="/correspondence/new"><PenLine size={16} /> Raise correspondence</Link></div>
      {children}
    </main>
  </div>;
}
