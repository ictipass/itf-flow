import Link from "next/link";
import { ArrowUpRight, BellRing, CheckCircle2, Clock3, FilePenLine, Inbox, Megaphone, Send, TriangleAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { label } from "@/lib/reference";

export function SoftUiDashboard({ firstName, data, showDispatch = false }: { firstName: string; data: DashboardData; showDispatch?: boolean }) {
  return <div className="soft-dashboard">
    <section className="soft-welcome"><div><span className="soft-eyebrow">Personal workspace</span><h1>Welcome back, {firstName}</h1><p>Stay on top of correspondence, decisions, and official updates.</p></div><span className="soft-date"><small>Today</small><strong>{new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "long" }).format(new Date())}</strong></span></section>

    <section className="soft-stats">
      <Link href="/inbox"><span className="soft-stat-icon burgundy"><Inbox size={22} /></span><div><small>New inbox</small><strong>{data.open}</strong><em>Awaiting acknowledgement</em></div></Link>
      <Link href="/inbox"><span className="soft-stat-icon amber"><Clock3 size={22} /></span><div><small>In progress</small><strong>{data.acknowledged}</strong><em>Currently being treated</em></div></Link>
      <Link href="/inbox"><span className="soft-stat-icon red"><TriangleAlert size={22} /></span><div><small>Overdue</small><strong>{data.overdue}</strong><em>Needs immediate attention</em></div></Link>
      <Link href="/correspondence"><span className="soft-stat-icon green"><CheckCircle2 size={22} /></span><div><small>Completed</small><strong>{data.resolved}</strong><em>Successfully treated</em></div></Link>
    </section>

    <div className="soft-dashboard-grid">
      <section className="soft-card soft-inbox-card">
        <div className="soft-card-heading"><div><span className="soft-eyebrow">Action queue</span><h2>Correspondence for you</h2></div><Link href="/inbox">View all <ArrowUpRight size={15} /></Link></div>
        <div className="soft-correspondence-list">
          {data.recent.map((item) => <Link href={`/correspondence/${item.correspondence.id}`} key={item.id}><span className={`soft-priority ${item.correspondence.priority.toLowerCase()}`} /><div><strong>{item.correspondence.subject}</strong><small>{item.correspondence.referenceNumber}</small></div><span className="soft-item-state"><b>{label(item.correspondence.priority)}</b><small>{label(item.correspondence.status)}</small></span></Link>)}
          {!data.recent.length ? <div className="soft-empty"><CheckCircle2 size={28} /><strong>Your action queue is clear.</strong></div> : null}
        </div>
      </section>

      <aside className="soft-side-stack">
        <section className="soft-card soft-announcement-card"><span className="soft-stat-icon burgundy"><Megaphone size={21} /></span><div><span className="soft-eyebrow">Announcements</span><strong>{data.unreadBroadcasts} unread update{data.unreadBroadcasts === 1 ? "" : "s"}</strong><small>{data.pendingAcknowledgements} requiring acknowledgement</small></div><Link href="/broadcasts"><ArrowUpRight size={17} /></Link></section>
        <section className="soft-card"><div className="soft-card-heading"><div><span className="soft-eyebrow">Start here</span><h2>Quick actions</h2></div></div><div className="soft-actions"><Link href="/correspondence/new"><FilePenLine size={18} /> New correspondence</Link><Link href="/drafts"><Clock3 size={18} /> Continue a draft</Link>{showDispatch ? <Link href="/dispatch"><Send size={18} /> Dispatch registry</Link> : null}</div></section>
      </aside>

      <section className="soft-card soft-notification-card"><div className="soft-card-heading"><div><span className="soft-eyebrow">Activity</span><h2>Latest notifications</h2></div><Link href="/notifications">View all <ArrowUpRight size={15} /></Link></div><div className="soft-notifications">{data.recentNotifications.map((notification) => <Link href={notification.href} key={notification.id}><span className={notification.readAt ? "" : "unread"}><BellRing size={16} /></span><div><strong>{notification.title}</strong><small>{notification.message}</small></div><time>{notification.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</time></Link>)}{!data.recentNotifications.length ? <div className="soft-empty"><BellRing size={24} /> No recent notifications.</div> : null}</div></section>
    </div>
  </div>;
}
