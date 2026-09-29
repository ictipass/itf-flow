import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Classification, RegistryScope } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { registryListAuthorization } from "@/lib/registry-access";
import { label } from "@/lib/reference";

export default async function RecordsRegistryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const authorization = await registryListAuthorization(user);
  if (authorization.needsStepUp) redirect(`/step-up?returnTo=${encodeURIComponent("/records")}`);
  if (!authorization.allowed || !authorization.scope) notFound();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const classificationScope = authorization.scope === RegistryScope.OPEN
    ? { in: [Classification.PUBLIC, Classification.INTERNAL] }
    : undefined;
  const records = await db.correspondence.findMany({
    where: {
      status: { not: "DRAFT" },
      ...(classificationScope ? { classification: classificationScope } : {}),
      ...(q ? { OR: [
        { referenceNumber: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { ultimateRecipientName: { contains: q, mode: "insensitive" } },
        { ultimateRecipient: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { staffNumber: { contains: q, mode: "insensitive" } }] } } },
        { recordFile: { is: { OR: [{ label: { contains: q, mode: "insensitive" } }, { filePlanCode: { contains: q, mode: "insensitive" } }, { subjectUser: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { staffNumber: { contains: q, mode: "insensitive" } }] } } }] } } },
      ] } : {}),
    },
    include: { ultimateRecipient: true, recordFile: { include: { subjectUser: true } }, createdBy: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return <>
    <span className="eyebrow">{authorization.scope === RegistryScope.SECRET ? "Secret Registry" : "Open Registry"}</span><h1>Official records retrieval</h1>
    <p className="muted">Private Blob objects are retrieved only through authorization, security-gate and audit controls. {authorization.scope === RegistryScope.OPEN ? "This appointment is limited to Public and Internal records." : "This appointment permits all classifications under the current MFA policy."}</p>
    <form className="card registry-filters" method="get"><label className="field registry-search"><span>Search official files</span><input name="q" defaultValue={q} placeholder="Reference, subject, staff number, ultimate recipient or file-plan code" /></label><div className="registry-filter-actions"><button className="btn" type="submit">Search</button><Link className="btn secondary" href="/records">Clear</Link></div></form>
    <section className="card" style={{ marginTop: 18 }}><table className="table"><thead><tr><th>Correspondence</th><th>Ultimate recipient</th><th>Official file</th><th>Classification</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.subject}</strong><small className="registry-secondary">{record.referenceNumber} · created by {record.createdBy?.name ?? record.senderName}</small></td><td>{record.ultimateRecipient?.name ?? record.ultimateRecipientName ?? "Not assigned"}</td><td>{record.recordFile?.label ?? "Unfiled legacy record"}<small className="registry-secondary">{record.recordFile ? `${record.recordFile.filePlanCode} · ${record.recordFile.retentionClass}` : "Requires filing review"}</small></td><td><span className={`badge ${record.classification === "SECRET" ? "secret" : ""}`}>{label(record.classification)}</span></td><td><div className="actions"><Link className="btn secondary compact" href={`/correspondence/${record.id}`}>View record</Link><a className="btn secondary compact" href={`/api/reports/correspondence/${record.id}/evidence-package`}>Evidence package</a></div></td></tr>)}{!records.length ? <tr><td colSpan={5}>No authorized records match this search.</td></tr> : null}</tbody></table></section>
  </>;
}
