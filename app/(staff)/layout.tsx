import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";
import { UserRole } from "@/lib/generated/prisma/client";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IF</div>
          <div><strong>ITF Flow</strong><br /><small style={{ opacity: .7 }}>Correspondence</small></div>
        </div>
        <nav className="nav">
          <Link href="/dashboard">Overview</Link>
          <Link href="/inbox">My inbox</Link>
          <Link href="/correspondence">All correspondence</Link>
          <Link href="/correspondence/new">Raise correspondence</Link>
          <Link href="/guide">How it works</Link>
          {user.role === UserRole.SYSTEM_ADMIN ? (
            <Link href="/admin/provisioning">Provisioning admin</Link>
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
