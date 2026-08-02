import { notFound } from "next/navigation";
import Link from "next/link";
import { acknowledgeBroadcastAction, markBroadcastReadAction, publishDraftBroadcastAction, withdrawBroadcastAction } from "@/app/broadcast-actions";
import { BroadcastStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const broadcast = await db.broadcast.findUnique({
    where: { id },
    include: { createdBy: true, publishedBy: true, audiences: true, recipients: { include: { user: true }, orderBy: { recipientName: "asc" } }, events: { include: { actor: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!broadcast) notFound();
  const recipient = broadcast.recipients.find((item) => item.userId === user.id);
  const manages = broadcast.createdById === user.id || broadcast.publishedById === user.id || user.role === UserRole.DG || user.role === UserRole.SYSTEM_ADMIN;
  const now = new Date();
  const availableToRecipient = broadcast.status === BroadcastStatus.PUBLISHED && (!broadcast.publishAt || broadcast.publishAt <= now) && (!broadcast.expiresAt || broadcast.expiresAt > now);
  if ((!recipient || !availableToRecipient) && !manages) notFound();
  const readCount = broadcast.recipients.filter((item) => item.readAt).length;
  const acknowledgementCount = broadcast.recipients.filter((item) => item.acknowledgedAt).length;

  return <>
    <span className="eyebrow">{label(broadcast.category)}</span>
    <div className="section-heading"><div><h1>{broadcast.title}</h1><p className="muted">Published by {broadcast.publishedBy?.name ?? "Not published"} · {broadcast.publishedAt?.toLocaleString("en-NG") ?? "Draft"}</p></div><div className="actions"><span className={`badge ${broadcast.priority === "URGENT" ? "urgent" : ""}`}>{label(broadcast.priority)}</span><span className="badge">{label(broadcast.status)}</span></div></div>
    <section className="card broadcast-message"><p>{broadcast.message}</p><div className="broadcast-audiences"><strong>Audience</strong>{broadcast.audiences.map((audience) => <span className="badge" key={audience.id}>{audience.label}</span>)}</div></section>
    {broadcast.status === BroadcastStatus.DRAFT && broadcast.createdById === user.id ? <div className="actions"><Link className="btn secondary" href={`/broadcasts/${broadcast.id}/edit`}>Edit draft</Link></div> : null}
    {recipient && !recipient.readAt ? <form action={markBroadcastReadAction} className="card broadcast-action"><input type="hidden" name="broadcastId" value={broadcast.id} /><div><strong>Mark this announcement as read</strong><p className="muted">This records only that you opened and read the notice.</p></div><button className="btn secondary" type="submit">Mark as read</button></form> : null}
    {recipient && broadcast.mandatoryAcknowledgement && !recipient.acknowledgedAt ? <form action={acknowledgeBroadcastAction} className="card broadcast-action"><input type="hidden" name="broadcastId" value={broadcast.id} /><div><strong>Acknowledgement required</strong><p className="muted">Confirm that you have received and understood this announcement.</p></div><button className="btn" type="submit">Acknowledge</button></form> : null}
    {manages ? <>
      {broadcast.status === BroadcastStatus.DRAFT && broadcast.createdById === user.id ? <form action={publishDraftBroadcastAction} className="card broadcast-action"><input type="hidden" name="broadcastId" value={broadcast.id} /><div><strong>Draft ready for publication</strong><p className="muted">Recipients will be resolved and snapshotted when you publish.</p></div><button className="btn" type="submit">Publish draft</button></form> : null}
      <section className="grid stats" style={{ marginTop: 20 }}><div className="card stat"><span className="muted">Recipients</span><strong>{broadcast.recipients.length}</strong></div><div className="card stat"><span className="muted">Read</span><strong>{readCount}</strong></div><div className="card stat"><span className="muted">Acknowledged</span><strong>{acknowledgementCount}</strong></div><div className="card stat"><span className="muted">Unread</span><strong>{broadcast.recipients.length - readCount}</strong></div></section>
      {broadcast.status === BroadcastStatus.PUBLISHED ? <form action={withdrawBroadcastAction} className="card form-grid" style={{ marginTop: 20 }}><input type="hidden" name="broadcastId" value={broadcast.id} /><div className="field span-2"><label>Withdrawal reason</label><textarea name="reason" required minLength={5} placeholder="Explain why this published broadcast is being withdrawn…" /></div><button className="btn secondary span-2" type="submit">Withdraw broadcast</button></form> : null}
      <section className="card" style={{ marginTop: 20 }}><h2>Broadcast audit trail</h2><div className="timeline">{broadcast.events.map((event) => <article className="event" key={event.id}><strong>{label(event.type)}</strong><p>{event.detail}</p><small className="muted">{event.actor.name} · {event.createdAt.toLocaleString("en-NG")}</small></article>)}</div></section>
    </> : null}
  </>;
}
