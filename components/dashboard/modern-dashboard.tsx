import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, Clock3, FilePenLine, Inbox, Megaphone, Send, TriangleAlert } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { label } from "@/lib/reference";

export function ModernDashboard({ firstName, data, showDispatch = false }: { firstName: string; data: DashboardData; showDispatch?: boolean }) {
  const attentionTotal = data.open + data.acknowledged;
  return <div className="modern-dashboard">
    <section className="modern-welcome">
      <div><span className="modern-kicker">Your command workspace</span><h1>Good day, {firstName}.</h1><p>Here is what needs your attention across the correspondence flow.</p></div>
      <div className="modern-date"><span>{new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date())}</span><strong>{new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</strong></div>
    </section>

    <section className="modern-metrics" aria-label="Work summary">
      <Link href="/inbox" className="modern-metric primary"><span><Inbox size={20} /> Needs attention</span><strong>{attentionTotal}</strong><small>{data.open} new · {data.acknowledged} in progress</small></Link>
      <Link href="/inbox" className="modern-metric danger"><span><TriangleAlert size={20} /> Overdue</span><strong>{data.overdue}</strong><small>Past their expected date</small></Link>
      <Link href="/correspondence" className="modern-metric"><span><CheckCircle2 size={20} /> Completed</span><strong>{data.resolved}</strong><small>Actions successfully treated</small></Link>
      <Link href="/broadcasts" className="modern-metric"><span><Megaphone size={20} /> Announcements</span><strong>{data.unreadBroadcasts}</strong><small>{data.pendingAcknowledgements} need acknowledgement</small></Link>
    </section>

    <div className="modern-dashboard-grid">
      <section className="modern-panel modern-priority-panel">
        <div className="modern-panel-heading"><div><span className="modern-kicker">Work queue</span><h2>Priority correspondence</h2></div><Link href="/inbox">View inbox <ArrowRight size={16} /></Link></div>
        <div className="modern-work-list">
          {data.recent.map((item) => <Link className="modern-work-item" key={item.id} href={`/correspondence/${item.correspondence.id}`}>
            <span className={`modern-priority-dot ${item.correspondence.priority.toLowerCase()}`} />
            <div><strong>{item.correspondence.subject}</strong><small>{item.correspondence.referenceNumber} · {label(item.correspondence.status)}</small></div>
            <div className="modern-work-meta"><span className={`badge ${item.correspondence.priority !== "ROUTINE" ? "urgent" : ""}`}>{label(item.correspondence.priority)}</span><small><Clock3 size={13} /> {item.dueAt ? item.dueAt.toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "No due date"}</small></div>
          </Link>)}
          {!data.recent.length ? <div className="modern-empty"><CheckCircle2 size={30} /><strong>Your inbox is clear</strong><span>New assignments will appear here.</span></div> : null}
        </div>
      </section>

      <aside className="modern-panel modern-quick-panel">
        <div className="modern-panel-heading"><div><span className="modern-kicker">Shortcuts</span><h2>Quick actions</h2></div></div>
        <div className="modern-quick-actions">
          <Link href="/correspondence/new"><FilePenLine size={20} /><span><strong>Raise correspondence</strong><small>Start a memo or official letter</small></span><ArrowRight size={16} /></Link>
          <Link href="/drafts"><Clock3 size={20} /><span><strong>Continue a draft</strong><small>Return to saved work</small></span><ArrowRight size={16} /></Link>
          {showDispatch ? <Link href="/dispatch"><Send size={20} /><span><strong>Dispatch registry</strong><small>Track outgoing delivery</small></span><ArrowRight size={16} /></Link> : null}
        </div>
      </aside>

      <section className="modern-panel modern-activity-panel">
        <div className="modern-panel-heading"><div><span className="modern-kicker">Latest updates</span><h2>Recent activity</h2></div><Link href="/notifications">All notifications <ArrowRight size={16} /></Link></div>
        <div className="modern-activity-list">
          {data.recentNotifications.map((notification) => <Link href={notification.href} key={notification.id}><span className={notification.readAt ? "" : "unread"}><BellRing size={16} /></span><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{notification.createdAt.toLocaleString("en-NG")}</small></div></Link>)}
          {!data.recentNotifications.length ? <div className="modern-empty compact"><BellRing size={24} /><span>No recent notifications.</span></div> : null}
        </div>
      </section>
    </div>
  </div>;
}
