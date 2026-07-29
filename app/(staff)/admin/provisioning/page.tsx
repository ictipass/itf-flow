import { redirect } from "next/navigation";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function ProvisioningPage() {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");

  const [total, active, entitledFromWorkspace, missingSupervisor, recentRuns] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.user.count({ where: { workspaceUserId: { not: null } } }),
      db.user.findMany({
        where: {
          isActive: true,
          supervisorId: null,
          role: { notIn: [UserRole.DG, UserRole.SYSTEM_ADMIN] },
        },
        orderBy: { name: "asc" },
        take: 50,
      }),
      db.provisioningRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  return (
    <>
      <span className="eyebrow">System administration</span>
      <h1>Directory provisioning</h1>
      <p className="muted">
        Workspace remains the staff system of record. This page reports synchronization
        health and routing-line gaps in ITF Flow.
      </p>

      <section className="grid stats" style={{ marginTop: 22 }}>
        <div className="card stat"><span className="muted">Directory users</span><strong>{total}</strong></div>
        <div className="card stat"><span className="muted">Active users</span><strong>{active}</strong></div>
        <div className="card stat"><span className="muted">Workspace linked</span><strong>{entitledFromWorkspace}</strong></div>
        <div className="card stat"><span className="muted">Reporting gaps</span><strong>{missingSupervisor.length}</strong></div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Reporting-line gaps</h2>
        <p className="muted">Active non-executive users without an assigned supervisor.</p>
        <table className="table">
          <thead><tr><th>Staff</th><th>Staff number</th><th>Role</th><th>Department</th></tr></thead>
          <tbody>
            {missingSupervisor.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong><br /><small className="muted">{item.email}</small></td>
                <td>{item.staffNumber ?? "—"}</td>
                <td>{label(item.role)}</td>
                <td>{item.department ?? "—"}</td>
              </tr>
            ))}
            {!missingSupervisor.length ? <tr><td colSpan={4}>No reporting-line gaps detected.</td></tr> : null}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2>Recent synchronization runs</h2>
        <table className="table">
          <thead><tr><th>Started</th><th>Status</th><th>Received</th><th>Created</th><th>Updated</th><th>Inactive</th></tr></thead>
          <tbody>
            {recentRuns.map((run) => (
              <tr key={run.id}>
                <td>{run.createdAt.toLocaleString("en-NG")}</td>
                <td><span className="badge">{label(run.status)}</span></td>
                <td>{run.receivedCount}</td><td>{run.createdCount}</td>
                <td>{run.updatedCount}</td><td>{run.inactiveCount}</td>
              </tr>
            ))}
            {!recentRuns.length ? <tr><td colSpan={6}>No directory synchronization has run yet.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
