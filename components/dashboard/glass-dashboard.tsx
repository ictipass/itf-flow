import Link from "next/link";
import { ArrowRight, ArrowUpRight, BellRing, CheckCircle2, Clock3, FilePenLine, Inbox, Megaphone, Send, TriangleAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { label } from "@/lib/reference";

export function GlassDashboard({ firstName, data, showDispatch = false }: { firstName: string; data: DashboardData; showDispatch?: boolean }) {
  return <div className="glass-dashboard">
    <section className="glass-hero">
      <div><span className="glass-kicker">Command intelligence</span><h1>Good day, <em>{firstName}</em></h1><p>A clear view of everything moving through your correspondence workspace.</p></div>
      <div className="glass-hero-count"><small>Items needing attention</small><strong>{data.open + data.acknowledged}</strong><Link href="/inbox">Open workspace <ArrowRight size={15} /></Link></div>
    </section>

    <section className="glass-metrics">
      <Link href="/inbox"><span><Inbox size={19} /></span><div><small>New inbox</small><strong>{data.open}</strong></div><ArrowUpRight size={16} /></Link>
      <Link href="/inbox"><span><Clock3 size={19} /></span><div><small>In progress</small><strong>{data.acknowledged}</strong></div><ArrowUpRight size={16} /></Link>
      <Link href="/inbox" className="alert"><span><TriangleAlert size={19} /></span><div><small>Overdue</small><strong>{data.overdue}</strong></div><ArrowUpRight size={16} /></Link>
      <Link href="/correspondence"><span><CheckCircle2 size={19} /></span><div><small>Completed</small><strong>{data.resolved}</strong></div><ArrowUpRight size={16} /></Link>
    </section>

    <div className="glass-dashboard-grid">
      <section className="glass-panel glass-work-panel">
        <div className="glass-panel-heading"><div><span className="glass-kicker">Live queue</span><h2>Priority correspondence</h2></div><Link href="/inbox">View all <ArrowUpRight size={15} /></Link></div>
        <div className="glass-work-list">{data.recent.map((item) => <Link href={`/correspondence/${item.correspondence.id}`} key={item.id}><span className={`glass-priority ${item.correspondence.priority.toLowerCase()}`} /><div><strong>{item.correspondence.subject}</strong><small>{item.correspondence.referenceNumber} · {label(item.correspondence.status)}</small></div><span><b>{label(item.correspondence.priority)}</b><small>{item.dueAt ? item.dueAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "Open"}</small></span></Link>)}{!data.recent.length ? <div className="glass-empty"><CheckCircle2 size={28} /><strong>Your queue is clear.</strong></div> : null}</div>
      </section>

      <aside className="glass-side-stack">
        <Link href="/broadcasts" className="glass-panel glass-announcement"><span><Megaphone size={20} /></span><div><small>Official announcements</small><strong>{data.unreadBroadcasts} unread</strong><em>{data.pendingAcknowledgements} require acknowledgement</em></div><ArrowUpRight size={17} /></Link>
        <section className="glass-panel"><div className="glass-panel-heading"><div><span className="glass-kicker">Launchpad</span><h2>Quick actions</h2></div></div><div className="glass-actions"><Link href="/correspondence/new"><FilePenLine size={18} /><span>Raise correspondence</span><ArrowRight size={15} /></Link><Link href="/drafts"><Clock3 size={18} /><span>Continue a draft</span><ArrowRight size={15} /></Link>{showDispatch ? <Link href="/dispatch"><Send size={18} /><span>Dispatch registry</span><ArrowRight size={15} /></Link> : null}</div></section>
      </aside>

      <section className="glass-panel glass-activity"><div className="glass-panel-heading"><div><span className="glass-kicker">Signal stream</span><h2>Recent activity</h2></div><Link href="/notifications">All notifications <ArrowUpRight size={15} /></Link></div><div className="glass-activity-list">{data.recentNotifications.map((notification) => <Link href={notification.href} key={notification.id}><span className={notification.readAt ? "" : "unread"}><BellRing size={16} /></span><div><strong>{notification.title}</strong><small>{notification.message}</small></div><time>{notification.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</time></Link>)}{!data.recentNotifications.length ? <div className="glass-empty"><BellRing size={24} /> No recent activity.</div> : null}</div></section>
    </div>
  </div>;
}
