import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut, Menu, PenLine, Search, Sparkles } from "lucide-react";
import { logoutAction } from "@/app/actions";
import type { User } from "@/lib/generated/prisma/client";
import { label } from "@/lib/reference";
import type { StaffNavigationItem } from "@/lib/staff-navigation";

function GlassNavigation({ navigation }: { navigation: StaffNavigationItem[] }) {
  return navigation.map((item) => <Link href={item.href} key={item.href}><span>{item.shortLabel}</span>{item.notificationCount ? <b>{item.notificationCount}</b> : null}</Link>);
}

export function GlassStaffShell({ user, navigation, children }: { user: User; navigation: StaffNavigationItem[]; children: React.ReactNode }) {
  const initials = user.name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  return <div className="glass-shell">
    <div className="glass-orb glass-orb-one" /><div className="glass-orb glass-orb-two" />
    <header className="glass-header">
      <Link href="/dashboard" className="glass-brand"><span><Image src="/itf-logo.png" alt="Industrial Training Fund logo" width={40} height={40} priority /></span><div><strong>ITF Flow</strong><small>Digital correspondence</small></div></Link>
      <nav className="glass-nav" aria-label="Staff navigation"><GlassNavigation navigation={navigation} /></nav>
      <div className="glass-header-actions">
        <Link href="/correspondence" className="glass-search" aria-label="Search correspondence"><Search size={18} /><span>Search</span></Link>
        <Link href="/notifications" className="glass-circle" aria-label="Notifications"><Bell size={18} />{navigation.find((item) => item.href === "/notifications")?.notificationCount ? <i /> : null}</Link>
        <div className="glass-profile"><span>{initials}</span><div><strong>{user.name}</strong><small>{label(user.role)}</small></div></div>
        <form action={logoutAction}><button className="glass-circle" title="Sign out"><LogOut size={18} /><span className="sr-only">Sign out</span></button></form>
      </div>
      <details className="glass-mobile-menu"><summary><Menu size={21} /><span className="sr-only">Open navigation</span></summary><nav><GlassNavigation navigation={navigation} /></nav></details>
    </header>
    <main className="glass-content">
      <div className="glass-context"><span><Sparkles size={14} /> {user.office}</span><Link href="/correspondence/new"><PenLine size={16} /> Raise correspondence</Link></div>
      {children}
    </main>
  </div>;
}
