import { notFound } from "next/navigation";
import {
  acceptExternalSubmissionAction,
  acknowledgeAction,
  resolveAction,
  routeCorrespondenceAction,
} from "@/app/actions";
import { RecipientSelector } from "@/components/recipient-selector";
import { CorrespondenceStatus, UserRole, WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { canMinute, canRegister } from "@/lib/permissions";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const record = await db.correspondence.findUnique({
    where: { id },
    include: {
      externalOrganization: true,
      attachments: true,
      workItems: { include: { assignee: true }, orderBy: { assignedAt: "desc" } },
      events: { include: { actor: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!record) notFound();
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role);
  const participant = record.createdById === user.id || record.workItems.some((item) => item.assigneeId === user.id);
  if (!broadAccess && !participant) notFound();
  const activeStatuses: WorkItemStatus[] = [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED];
  const activeItem = record.workItems.find((item) => item.assigneeId === user.id && activeStatuses.includes(item.status));
  const activeActionItem = record.workItems.find(
    (item) =>
      item.assigneeId === user.id &&
      item.kind === "ACTION" &&
      activeStatuses.includes(item.status),
  );
  const canRoute = Boolean(activeActionItem && canMinute(user.role));
  return (
    <>
      <span className="eyebrow">{record.referenceNumber}</span>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
        <div><h1 style={{ maxWidth: 800 }}>{record.subject}</h1><p className="muted">From {record.senderName} · received {record.receivedAt.toLocaleString("en-NG")}</p></div>
        <div className="actions" style={{ marginTop: 0 }}><span className={`badge ${record.classification === "SECRET" ? "secret" : ""}`}>{label(record.classification)}</span><span className="badge">{label(record.status)}</span></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, .7fr)", marginTop: 22 }}>
        <div className="grid">
          <section className="card">
            <h2>Correspondence</h2>
            <p style={{ lineHeight: 1.7 }}>{record.summary}</p>
            {record.body ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, borderTop: "1px solid #ece9e0", paddingTop: 18 }}>{record.body}</div> : null}
            {record.attachments.length ? <div style={{ marginTop: 20 }}><strong>Attachments</strong>{record.attachments.map((file) => <p key={file.id}><a className="eyebrow" href={`/attachments/${file.id}`}>{file.originalName}</a> <small className="muted">({Math.ceil(file.sizeBytes / 1024)} KB)</small></p>)}</div> : null}
          </section>
          {record.status === CorrespondenceStatus.SUBMITTED && canRegister(user.role) ? (
            <section className="card"><h2>Secretariat intake</h2><p className="muted">Verify this external submission, register it, and place it in the DG’s inbox.</p><form action={acceptExternalSubmissionAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn" type="submit">Register and send to DG</button></form></section>
          ) : null}
          {activeItem?.status === WorkItemStatus.OPEN ? <section className="card"><form action={acknowledgeAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn secondary" type="submit">Acknowledge receipt</button></form></section> : null}
          {canRoute ? (
            <section className="card">
              <h2>Minute and route</h2>
              <p className="muted">Formal reporting line: your assigned supervisor or direct reports.</p>
              <form action={routeCorrespondenceAction} className="grid">
                <input type="hidden" name="correspondenceId" value={record.id} />
                <div className="field"><label>Minute / instruction</label><textarea name="minute" required minLength={3} placeholder="State the action required, expected outcome, and any deadline…" /></div>
                <div className="field">
                  <RecipientSelector
                    actionHint="Select your assigned supervisor or one or more direct reports."
                  />
                </div>
                <button className="btn" type="submit">Record minute and route</button>
              </form>
            </section>
          ) : null}
          {activeActionItem ? <section className="card"><h2>Resolve</h2><form action={resolveAction} className="grid"><input type="hidden" name="correspondenceId" value={record.id} /><div className="field"><label>Resolution note</label><textarea name="minute" placeholder="Describe the action taken, outcome, and any remaining follow-up…" required /></div><button className="btn secondary" type="submit">Mark resolved</button></form></section> : null}
        </div>
        <aside className="card">
          <h2>Movement & minutes</h2>
          <div className="timeline">
            {record.events.map((event) => <article className="event" key={event.id}>
              <strong>{label(event.type)}</strong>
              <p style={{ margin: "5px 0" }}>{event.minute}</p>
              <small className="muted">{event.actor?.name ?? record.externalOrganization?.contactName ?? "System"} · {event.createdAt.toLocaleString("en-NG")}</small>
            </article>)}
          </div>
          <h3>Current recipients</h3>
          {record.workItems.filter((item) => activeStatuses.includes(item.status)).map((item) => <p key={item.id}><span className="badge">{label(item.kind)}</span> {item.assignee.name}</p>)}
        </aside>
      </div>
    </>
  );
}
