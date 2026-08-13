import { processEmailOutboxAction, retryEmailOutboxAction } from "@/app/outbox-actions";
import { EmailOutboxStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function EmailOutboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) return <div className="notice">Only a system administrator can view the email outbox.</div>;
  const params = await searchParams;
  const [items, counts] = await Promise.all([
    db.emailOutbox.findMany({ include: { attempts: { orderBy: { attempt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.emailOutbox.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const eligible = items.filter((item) => item.status === EmailOutboxStatus.QUEUED || item.status === EmailOutboxStatus.FAILED);
  const oldestQueued = eligible.length ? eligible[eligible.length - 1] : null;
  return <>
    <span className="eyebrow">Durable delivery queue</span><h1>Email outbox</h1>
    <p className="muted">A protected scheduled worker processes bounded batches. Manual processing remains available for controlled operations; no browser or server loop continuously polls this table.</p>
    {params.considered ? <p className="notice">Considered {params.considered}; sent {params.sent ?? 0}; failed {params.failed ?? 0}.</p> : null}
    {params.error === "mail-configuration" ? <p className="notice error">Email processing could not start. Confirm MAIL_ENABLED and the configured SMTP credentials.</p> : null}
    {params.error === "retry-reason" ? <p className="notice error">Provide an administrative retry reason of at least 10 characters.</p> : null}
    {params.retried ? <p className="notice success">The selected message was returned to the delivery queue.</p> : null}
    <section className="grid stats" style={{ margin: "20px 0" }}>{Object.values(EmailOutboxStatus).map((status) => <div className="card stat" key={status}><span className="muted">{label(status)}</span><strong>{counts.find((item) => item.status === status)?._count._all ?? 0}</strong></div>)}</section>
    <div className="actions"><span className="badge">Oldest eligible: {oldestQueued ? oldestQueued.createdAt.toLocaleString("en-NG") : "None"}</span><form action={processEmailOutboxAction}><button className="btn">Process next 20</button></form></div>
    <div className="card"><table className="table"><thead><tr><th>Recipient</th><th>Source</th><th>Status</th><th>Attempts</th><th>Next attempt</th><th>Recovery</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id}><td>{item.toAddress}<br /><small className="muted">{item.subject}</small></td><td>{label(item.sourceType)}</td><td><span className="badge">{label(item.status)}</span>{item.lastErrorCode ? <small className="muted"> · {item.lastErrorCode}</small> : null}</td><td>{item.attemptCount}</td><td>{item.sentAt?.toLocaleString("en-NG") ?? item.nextAttemptAt.toLocaleString("en-NG")}</td><td>{item.status === EmailOutboxStatus.FAILED || item.status === EmailOutboxStatus.DEAD_LETTER ? <form action={retryEmailOutboxAction} className="grid"><input type="hidden" name="outboxId" value={item.id} /><input name="reason" minLength={10} maxLength={500} required placeholder="Administrative retry reason" /><button className="btn secondary compact">Retry</button></form> : "—"}</td></tr>)}
      {!items.length ? <tr><td colSpan={6} className="muted">The email queue is empty.</td></tr> : null}
    </tbody></table></div>
  </>;
}
