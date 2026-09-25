import { redirect } from "next/navigation";
import { assignDepartmentSecretaryAction, deactivateDepartmentSecretaryAction } from "@/app/department-secretary-actions";
import { SingleDirectoryPersonPicker } from "@/components/single-directory-person-picker";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function DepartmentSecretariesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const params = await searchParams;
  const assignments = await db.departmentSecretaryAssignment.findMany({ include: { secretary: true, assignedBy: true }, orderBy: { departmentName: "asc" } });
  return <>
    <span className="eyebrow">Organization routing control</span>
    <h1>Department Secretaries</h1>
    <p className="muted">Public and Internal correspondence routed by the DG or a Director automatically copies the active Secretary of each recipient department. Confidential and Secret routing never creates this copy.</p>
    {params.assigned ? <p className="notice success">Department Secretary assignment saved and audited.</p> : null}
    {params.deactivated ? <p className="notice success">Department Secretary assignment deactivated.</p> : null}
    {params.error === "validation" ? <p className="notice error">Select a staff member and provide a reason of at least 10 characters.</p> : null}
    {params.error === "department" ? <p className="notice error">The selected staff member must have an active department assignment in the directory.</p> : null}
    {params.error === "stale" ? <p className="notice error">Another administrator changed this assignment. Refresh and try again.</p> : null}
    <section className="card">
      <h2>Assign or replace a Secretary</h2>
      <form action={assignDepartmentSecretaryAction} className="form-grid">
        <div className="field span-2"><SingleDirectoryPersonPicker /></div>
        <div className="field span-2"><label>Assignment reason</label><textarea name="reason" required minLength={10} maxLength={500} placeholder="Reference the approved department secretariat assignment…" /></div>
        <button className="btn span-2" type="submit">Save Department Secretary</button>
      </form>
    </section>
    <section className="card" style={{ marginTop: 18 }}>
      <h2>Current assignments</h2>
      <table className="table"><thead><tr><th>Department</th><th>Secretary</th><th>Status</th><th>Last change</th><th>Control</th></tr></thead><tbody>
        {assignments.map((assignment) => <tr key={assignment.id}><td><strong>{assignment.departmentName}</strong><br /><small className="muted">{assignment.departmentKey}</small></td><td>{assignment.secretary.name}<br /><small className="muted">{assignment.secretary.position ?? assignment.secretary.email}</small></td><td><span className="badge">{assignment.isActive ? "Active" : "Inactive"}</span></td><td>{assignment.updatedAt.toLocaleString("en-NG")}<br /><small className="muted">by {assignment.assignedBy.name} · v{assignment.version}</small></td><td>{assignment.isActive ? <form action={deactivateDepartmentSecretaryAction} className="grid"><input type="hidden" name="assignmentId" value={assignment.id} /><input type="hidden" name="version" value={assignment.version} /><input name="reason" required minLength={10} maxLength={500} placeholder="Deactivation reason" /><button className="btn secondary compact">Deactivate</button></form> : "—"}</td></tr>)}
        {!assignments.length ? <tr><td colSpan={5} className="muted">No Department Secretary assignments have been configured.</td></tr> : null}
      </tbody></table>
    </section>
  </>;
}
