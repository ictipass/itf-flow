import { markAllNotificationsReadAction, openNotificationAction } from "@/app/notification-actions";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({ where: { userId: user.id }, include: { actor: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notifications.filter((notification) => !notification.readAt).length;
  return <><span className="eyebrow">Event-driven alerts</span><div className="actions" style={{ justifyContent: "space-between", marginTop: 0 }}><div><h1>Notifications</h1><p className="muted">Created by workflow events. This page does not continuously poll the database.</p></div>{unread ? <form action={markAllNotificationsReadAction}><button className="btn secondary">Mark all read</button></form> : null}</div><div className="grid">
    {notifications.map((notification) => <article className="card" key={notification.id} style={{ opacity: notification.readAt ? .72 : 1 }}><div className="actions" style={{ justifyContent: "space-between", marginTop: 0 }}><span className="badge">{label(notification.type)}</span>{!notification.readAt ? <span className="badge">Unread</span> : null}</div><h2>{notification.title}</h2><p>{notification.message}</p><small className="muted">{notification.actor ? `From ${notification.actor.name} · ` : ""}{notification.createdAt.toLocaleString("en-NG")}</small><form action={openNotificationAction} style={{ marginTop: 14 }}><input type="hidden" name="notificationId" value={notification.id} /><button className="btn compact">Open</button></form></article>)}
    {!notifications.length ? <div className="card muted">No notifications yet.</div> : null}
  </div></>;
}
