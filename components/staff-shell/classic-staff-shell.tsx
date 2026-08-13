import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions";
import type { User } from "@/lib/generated/prisma/client";
import { label } from "@/lib/reference";
import type { StaffNavigationItem } from "@/lib/staff-navigation";

export function ClassicStaffShell({ user, navigation, children }: {
  user: User;
  navigation: StaffNavigationItem[];
  children: React.ReactNode;
}) {
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">
        <Image className="brand-mark" src="/itf-logo.png" alt="Industrial Training Fund logo" width={48} height={48} priority />
        <div><strong>ITF Flow</strong><br /><small style={{ opacity: .7 }}>Correspondence</small></div>
      </div>
      <nav className="nav" aria-label="Staff navigation">
        {navigation.map((item) => <Link key={item.href} href={item.href}>{item.label}{item.notificationCount ? ` (${item.notificationCount})` : ""}</Link>)}
      </nav>
      <div style={{ marginTop: "auto" }}>
        <small style={{ opacity: .7 }}>Signed in as</small>
        <p style={{ margin: "5px 0 2px", fontWeight: 700 }}>{user.name}</p>
        <small style={{ opacity: .7 }}>{label(user.role)}</small>
        <form action={logoutAction} style={{ marginTop: 16 }}><button className="btn secondary" type="submit" style={{ width: "100%" }}>Sign out</button></form>
      </div>
    </aside>
    <div className="main">
      <header className="topbar"><div><strong>Industrial Training Fund</strong><br /><small className="muted">{user.office}</small></div><span className="badge">{label(user.role)}</span></header>
      <main className="content">{children}</main>
    </div>
  </div>;
}
