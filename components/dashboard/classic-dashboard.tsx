import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard";
import { label } from "@/lib/reference";

export function ClassicDashboard({ firstName, data }: { firstName: string; data: DashboardData; showDispatch?: boolean }) {
  return <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, marginBottom: 24 }}>
      <div><span className="eyebrow">Command centre</span><h1 style={{ marginBottom: 5 }}>Good day, {firstName}</h1><p className="muted">Correspondence requiring your attention.</p></div>
      <Link className="btn" href="/correspondence/new">Raise correspondence</Link>
    </div>
    <section className="grid stats">
      <div className="card stat"><span className="muted">New inbox</span><strong>{data.open}</strong></div>
      <div className="card stat"><span className="muted">In progress</span><strong>{data.acknowledged}</strong></div>
      <div className="card stat"><span className="muted">Overdue</span><strong>{data.overdue}</strong></div>
      <div className="card stat"><span className="muted">Completed</span><strong>{data.resolved}</strong></div>
    </section>
    {(data.unreadBroadcasts > 0 || data.pendingAcknowledgements > 0) ? <Link href="/broadcasts" className="broadcast-dashboard-alert"><div><span className="eyebrow">Official announcements</span><strong>{data.unreadBroadcasts} unread · {data.pendingAcknowledgements} requiring acknowledgement</strong></div><span>Open announcements →</span></Link> : null}
    <section className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><h2>Priority inbox</h2><Link href="/inbox" className="eyebrow">View all</Link></div>
      <table className="table"><thead><tr><th>Reference</th><th>Subject</th><th>Priority</th><th>Status</th></tr></thead><tbody>
        {data.recent.map(({ correspondence }) => <tr key={correspondence.id}><td><Link href={`/correspondence/${correspondence.id}`}><strong>{correspondence.referenceNumber}</strong></Link></td><td>{correspondence.subject}</td><td><span className={`badge ${correspondence.priority !== "ROUTINE" ? "urgent" : ""}`}>{label(correspondence.priority)}</span></td><td>{label(correspondence.status)}</td></tr>)}
        {!data.recent.length ? <tr><td colSpan={4} className="muted">Your inbox is clear.</td></tr> : null}
      </tbody></table>
    </section>
  </>;
}
