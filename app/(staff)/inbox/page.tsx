import Link from "next/link";
import { WorkItemStatus } from "@/lib/generated/prisma/client";
import { activeDelegationsFor } from "@/lib/delegations";
import { db } from "@/lib/db";
import { sensitiveRecordScope } from "@/lib/sensitive-access";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const view = (await searchParams).view === "office" ? "office" : "personal";
  const delegations = await activeDelegationsFor(user.id);
  const principalIds = delegations.map((item) => item.principalId);
  const sensitiveScope = await sensitiveRecordScope(user);
  const items = await db.workItem.findMany({
    where: { assigneeId: view === "office" ? { in: principalIds } : user.id, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] }, correspondence: sensitiveScope },
    include: { correspondence: true, assignee: true }, orderBy: [{ correspondence: { priority: "asc" } }, { assignedAt: "desc" }], take: 300,
  });
  const appointmentByPrincipal = new Map(delegations.map((item) => [item.principalId, item]));
  return <><span className="eyebrow">Action queues</span><h1>{view === "office" ? "Acting office inbox" : "My personal inbox"}</h1>
    <div className="actions"><Link className={`btn ${view === "personal" ? "" : "secondary"}`} href="/inbox">Personal inbox</Link><Link className={`btn ${view === "office" ? "" : "secondary"}`} href="/inbox?view=office">Acting office inbox ({delegations.length})</Link></div>
    {view === "office" && delegations.length ? <div className="notice">You are viewing work owned by {delegations.map((item) => `${item.officeLabel} (${item.principal.name}, until ${item.endsAt.toLocaleDateString("en-NG")}${item.canApprove ? ", approval enabled" : ""})`).join("; ")}.</div> : null}
    <div className="card"><table className="table"><thead><tr><th>Reference</th><th>Subject</th><th>Owned by</th><th>Responsibility</th><th>Received</th></tr></thead><tbody>{items.map((item) => { const appointment = appointmentByPrincipal.get(item.assigneeId); return <tr key={item.id}><td><Link href={`/correspondence/${item.correspondenceId}`}><strong>{item.correspondence.referenceNumber}</strong></Link></td><td>{item.correspondence.subject}</td><td>{view === "office" ? <>{appointment?.officeLabel}<small className="registry-secondary">{item.assignee.name}</small></> : "Personal"}</td><td><span className="badge">{label(item.kind)}</span> <span className="badge">{label(item.purpose)}</span></td><td>{item.assignedAt.toLocaleDateString("en-NG")}</td></tr>; })}{!items.length ? <tr><td colSpan={5} className="muted">No open work items in this inbox.</td></tr> : null}</tbody></table></div>
  </>;
}
