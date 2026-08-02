import Link from "next/link";
import Image from "next/image";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";
import { UserRole } from "@/lib/generated/prisma/client";
import { canDispatch } from "@/lib/permissions";
import { db } from "@/lib/db";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unreadNotifications = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Image className="brand-mark" src="/itf-logo.png" alt="Industrial Training Fund logo" width={48} height={48} priority />
          <div><strong>ITF Flow</strong><br /><small style={{ opacity: .7 }}>Correspondence</small></div>
        </div>
        <nav className="nav">
          <Link href="/dashboard">Overview</Link>
          {user.role === UserRole.DG_SECRETARY || user.role === UserRole.RECORDS_ADMIN || user.role === UserRole.SYSTEM_ADMIN ? (
            <Link href="/intake">Shared Secretariat intake</Link>
          ) : null}
          <Link href="/inbox">My inbox</Link>
          <Link href="/notifications">Notifications{unreadNotifications ? ` (${unreadNotifications})` : ""}</Link>
          <Link href="/drafts">My drafts</Link>
          <Link href="/correspondence">All correspondence</Link>
          {canDispatch(user.role) ? <Link href="/dispatch">Dispatch registry</Link> : null}
          <Link href="/correspondence/new">Raise correspondence</Link>
          <Link href="/broadcasts">Announcements</Link>
          <Link href="/guide">How it works</Link>
          {user.role === UserRole.SYSTEM_ADMIN ? (
            <><Link href="/admin/provisioning">Provisioning admin</Link><Link href="/admin/email-outbox">Email outbox</Link></>
          ) : null}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <small style={{ opacity: .7 }}>Signed in as</small>
          <p style={{ margin: "5px 0 2px", fontWeight: 700 }}>{user.name}</p>
          <small style={{ opacity: .7 }}>{label(user.role)}</small>
          <form action={logoutAction} style={{ marginTop: 16 }}>
            <button className="btn secondary" type="submit" style={{ width: "100%" }}>Sign out</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div><strong>Industrial Training Fund</strong><br /><small className="muted">{user.office}</small></div>
          <span className="badge">{label(user.role)}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
