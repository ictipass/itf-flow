import { createRegistryAppointmentAction, revokeRegistryAppointmentAction, updateSecretRegistryMfaPolicyAction } from "@/app/records-actions";
import { SingleStaffPicker } from "@/components/single-staff-picker";
import { UserRole } from "@/lib/generated/prisma/client";
import { getApplicationConfiguration } from "@/lib/appearance";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function RecordsAdministrationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const query = await searchParams;
  const [configuration, appointments, changes] = await Promise.all([
    getApplicationConfiguration(),
    db.registryAppointment.findMany({ include: { user: true, createdBy: true, revokedBy: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.configurationChange.findMany({ where: { setting: { in: ["secretRegistryMfaRequired", "REGISTRY_APPOINTMENT_CREATED", "REGISTRY_APPOINTMENT_REVOKED"] } }, include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const now = new Date();
  const minimumExpiry = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  return <>
    <span className="eyebrow">Records governance</span><h1>Open and Secret Registry access</h1>
    <p className="muted">Appointments authorize retrieval through ITF Flow; they never expose direct Blob credentials. Open Registry can retrieve Public/Internal records. Secret Registry can retrieve all classifications, with audited MFA policy.</p>
    {query.created || query.revoked || query.policy ? <p className="notice success">Records governance was updated and audited.</p> : null}
    {query.error ? <p className="notice error">The request was invalid, stale or unchanged. Review the current values and try again.</p> : null}
    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 18 }}>
      <section className="card"><h2>Appoint registry staff</h2><form action={createRegistryAppointmentAction} className="grid"><SingleStaffPicker fieldName="userId" label="Staff member" hint="Any active staff member may receive a time-bound registry appointment." required /><div className="field"><label>Registry scope</label><select name="scope" defaultValue="OPEN"><option value="OPEN">Open Registry — Public/Internal</option><option value="SECRET">Secret Registry — all classifications</option></select></div><div className="field"><label>Appointment expiry (optional)</label><input name="endsAt" type="date" min={minimumExpiry} /></div><div className="field"><label>Appointment reason</label><textarea name="reason" required minLength={10} placeholder="Authority, approval reference and operational purpose" /></div><button className="btn" type="submit">Create appointment</button></form></section>
      <section className="card"><h2>Secret Registry MFA</h2><p className="muted">When enabled, Secret Registry staff must have recent enterprise MFA before listing or retrieving Confidential/Secret records. Relaxation is audited and does not weaken ordinary need-to-know controls.</p><form action={updateSecretRegistryMfaPolicyAction} className="grid"><input type="hidden" name="version" value={configuration.version} /><label className="check-field"><input type="checkbox" name="required" defaultChecked={configuration.secretRegistryMfaRequired} /><span>Require MFA for sensitive Secret Registry access</span></label><div className="field"><label>Change reason</label><textarea name="reason" required minLength={10} /></div><button className="btn" type="submit">Update MFA policy</button></form></section>
    </div>
    <section className="card" style={{ marginTop: 18 }}><h2>Appointment register</h2><table className="table"><thead><tr><th>Staff</th><th>Scope</th><th>Period</th><th>Authority</th><th>Control</th></tr></thead><tbody>{appointments.map((item) => { const active = !item.revokedAt && item.startsAt <= now && (!item.endsAt || item.endsAt >= now); return <tr key={item.id}><td><strong>{item.user.name}</strong><small className="registry-secondary">{item.user.staffNumber ?? item.user.email}</small></td><td><span className={`badge ${item.scope === "SECRET" ? "secret" : ""}`}>{item.scope}</span></td><td>{item.startsAt.toLocaleDateString("en-NG")} — {item.endsAt?.toLocaleDateString("en-NG") ?? "No expiry"}<small className="registry-secondary">{active ? "Active" : item.revokedAt ? `Revoked ${item.revokedAt.toLocaleString("en-NG")}` : "Expired/scheduled"}</small></td><td>{item.reason}<small className="registry-secondary">Appointed by {item.createdBy.name}</small></td><td>{active ? <form action={revokeRegistryAppointmentAction}><input type="hidden" name="appointmentId" value={item.id} /><input name="reason" required minLength={10} placeholder="Revocation reason" /><button className="btn secondary compact" type="submit">Revoke</button></form> : "—"}</td></tr>; })}{!appointments.length ? <tr><td colSpan={5}>No registry appointments have been created.</td></tr> : null}</tbody></table></section>
    <section className="card" style={{ marginTop: 18 }}><h2>Recent governance changes</h2>{changes.map((change) => <p key={change.id}><strong>{change.setting}</strong> · {change.previousValue} → {change.newValue}<small className="registry-secondary">{change.reason} · {change.changedBy.name} · {change.createdAt.toLocaleString("en-NG")}</small></p>)}</section>
  </>;
}
