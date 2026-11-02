import { redirect } from "next/navigation";
import { configureDepartmentCorrespondenceProfileAction } from "@/app/department-correspondence-actions";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const defaultAddress = ["Headquarters Office Complex", "Miango Road", "P.M.B. 2199", "Jos, Plateau State", "NIGERIA"].join("\n");

export default async function DepartmentCorrespondencePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const params = await searchParams;
  const [plans, profiles] = await Promise.all([
    db.directorateContinuityPlan.findMany({ where: { isActive: true }, include: { director: true }, orderBy: { departmentName: "asc" } }),
    db.departmentCorrespondenceProfile.findMany({ include: { configuredBy: true }, orderBy: { departmentName: "asc" } }),
  ]);
  const errors: Record<string, string> = {
    validation: "Select a department and enter a valid departmental email, address and configuration reason.",
    department: "The selected department needs an active Directorate continuity plan first.",
    address: "Enter the letterhead address as 2 to 8 non-empty lines.",
  };
  return <>
    <span className="eyebrow">Outgoing-letter control</span>
    <h1>Department letterheads and copy mailboxes</h1>
    <p className="muted">The ITF logo and organization heading are controlled by the application. Configure the department identity, address and mailbox used on the letterhead and for the clearly labelled departmental copy.</p>
    {params.saved ? <p className="notice success">Department correspondence profile saved in the configuration audit trail.</p> : null}
    {params.error && errors[params.error] ? <p className="notice error">{errors[params.error]}</p> : null}
    <form action={configureDepartmentCorrespondenceProfileAction} className="card form-grid">
      <label className="field"><span>Department</span><select name="departmentKey" required><option value="">Select department</option>{plans.map((plan) => <option value={plan.departmentKey} key={plan.id}>{plan.departmentName} · Director: {plan.director.name}</option>)}</select></label>
      <label className="field"><span>Department email</span><input name="emailAddress" type="email" required placeholder="department@itf.gov.ng" /><small className="muted">Every official outgoing email queues a separate copy to this address.</small></label>
      <label className="field span-2"><span>Letterhead address, one line per row</span><textarea name="addressLines" required defaultValue={defaultAddress} rows={6} /></label>
      <label className="field span-2"><span>Configuration authority / reason</span><textarea name="reason" required minLength={10} maxLength={500} placeholder="Reference the approved department mailbox or administrative instruction." /></label>
      <button className="btn span-2" type="submit">Save department correspondence profile</button>
    </form>
    <section className="card" style={{ marginTop: 18 }}>
      <h2>Configured departments</h2>
      <table className="table"><thead><tr><th>Department</th><th>Copy mailbox</th><th>Letterhead address</th><th>Control record</th></tr></thead><tbody>
        {profiles.map((profile) => <tr key={profile.id}><td><strong>{profile.departmentName}</strong><small className="registry-secondary">{profile.departmentKey}</small></td><td>{profile.emailAddress}</td><td>{profile.addressLines.map((line) => <span className="registry-secondary" key={line}>{line}</span>)}</td><td>{profile.isActive ? "Active" : "Inactive"}<small className="registry-secondary">v{profile.version} · {profile.configuredBy.name}<br />{profile.reason}</small></td></tr>)}
        {!profiles.length ? <tr><td colSpan={4} className="muted">No department outgoing-letter profile has been configured.</td></tr> : null}
      </tbody></table>
    </section>
  </>;
}
