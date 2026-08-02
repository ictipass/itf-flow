import { processEmailOutboxAction } from "@/app/outbox-actions";
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
  return <><span className="eyebrow">Durable delivery queue</span><h1>Email outbox</h1><p className="muted">Processing is manual for the local demo and designed for a scheduled worker later. No browser or server loop continuously polls this table.</p>
    {params.considered ? <p className="notice">Considered {params.considered}; sent {params.sent ?? 0}; failed {params.failed ?? 0}.</p> : null}
    {params.error ? <p className="notice">Email processing could not start. Confirm MAIL_ENABLED and the configured SMTP credentials, then use the existing connection test.</p> : null}
    <div className="actions">{Object.values(EmailOutboxStatus).map((status) => <span className="badge" key={status}>{label(status)}: {counts.find((item) => item.status === status)?._count._all ?? 0}</span>)}<form action={processEmailOutboxAction}><button className="btn">Process next 20</button></form></div>
    <div className="card"><table className="table"><thead><tr><th>Recipient</th><th>Subject</th><th>Status</th><th>Attempts</th><th>Next attempt</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.toAddress}</td><td>{item.subject}</td><td><span className="badge">{label(item.status)}</span>{item.lastErrorCode ? <small className="muted"> · {item.lastErrorCode}</small> : null}</td><td>{item.attemptCount}</td><td>{item.sentAt?.toLocaleString("en-NG") ?? item.nextAttemptAt.toLocaleString("en-NG")}</td></tr>)}</tbody></table></div>
  </>;
}
