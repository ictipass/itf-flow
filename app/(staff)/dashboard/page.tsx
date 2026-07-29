import Link from "next/link";
import { WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const [open, acknowledged, overdue, resolved, recent] = await Promise.all([
    db.workItem.count({ where: { assigneeId: user.id, status: WorkItemStatus.OPEN } }),
    db.workItem.count({ where: { assigneeId: user.id, status: WorkItemStatus.ACKNOWLEDGED } }),
    db.workItem.count({ where: { assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] }, dueAt: { lt: now } } }),
    db.workItem.count({ where: { assigneeId: user.id, status: WorkItemStatus.COMPLETED } }),
    db.workItem.findMany({
      where: { assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
      include: { correspondence: true },
      orderBy: { assignedAt: "desc" },
      take: 6,
    }),
  ]);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 20, marginBottom: 24 }}>
        <div><span className="eyebrow">Command centre</span><h1 style={{ marginBottom: 5 }}>Good day, {user.name.split(" ")[0]}</h1><p className="muted">Correspondence requiring your attention.</p></div>
        <Link className="btn" href="/correspondence/new">Raise correspondence</Link>
      </div>
      <section className="grid stats">
        <div className="card stat"><span className="muted">New inbox</span><strong>{open}</strong></div>
        <div className="card stat"><span className="muted">In progress</span><strong>{acknowledged}</strong></div>
        <div className="card stat"><span className="muted">Overdue</span><strong>{overdue}</strong></div>
        <div className="card stat"><span className="muted">Completed</span><strong>{resolved}</strong></div>
      </section>
      <section className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><h2>Priority inbox</h2><Link href="/inbox" className="eyebrow">View all</Link></div>
        <table className="table">
          <thead><tr><th>Reference</th><th>Subject</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map(({ correspondence }) => (
              <tr key={correspondence.id}>
                <td><Link href={`/correspondence/${correspondence.id}`}><strong>{correspondence.referenceNumber}</strong></Link></td>
                <td>{correspondence.subject}</td>
                <td><span className={`badge ${correspondence.priority !== "ROUTINE" ? "urgent" : ""}`}>{label(correspondence.priority)}</span></td>
                <td>{label(correspondence.status)}</td>
              </tr>
            ))}
            {!recent.length ? <tr><td colSpan={4} className="muted">Your inbox is clear.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
