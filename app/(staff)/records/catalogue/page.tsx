import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createRecordSeriesAction,
  createRetentionPolicyAction,
  registerLegacyPersonnelFileAction,
  retireLegacyPersonnelFileAction,
  retireRecordSeriesAction,
  retireRetentionPolicyAction,
} from "@/app/records-catalogue-actions";
import { SingleStaffPicker } from "@/components/single-staff-picker";
import { db } from "@/lib/db";
import { activeOrganizationUnitOptions, canManageRecordsCatalogue } from "@/lib/records-catalogue";
import { recordCategoryGuidance } from "@/lib/records-catalogue-shared";
import { requireUser } from "@/lib/session";

export default async function RecordsCataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireUser();
  if (!canManageRecordsCatalogue(actor.role)) redirect("/dashboard");
  const query = await searchParams;
  const [policies, series, legacyFiles, organizations] = await Promise.all([
    db.retentionPolicy.findMany({ include: { _count: { select: { recordSeries: true, recordFiles: true } } }, orderBy: [{ isActive: "desc" }, { code: "asc" }, { version: "desc" }] }),
    db.recordSeries.findMany({ include: { retentionPolicy: true, _count: { select: { recordFiles: true } } }, orderBy: [{ isActive: "desc" }, { category: "asc" }, { title: "asc" }] }),
    db.legacyPersonnelFile.findMany({ include: { subjectUser: true, mappedBy: true }, orderBy: [{ isActive: "desc" }, { legacyUnit: "asc" }, { boxNumber: "asc" }], take: 300 }),
    activeOrganizationUnitOptions(),
  ]);
  const activePolicies = policies.filter((item) => item.isActive);
  const success = query.policyCreated || query.policyRetired || query.seriesCreated || query.seriesRetired || query.legacyMapped || query.legacyRetired;
  const error = query.error || query.duplicate || query.policyInUse || query.stale || query.legacyError;
  return <>
    <span className="eyebrow">Records catalogue</span><h1>File plan, retention and legacy staff boxes</h1>
    <p className="muted">Records Administration governs the choices shown to originators. File-plan codes and retention rules are derived from the selected record series; legacy EDMS boxes remain external locations linked to the staff subject.</p>
    <div className="actions"><Link className="btn secondary" href="/records">Official records</Link>{actor.role === "SYSTEM_ADMIN" ? <Link className="btn secondary" href="/admin/records">Registry access governance</Link> : null}</div>
    {success ? <p className="notice success">The records catalogue was updated and audited.</p> : null}
    {error ? <p className="notice error">The catalogue change was rejected. Check required values, active dependencies and duplicate codes or box mappings.</p> : null}

    <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 18 }}>
      <section className="card"><h2>Create retention policy</h2><p className="muted">Retire an old policy before creating the next version with the same code. Active record series prevent retirement.</p><form action={createRetentionPolicyAction} className="grid">
        <div className="field"><label>Policy code</label><input name="code" required pattern="[A-Za-z0-9._/-]{3,80}" placeholder="e.g. PERSONNEL-EMPLOYMENT-10Y" /></div>
        <div className="field"><label>Policy name</label><input name="name" required minLength={3} placeholder="Employment end plus 10 years" /></div>
        <div className="field span-2"><label>Description</label><textarea name="description" required minLength={10} placeholder="Explain the retention period in plain language." /></div>
        <div className="field"><label>Retention trigger</label><select name="trigger" defaultValue="RESOLUTION"><option value="RESOLUTION">Matter resolution</option><option value="FILE_CLOSURE">File closure</option><option value="EMPLOYMENT_END">Employment end</option><option value="CONTRACT_END">Contract end</option><option value="EVENT_DATE">Specified event date</option><option value="PERMANENT">Permanent</option></select></div>
        <div className="field"><label>Duration in years</label><input name="durationYears" type="number" min={1} max={100} placeholder="Leave blank for permanent" /></div>
        <div className="field"><label>Final disposition</label><select name="disposition" defaultValue="REVIEW"><option value="REVIEW">Records review</option><option value="ARCHIVE">Transfer to archive</option><option value="DESTROY">Approved destruction</option><option value="PERMANENT">Permanent preservation</option></select></div>
        <div className="field"><label>Legal/policy authority</label><input name="legalAuthority" required minLength={5} placeholder="Approved schedule or authority reference" /></div>
        <div className="field span-2"><label>Creation reason</label><textarea name="reason" required minLength={10} placeholder="Approval reference and reason for creating this policy" /></div>
        <button className="btn" type="submit">Create retention policy</button>
      </form></section>

      <section className="card"><h2>Create record series</h2><p className="muted">This is the friendly selection staff see. The code, retention and owning office are snapshotted on submission.</p><form action={createRecordSeriesAction} className="grid">
        <div className="field"><label>File-plan code</label><input name="code" required pattern="[A-Za-z0-9._/-]{3,80}" placeholder="e.g. HR/PER/DISC/QUERY" /></div>
        <div className="field"><label>User-facing title</label><input name="title" required minLength={3} placeholder="Staff disciplinary matters — Query" /></div>
        <div className="field span-2"><label>Description and use case</label><textarea name="description" required minLength={10} placeholder="Explain when an originator should select this series." /></div>
        <div className="field"><label>Official record category</label><select name="category" defaultValue="OFFICE"><option value="OFFICE">Office / departmental</option><option value="PERSONNEL">Personnel</option><option value="CORPORATE">Corporate</option><option value="EXTERNAL_CASE">External case</option></select></div>
        <div className="field"><label>Retention policy</label><select name="retentionPolicyId" required defaultValue=""><option value="">Select active policy…</option>{activePolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} · {policy.code} v{policy.version}</option>)}</select></div>
        <div className="field span-2"><label>Default records-owning office/unit</label><select name="defaultOwnerOrgUnitKey" required defaultValue=""><option value="">Select synchronized organization…</option>{organizations.map((organization) => <option key={organization.key} value={organization.key}>{organization.name} · {organization.level.toLowerCase()}</option>)}</select><small className="muted">Sourced from active Workspace-synchronized staff organization assignments.</small></div>
        <div className="field"><label>Legacy EDMS unit</label><input name="legacyUnit" placeholder="e.g. SECRET REGISTRY" /></div>
        <div className="field"><label>Legacy box category</label><input name="legacyBoxCategory" placeholder="e.g. PERSONNEL FILES" /></div>
        <div className="field span-2"><label>Creation reason</label><textarea name="reason" required minLength={10} placeholder="Approval reference and classification rationale" /></div>
        <button className="btn" type="submit">Create record series</button>
      </form></section>
    </div>

    <section className="card" style={{ marginTop: 18 }}><h2>Official category guidance presented to staff</h2><div className="grid">{Object.entries(recordCategoryGuidance).map(([category, guidance]) => <p key={category}><strong>{category.replaceAll("_", " ")}</strong><small className="registry-secondary">{guidance}</small></p>)}</div></section>

    <section className="card" style={{ marginTop: 18 }}><h2>Active and retired record series</h2><table className="table"><thead><tr><th>Series</th><th>Category/owner</th><th>Retention</th><th>Legacy crosswalk</th><th>Control</th></tr></thead><tbody>{series.map((item) => <tr key={item.id}><td><strong>{item.title}</strong><small className="registry-secondary">{item.code} · version {item.version} · {item.isActive ? "Active" : "Retired"}</small><small className="registry-secondary">{item.description}</small></td><td>{item.category.replaceAll("_", " ")}<small className="registry-secondary">{item.defaultOwnerOrgUnitName ?? "Owner selected at origination"}</small></td><td>{item.retentionPolicy.name}<small className="registry-secondary">{item.retentionPolicy.code} v{item.retentionPolicy.version}</small></td><td>{[item.legacyUnit, item.legacyBoxCategory].filter(Boolean).join(" / ") || "Not mapped"}</td><td>{item.isActive ? <form action={retireRecordSeriesAction}><input type="hidden" name="seriesId" value={item.id} /><input name="reason" required minLength={10} placeholder="Retirement reason" /><button className="btn secondary compact">Retire</button></form> : `${item._count.recordFiles} official file(s)`}</td></tr>)}</tbody></table></section>

    <section className="card" style={{ marginTop: 18 }}><h2>Retention policy register</h2><table className="table"><thead><tr><th>Policy</th><th>Rule</th><th>Authority</th><th>Control</th></tr></thead><tbody>{policies.map((policy) => <tr key={policy.id}><td><strong>{policy.name}</strong><small className="registry-secondary">{policy.code} · version {policy.version} · {policy.isActive ? "Active" : "Retired"}</small></td><td>{policy.trigger.replaceAll("_", " ")} · {policy.durationYears ? `${policy.durationYears} year(s)` : "Permanent/no duration"} · {policy.disposition.toLowerCase()}</td><td>{policy.legalAuthority}<small className="registry-secondary">{policy.description}</small></td><td>{policy.isActive ? <form action={retireRetentionPolicyAction}><input type="hidden" name="policyId" value={policy.id} /><input name="reason" required minLength={10} placeholder="Retirement reason" /><button className="btn secondary compact">Retire</button></form> : `${policy._count.recordSeries} series · ${policy._count.recordFiles} files`}</td></tr>)}</tbody></table></section>

    <section className="card" style={{ marginTop: 18 }}><h2>Map an existing staff box</h2><p className="muted">This records the deployed EDMS locator without moving or exposing the scanned objects. One staff member may have several boxes or volumes.</p><form action={registerLegacyPersonnelFileAction} className="form-grid">
      <div className="field span-2"><SingleStaffPicker fieldName="subjectUserId" label="Personnel-file subject" hint="Select the staff member whose scanned paper file this box represents." required /></div>
      <div className="field"><label>Legacy registry unit</label><select name="legacyUnit" defaultValue="SECRET REGISTRY"><option>SECRET REGISTRY</option><option>OPEN REGISTRY</option><option>RECORDS OFFICE</option></select></div>
      <div className="field"><label>Legacy box category</label><select name="boxCategory" defaultValue="PERSONNEL FILES"><option>PERSONNEL FILES</option><option>RETIREES FILES</option><option>EXITED FILES</option><option>SUBJECT FILES</option></select></div>
      <div className="field"><label>Box number</label><input name="boxNumber" required /></div>
      <div className="field"><label>File volume</label><input name="fileVolume" placeholder="e.g. Volume 1" /></div>
      <div className="field"><label>Legacy reference/staff ID</label><input name="legacyRefId" required /></div>
      <div className="field"><label>Legacy file/staff name</label><input name="legacyRefName" /></div>
      <div className="field"><label>EDMS document ID</label><input name="legacyDocumentId" /></div>
      <div className="field"><label>EDMS folder ID</label><input name="legacyFolderId" /></div>
      <div className="field"><label>File opened</label><input name="fileOpenDate" type="date" /></div>
      <div className="field"><label>File closed</label><input name="fileCloseDate" type="date" /></div>
      <div className="field span-2"><label>Legacy object path</label><input name="storagePath" placeholder="MainBox/SECRET REGISTRY/PERSONNEL FILES/..." /></div>
      <div className="field span-2"><label>SHA-256, when inventory has verified it</label><input name="sha256" pattern="[A-Fa-f0-9]{64}" /></div>
      <div className="field span-2"><label>Mapping authority/reason</label><textarea name="reason" required minLength={10} /></div>
      <button className="btn" type="submit">Register legacy box mapping</button>
    </form></section>

    <section className="card" style={{ marginTop: 18 }}><h2>Legacy personnel-file mappings</h2><table className="table"><thead><tr><th>Staff</th><th>Legacy location</th><th>Reference</th><th>Integrity</th><th>Control</th></tr></thead><tbody>{legacyFiles.map((item) => <tr key={item.id}><td><strong>{item.subjectUser.name}</strong><small className="registry-secondary">{item.subjectUser.staffNumber ?? item.subjectUser.email}</small></td><td>{item.legacyUnit} / {item.boxCategory} / {item.boxNumber}<small className="registry-secondary">{item.fileVolume ?? "No volume"} · {item.isActive ? "Active" : "Retired"}</small></td><td>{item.legacyRefId}<small className="registry-secondary">{item.legacyRefName ?? item.storagePath ?? "No descriptive locator"}</small></td><td>{item.sha256 ? `SHA-256 ${item.sha256.slice(0, 12)}…` : "Checksum pending"}</td><td>{item.isActive ? <form action={retireLegacyPersonnelFileAction}><input type="hidden" name="mappingId" value={item.id} /><input name="reason" required minLength={10} placeholder="Retirement reason" /><button className="btn secondary compact">Retire mapping</button></form> : "—"}</td></tr>)}{!legacyFiles.length ? <tr><td colSpan={5}>No legacy staff boxes have been mapped.</td></tr> : null}</tbody></table></section>
  </>;
}
