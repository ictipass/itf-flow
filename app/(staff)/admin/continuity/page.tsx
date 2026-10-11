import { redirect } from "next/navigation";
import { configureContinuityPlanAction } from "@/app/continuity-actions";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ContinuityAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireUser();
  if (actor.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const params = await searchParams;
  const [directors, staff, plans] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: UserRole.DIRECTOR }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, take: 1000 }),
    db.directorateContinuityPlan.findMany({
      include: { director: { include: { staffAvailability: true } }, firstSuccessor: { include: { staffAvailability: true } }, secondSuccessor: { include: { staffAvailability: true } }, configuredBy: true },
      orderBy: { departmentName: "asc" },
    }),
  ]);
  const errors: Record<string, string> = {
    validation: "Select all three officers and provide a reason of at least 10 characters.",
    distinct: "The Director, first next-in-line and second next-in-line must be different people.",
    staff: "The authority holder must be an active Director and all selected staff must be active.",
    department: "Both next-in-line officers must belong to the Director's department.",
  };
  return <>
    <span className="eyebrow">Business continuity control</span>
    <h1>Directorate continuity plans</h1>
    <p className="muted">Configure the approved Director → first next-in-line → second next-in-line chain. Availability determines who receives new action work; the Director retains a read-only oversight copy whenever a successor acts.</p>
    {params.saved ? <p className="notice success">Continuity plan saved and recorded in the configuration audit trail.</p> : null}
    {params.error && errors[params.error] ? <p className="notice error">{errors[params.error]}</p> : null}
    <form action={configureContinuityPlanAction} className="card form-grid">
      <label className="field"><span>Director</span><select name="directorId" required><option value="">Select Director</option>{directors.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.department ?? user.office}</option>)}</select></label>
      <label className="field"><span>First next-in-line</span><select name="firstSuccessorId" required><option value="">Select staff</option>{staff.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.position ?? user.role} · {user.department ?? user.office}</option>)}</select></label>
      <label className="field"><span>Second next-in-line</span><select name="secondSuccessorId" required><option value="">Select staff</option>{staff.map((user) => <option value={user.id} key={user.id}>{user.name} · {user.position ?? user.role} · {user.department ?? user.office}</option>)}</select></label>
      <div className="field"><span>Approval authority</span><label className="check-field"><input type="checkbox" name="firstCanApprove" /> First successor may approve</label><label className="check-field"><input type="checkbox" name="secondCanApprove" /> Second successor may approve</label></div>
      <label className="field span-2"><span>Authority reference / reason</span><textarea name="reason" required minLength={10} maxLength={500} placeholder="Reference the approved succession or business-continuity decision." /></label>
      <button className="btn span-2" type="submit">Save continuity plan</button>
    </form>
    <section className="card" style={{ marginTop: 18 }}>
      <h2>Configured chains</h2>
      <table className="table"><thead><tr><th>Directorate</th><th>Director</th><th>First next-in-line</th><th>Second next-in-line</th><th>Control record</th></tr></thead><tbody>
        {plans.map((plan) => <tr key={plan.id}>
          <td><strong>{plan.departmentName}</strong><small className="registry-secondary">{plan.departmentKey}</small></td>
          <td>{plan.director.name}<small className="registry-secondary">{plan.director.staffAvailability?.status ?? "AVAILABLE (default)"}</small></td>
          <td>{plan.firstSuccessor.name}<small className="registry-secondary">{plan.firstSuccessor.staffAvailability?.status ?? "AVAILABLE (default)"}{plan.firstCanApprove ? " · approval enabled" : ""}</small></td>
          <td>{plan.secondSuccessor.name}<small className="registry-secondary">{plan.secondSuccessor.staffAvailability?.status ?? "AVAILABLE (default)"}{plan.secondCanApprove ? " · approval enabled" : ""}</small></td>
          <td>{plan.isActive ? "Active" : "Inactive"}<small className="registry-secondary">v{plan.version} · {plan.configuredBy.name}<br />{plan.reason}</small></td>
        </tr>)}
        {!plans.length ? <tr><td colSpan={5} className="muted">No continuity plan has been configured.</td></tr> : null}
      </tbody></table>
    </section>
  </>;
}
