import Link from "next/link";
import { Classification, CorrespondenceStatus, Priority } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";
import { normalizeRegistryParams, registryQueryString, registryWhere } from "@/lib/correspondence-registry";

export default async function CorrespondencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const params = normalizeRegistryParams(await searchParams);
  const where = registryWhere(user, params);
  const [records, total] = await Promise.all([db.correspondence.findMany({
    where,
    include: { workItems: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } }, include: { assignee: true }, orderBy: { assignedAt: "desc" }, take: 2 } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  }), db.correspondence.count({ where })]);
  const query = registryQueryString(params);
  return (
    <>
      <span className="eyebrow">Search and records</span><h1>Correspondence register</h1>
      <p className="muted">Search content and routing minutes, narrow the register, then export the same authorized result set.</p>
      <form className="card registry-filters" method="get">
        <label className="field registry-search"><span>Search</span><input name="q" defaultValue={params.q} placeholder="Reference, sender, subject, content, minute or tracking code" /></label>
        <label className="field"><span>Classification</span><select name="classification" defaultValue={params.classification ?? ""}><option value="">All permitted</option>{Object.values(Classification).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="field"><span>Priority</span><select name="priority" defaultValue={params.priority ?? ""}><option value="">All priorities</option>{Object.values(Priority).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="field"><span>Status</span><select name="status" defaultValue={params.status ?? ""}><option value="">All statuses</option>{Object.values(CorrespondenceStatus).filter((value) => value !== CorrespondenceStatus.DRAFT).map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="field"><span>Owner</span><input name="owner" defaultValue={params.owner} placeholder="Name, email or staff number" /></label>
        <label className="field"><span>Office</span><input name="office" defaultValue={params.office} /></label>
        <label className="field"><span>Department</span><input name="department" defaultValue={params.department} /></label>
        <label className="field"><span>Received from</span><input name="from" type="date" defaultValue={params.from} /></label>
        <label className="field"><span>Received to</span><input name="to" type="date" defaultValue={params.to} /></label>
        <div className="registry-filter-actions"><button className="btn" type="submit">Apply filters</button><Link className="btn secondary" href="/correspondence">Clear</Link></div>
      </form>
      <div className="registry-toolbar"><p><strong>{total}</strong> matching record{total === 1 ? "" : "s"}{total > 200 ? " · showing latest 200" : ""}</p><div><a className="btn secondary compact" href={`/api/reports/correspondence-register${query ? `?${query}` : ""}`}>Export register CSV</a><a className="btn secondary compact" href={`/api/reports/movement-register${query ? `?${query}` : ""}`}>Export movement CSV</a></div></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Reference</th><th>Subject / sender</th><th>Classification</th><th>Current owner</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.id}>
            <td><Link href={`/correspondence/${record.id}`}><strong>{record.referenceNumber}</strong></Link></td>
            <td><strong>{record.subject}</strong><small className="registry-secondary">{record.senderName}</small></td>
            <td><span className={`badge ${record.classification === "SECRET" ? "secret" : ""}`}>{label(record.classification)}</span></td>
            <td>{record.workItems.length ? record.workItems.map((item) => item.assignee.name).join(", ") : "—"}</td>
            <td>{label(record.status)}</td><td>{record.updatedAt.toLocaleString("en-NG")}</td>
          </tr>)}</tbody>
          {!records.length ? <tbody><tr><td colSpan={6} className="muted">No correspondence matches these filters.</td></tr></tbody> : null}
        </table>
      </div>
    </>
  );
}
