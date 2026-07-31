import Link from "next/link";
import { claimIntakeAction, syncMailboxAction, testMailConnectionAction } from "@/app/actions";
import { CorrespondenceStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { isMailEnabled } from "@/lib/mail-config";
import { canRegister } from "@/lib/permissions";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string; imported?: string; skipped?: string; reason?: string }>;
}) {
  const user = await requireUser();
  if (!canRegister(user.role)) return <p className="notice">You do not have Secretariat intake access.</p>;
  const notice = await searchParams;
  const [records, lastSync] = await Promise.all([
    db.correspondence.findMany({
      where: { status: CorrespondenceStatus.SUBMITTED },
      include: { claimedBy: true, emailMessage: true },
      orderBy: [{ claimedAt: "asc" }, { receivedAt: "asc" }],
      take: 100,
    }),
    db.mailboxSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">DG Secretariat</span>
          <h1>Shared intake</h1>
          <p className="muted">Claiming an item makes its handler visible to every secretary and prevents conflicting registration.</p>
        </div>
        <div className="actions">
          {isMailEnabled() ? <form action={syncMailboxAction}><button className="btn" type="submit">Sync mailbox</button></form> : null}
          {user.role === UserRole.SYSTEM_ADMIN ? <form action={testMailConnectionAction}><button className="btn secondary" type="submit">Test mail connection</button></form> : null}
        </div>
      </div>

      {notice.mail === "success" ? (
        <p className="notice success">Mailbox sync completed: {notice.imported ?? "0"} imported, {notice.skipped ?? "0"} skipped.</p>
      ) : null}
      {notice.mail === "connected" ? <p className="notice success">IMAP and SMTP connections were verified.</p> : null}
      {notice.mail === "failed" ? <p className="notice error">Mailbox sync failed safely. {notice.reason === "authentication" ? "The mail server rejected the configured username or password." : "Ask the system administrator to test the connection and review the latest sync status."}</p> : null}
      {notice.mail === "connection-failed" ? <p className="notice error">The mail server connection could not be verified. {notice.reason === "authentication" ? "The server rejected the configured username or password." : notice.reason === "timeout" ? "The connection timed out." : notice.reason === "tls" ? "TLS certificate negotiation failed." : notice.reason === "folder" ? "The configured mailbox folder is unavailable." : "Check the credentials, TLS settings, mailbox folder, and server logs."}</p> : null}
      {!isMailEnabled() ? <p className="notice">Mailbox sync is disabled. Configure the MAIL_* environment variables and set MAIL_ENABLED=true.</p> : null}
      {lastSync ? (
        <p className="muted">Last sync: {label(lastSync.status)} at {lastSync.startedAt.toLocaleString("en-NG")}
          {lastSync.error ? " — check the server log or configuration." : ""}
        </p>
      ) : null}

      <div className="card">
        <table className="table">
          <thead><tr><th>Reference</th><th>Source</th><th>Subject</th><th>From</th><th>Handler</th><th>Action</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td><Link href={`/correspondence/${record.id}`}><strong>{record.referenceNumber}</strong></Link></td>
                <td><span className="badge">{label(record.intakeSource)}</span></td>
                <td>{record.subject}</td>
                <td>{record.senderName}</td>
                <td>
                  {record.claimedBy
                    ? <><strong>{record.claimedBy.name}</strong><br /><small className="muted">{record.claimedBy.office}</small></>
                    : <span className="muted">Unassigned</span>}
                </td>
                <td>
                  {!record.claimedById ? (
                    <form action={claimIntakeAction}>
                      <input type="hidden" name="correspondenceId" value={record.id} />
                      <button className="btn compact" type="submit">Claim</button>
                    </form>
                  ) : record.claimedById === user.id ? (
                    <Link className="eyebrow" href={`/correspondence/${record.id}`}>Continue</Link>
                  ) : <span className="muted">In progress</span>}
                </td>
              </tr>
            ))}
            {!records.length ? <tr><td colSpan={6} className="muted">The shared intake queue is clear.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
