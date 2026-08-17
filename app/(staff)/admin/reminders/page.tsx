import { redirect } from "next/navigation";
import { Clock3, Play, ShieldAlert } from "lucide-react";
import { runReminderAutomationAction, updateReminderPolicyAction } from "@/app/reminder-actions";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { getReminderPolicy } from "@/lib/reminders";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function ReminderAdministrationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const params = await searchParams;
  const [policy, runs, audit] = await Promise.all([
    getReminderPolicy(),
    db.scheduledAutomationRun.findMany({ where: { job: "WORKFLOW_REMINDERS_AND_DIGESTS" }, orderBy: { startedAt: "desc" }, take: 20 }),
    db.configurationChange.findMany({ where: { setting: "workflowReminderPolicy" }, include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return <>
    <div className="section-heading"><div><span className="eyebrow">Workflow automation</span><h1>Reminders and escalations</h1><p className="muted">Control due-soon reminders, overdue supervisor escalation, and daily role-scoped digests.</p></div><form action={runReminderAutomationAction}><button className="btn"><Play size={16} /> Run now</button></form></div>
    {params.updated ? <p className="notice success">Reminder policy updated.</p> : null}
    {params.ran ? <p className="notice success">Run completed: {params.reminders ?? 0} reminders, {params.overdue ?? 0} overdue notices, {params.escalations ?? 0} escalations and {params.digests ?? 0} digests queued.</p> : null}
    {params.error === "validation" ? <p className="notice error">Check the policy values and provide a reason of at least 10 characters.</p> : null}
    {params.error === "stale" ? <p className="notice error">Another administrator changed this policy. Refresh and try again.</p> : null}
    {params.error === "run" ? <p className="notice error">The automation run failed. Review the run ledger and server logs.</p> : null}
    <div className="grid" style={{ gridTemplateColumns: "minmax(320px, .75fr) minmax(0, 1.25fr)", alignItems: "start" }}>
      <section className="card"><h2>Active policy</h2><form action={updateReminderPolicyAction} className="grid">
        <input type="hidden" name="version" value={policy.version} />
        <label className="check-field"><input type="checkbox" name="enabled" defaultChecked={policy.enabled} /><span><strong>Enable scheduled reminders</strong><small>When disabled, runs complete without creating notifications.</small></span></label>
        <div className="field"><label>Remind before due date (days)</label><input type="number" name="reminderLeadDays" min="0" max="30" defaultValue={policy.reminderLeadDays} required /></div>
        <div className="field"><label>Escalate after overdue (days)</label><input type="number" name="escalationAfterDays" min="0" max="30" defaultValue={policy.escalationAfterDays} required /></div>
        <label className="check-field"><input type="checkbox" name="executiveDigestEnabled" defaultChecked={policy.executiveDigestEnabled} /><span><strong>Daily executive digest</strong><small>DG receives organization counts; Directors and Secretaries receive their own active scope.</small></span></label>
        <div className="field"><label>Business timezone</label><input name="timeZone" defaultValue={policy.timeZone} required /></div>
        <div className="field"><label>Reason for policy change</label><textarea name="reason" minLength={10} maxLength={500} required /></div>
        <button className="btn">Save policy</button>
      </form><p className="muted"><small>Version {policy.version} · last updated {policy.updatedAt.toLocaleString("en-NG")}{policy.updatedBy ? ` by ${policy.updatedBy.name}` : ""}</small></p></section>
      <section className="card"><h2>Recent runs</h2><table className="table"><thead><tr><th>Started</th><th>Status</th><th>Due soon</th><th>Overdue</th><th>Escalated</th><th>Digests</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td>{run.startedAt.toLocaleString("en-NG")}</td><td><span className="badge">{label(run.status)}</span>{run.errorCode ? <small className="muted"> · {run.errorCode}</small> : null}</td><td>{run.reminderCount}</td><td>{run.overdueCount}</td><td>{run.escalationCount}</td><td>{run.digestCount}</td></tr>)}{!runs.length ? <tr><td colSpan={6} className="muted">No automation runs yet.</td></tr> : null}</tbody></table></section>
    </div>
    <section className="card" style={{ marginTop: 20 }}><h2><ShieldAlert size={20} /> Policy audit</h2>{audit.map((change) => <p key={change.id}><strong>{change.changedBy.name}</strong> · {change.reason}<br /><small className="muted"><Clock3 size={12} /> {change.createdAt.toLocaleString("en-NG")}</small></p>)}{!audit.length ? <p className="muted">No policy changes recorded.</p> : null}</section>
  </>;
}
