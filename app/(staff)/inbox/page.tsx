import Link from "next/link";
import { WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

export default async function InboxPage() {
  const user = await requireUser();
  const items = await db.workItem.findMany({
    where: { assigneeId: user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } },
    include: { correspondence: true },
    orderBy: [{ correspondence: { priority: "asc" } }, { assignedAt: "desc" }],
  });
  return (
    <>
      <span className="eyebrow">Action queue</span><h1>My inbox</h1>
      <div className="card">
        <table className="table">
          <thead><tr><th>Reference</th><th>Subject</th><th>From</th><th>Kind</th><th>Received</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.id}>
              <td><Link href={`/correspondence/${item.correspondenceId}`}><strong>{item.correspondence.referenceNumber}</strong></Link></td>
              <td>{item.correspondence.subject}</td><td>{item.correspondence.senderName}</td>
              <td><span className="badge">{label(item.kind)}</span></td>
              <td>{item.assignedAt.toLocaleDateString("en-NG")}</td>
            </tr>)}
            {!items.length ? <tr><td colSpan={5} className="muted">No open work items.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
