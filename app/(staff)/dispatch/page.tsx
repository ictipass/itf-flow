import Link from "next/link";
import { CorrespondenceStatus, CorrespondenceType, DecisionOutcome, WorkPurpose } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canDispatch } from "@/lib/permissions";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function DispatchPage() {
  const user = await requireUser();
  if (!canDispatch(user.role)) return <div className="notice">You are not authorized to access the dispatch registry.</div>;
  const records = await db.correspondence.findMany({
    where: { type: CorrespondenceType.OUTGOING_LETTER, status: { not: CorrespondenceStatus.DRAFT } },
    include: {
      dispatchRecords: { orderBy: { createdAt: "desc" } },
      decisionRequests: { where: { purpose: WorkPurpose.APPROVAL, outcome: DecisionOutcome.APPROVED, supersededAt: null }, take: 1 },
    },
    orderBy: { updatedAt: "desc" }, take: 100,
  });
  return <><span className="eyebrow">Outgoing registry</span><h1>Dispatch queue</h1><p className="muted">Prepare delivery records and track dispatch through confirmation or failure.</p><div className="card"><table className="table"><thead><tr><th>Reference</th><th>Subject</th><th>Approval</th><th>Latest dispatch</th><th></th></tr></thead><tbody>
    {records.map((record) => { const latest = record.dispatchRecords[0]; const approved = !record.requiresApproval || record.decisionRequests.length > 0; return <tr key={record.id}><td><strong>{record.referenceNumber}</strong></td><td>{record.subject}</td><td><span className="badge">{approved ? "Ready" : "Approval pending"}</span></td><td>{latest ? `${latest.outgoingReference} · ${label(latest.status)}` : "Not prepared"}</td><td><Link className="btn compact" href={`/correspondence/${record.id}`}>{latest ? "Open" : approved ? "Prepare" : "Review"}</Link></td></tr>; })}
    {!records.length ? <tr><td colSpan={5} className="muted">No outgoing correspondence is available.</td></tr> : null}
  </tbody></table></div></>;
}
