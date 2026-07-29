import Link from "next/link";
import { UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

export default async function CorrespondencePage() {
  const user = await requireUser();
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role);
  const records = await db.correspondence.findMany({
    where: broadAccess ? {} : { OR: [{ createdById: user.id }, { workItems: { some: { assigneeId: user.id } } }] },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <>
      <span className="eyebrow">Registry</span><h1>Correspondence</h1>
      <div className="card">
        <table className="table">
          <thead><tr><th>Reference</th><th>Subject</th><th>Classification</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id}>
            <td><Link href={`/correspondence/${record.id}`}><strong>{record.referenceNumber}</strong></Link></td>
            <td>{record.subject}</td>
            <td><span className={`badge ${record.classification === "SECRET" ? "secret" : ""}`}>{label(record.classification)}</span></td>
            <td>{label(record.status)}</td><td>{record.updatedAt.toLocaleString("en-NG")}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
