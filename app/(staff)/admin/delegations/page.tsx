import { redirect } from "next/navigation";
import { createDelegationAction, revokeDelegationAction } from "@/app/delegation-actions";
import { DelegationKind, DelegationStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function DelegationsPage() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const [staff, appointments] = await Promise.all([
    db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, take: 500 }),
    db.delegation.findMany({ include: { principal: true, delegate: true, createdBy: true, events: { include: { actor: true }, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return <><span className="eyebrow">Authority administration</span><h1>Delegation and acting appointments</h1><p className="muted">Appointments are time-bound, auditable and leave work owned by the original office. Approval authority must be granted explicitly.</p>
    <form action={createDelegationAction} className="card form-grid">
      <label className="field"><span>Authority holder</span><select name="principalId" required><option value="">Select staff</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name} · {label(item.role)}</option>)}</select></label>
      <label className="field"><span>Delegate / acting officer</span><select name="delegateId" required><option value="">Select staff</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name} · {label(item.role)}</option>)}</select></label>
      <label className="field"><span>Authority type</span><select name="kind">{Object.values(DelegationKind).map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}</select></label>
      <label className="field"><span>Office or desk label</span><input name="officeLabel" required placeholder="Director ICT desk" /></label>
      <label className="field"><span>Starts</span><input name="startsAt" type="datetime-local" required /></label>
      <label className="field"><span>Ends</span><input name="endsAt" type="datetime-local" required /></label>
      <label className="check-field"><input name="canApprove" type="checkbox" /><span>May exercise formal approval authority</span></label>
      <label className="field span-2"><span>Appointment reason / authority reference</span><textarea name="reason" required minLength={10} /></label>
      <div><button className="btn" type="submit">Create appointment</button></div>
    </form>
    <div className="card" style={{ marginTop: 18 }}><h2>Appointment register</h2><table className="table"><thead><tr><th>Desk</th><th>Authority holder</th><th>Acting officer</th><th>Period</th><th>Status / audit</th><th>Control</th></tr></thead><tbody>{appointments.map((item) => { const expired = item.status === DelegationStatus.ACTIVE && item.endsAt < new Date(); return <tr key={item.id}><td><strong>{item.officeLabel}</strong><small className="registry-secondary">{label(item.kind)}{item.canApprove ? " · approval enabled" : ""}</small></td><td>{item.principal.name}</td><td>{item.delegate.name}</td><td>{item.startsAt.toLocaleString("en-NG")}<br />to {item.endsAt.toLocaleString("en-NG")}</td><td>{item.status === DelegationStatus.REVOKED ? "Revoked" : expired ? "Expired" : item.startsAt > new Date() ? "Scheduled" : "Active"}<small className="registry-secondary">Created by {item.createdBy.name}: {item.reason}{item.revocationReason ? ` · Revoked: ${item.revocationReason}` : ""}</small></td><td>{item.status === DelegationStatus.ACTIVE && !expired ? <form action={revokeDelegationAction}><input type="hidden" name="delegationId" value={item.id} /><input name="reason" required minLength={10} placeholder="Revocation reason" /><button className="btn secondary compact" type="submit">Revoke</button></form> : "—"}</td></tr>; })}{!appointments.length ? <tr><td colSpan={6}>No appointments recorded.</td></tr> : null}</tbody></table></div>
  </>;
}
