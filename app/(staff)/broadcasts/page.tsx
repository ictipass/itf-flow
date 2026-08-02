import Link from "next/link";
import { BroadcastStatus } from "@/lib/generated/prisma/client";
import { canCreateBroadcast } from "@/lib/broadcasts";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function BroadcastsPage() {
  const user = await requireUser();
  const now = new Date();
  const [deliveries, authored, canCreate] = await Promise.all([
    db.broadcastRecipient.findMany({ where: { userId: user.id, broadcast: { status: BroadcastStatus.PUBLISHED, AND: [{ OR: [{ publishAt: null }, { publishAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] } }, include: { broadcast: { include: { publishedBy: true } } }, orderBy: { deliveredAt: "desc" } }),
    db.broadcast.findMany({ where: { createdById: user.id }, include: { _count: { select: { recipients: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
    canCreateBroadcast(user.id),
  ]);
  return <><div className="section-heading"><div><span className="eyebrow">Organization notices</span><h1>Announcements</h1><p className="muted">Official broadcasts delivered to you through ITF Flow.</p></div>{canCreate ? <Link className="btn" href="/broadcasts/new">Create broadcast</Link> : null}</div>
    <div className="broadcast-list">{deliveries.map((delivery) => <Link className={`broadcast-item ${delivery.readAt ? "" : "unread"}`} href={`/broadcasts/${delivery.broadcastId}`} key={delivery.id}><div><span className={`badge ${delivery.broadcast.priority === "URGENT" ? "urgent" : ""}`}>{label(delivery.broadcast.priority)}</span><h2>{delivery.broadcast.title}</h2><p>{delivery.broadcast.message.slice(0, 180)}{delivery.broadcast.message.length > 180 ? "…" : ""}</p><small>{label(delivery.broadcast.category)} · Published by {delivery.broadcast.publishedBy?.name ?? "ITF"}</small></div><div className="broadcast-state">{delivery.acknowledgedAt ? "Acknowledged" : delivery.readAt ? "Read" : "Unread"}</div></Link>)}{!deliveries.length ? <div className="card muted">No active broadcasts have been delivered to you.</div> : null}</div>
    {authored.length ? <section className="card" style={{ marginTop: 24 }}><h2>Created by me</h2><table className="table"><thead><tr><th>Title</th><th>Status</th><th>Recipients</th><th>Created</th></tr></thead><tbody>{authored.map((broadcast) => <tr key={broadcast.id}><td><Link href={`/broadcasts/${broadcast.id}`}><strong>{broadcast.title}</strong></Link></td><td>{label(broadcast.status)}</td><td>{broadcast._count.recipients}</td><td>{broadcast.createdAt.toLocaleString("en-NG")}</td></tr>)}</tbody></table></section> : null}
  </>;
}
