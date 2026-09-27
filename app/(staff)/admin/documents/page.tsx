import { redirect } from "next/navigation";
import { retryDocumentProcessingAction } from "@/app/document-actions";
import { DocumentProcessingStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getApplicationConfiguration } from "@/lib/appearance";
import { updateAnnotationAuthenticationPolicyAction } from "@/app/annotation-policy-actions";

export default async function DocumentAdministrationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const query = await searchParams;

  const [counts, documents, annotationCount, configuration, policyHistory] = await Promise.all([
    db.attachment.groupBy({ by: ["processingStatus"], _count: true }),
    db.attachment.findMany({
      include: {
        correspondence: { select: { referenceNumber: true } },
        documentEvents: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.documentAnnotation.count(),
    getApplicationConfiguration(),
    db.configurationChange.findMany({ where: { setting: "annotationStrongAuthenticationRoles" }, include: { changedBy: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return <>
    <span className="eyebrow">Document security</span>
    <h1>Quarantine and processing</h1>
    <p className="muted">Available and Clean documents passed malware scanning. Available and Bypassed documents are usable under the explicit MALWARE_SCANNER=DISABLED control and remain visibly unscanned.</p>
    {query.policyUpdated ? <p className="notice success">Document-annotation authentication policy updated and audited.</p> : null}
    {query.policyError === "validation" ? <p className="notice error">Choose the roles and give a policy reason of at least 10 characters.</p> : null}
    {query.policyError === "stale" ? <p className="notice error">Another administrator changed application configuration. Review the current policy and try again.</p> : null}
    {query.policyError === "unchanged" ? <p className="notice">The selected annotation authentication policy is already active.</p> : null}
    {query.policyError === "missing" ? <p className="notice error">Application configuration is unavailable. Apply the latest database migrations.</p> : null}
    <section className="card" style={{ marginBottom: 18 }}>
      <span className="eyebrow">Annotation security policy</span>
      <h2>Require strong authentication by leadership role</h2>
      <p className="muted">Checked roles must use recent Workspace MFA or the supported local password fallback before an annotation is signed. Unchecked roles may annotate under an auditable administrator-policy exception. Document authority, classification and integrity controls are never relaxed.</p>
      <form action={updateAnnotationAuthenticationPolicyAction} className="form-grid">
        <input type="hidden" name="version" value={configuration.version} />
        <label className="check-field"><input type="checkbox" name="dg" defaultChecked={configuration.annotationMfaRequiredForDg} /><span>Require for DG</span></label>
        <label className="check-field"><input type="checkbox" name="directors" defaultChecked={configuration.annotationMfaRequiredForDirectors} /><span>Require for Directors</span></label>
        <label className="check-field"><input type="checkbox" name="divisionHeads" defaultChecked={configuration.annotationMfaRequiredForDivisionHeads} /><span>Require for Division Heads</span></label>
        <div className="field span-2"><label>Reason for policy change</label><textarea name="reason" minLength={10} maxLength={500} required placeholder="Record the approving authority, risk decision or operational reason…" /></div>
        <button className="btn span-2" type="submit">Save annotation authentication policy</button>
      </form>
      {policyHistory.length ? <div className="annotation-policy-history"><h3>Recent policy changes</h3>{policyHistory.map((change) => <p key={change.id}><strong>{change.previousValue} → {change.newValue}</strong><small className="registry-secondary">{change.reason} · {change.changedBy.name} · {change.createdAt.toLocaleString("en-NG")}</small></p>)}</div> : null}
    </section>
    <div className="stats-grid">
      {counts.map((item) => <div className="stat-card" key={item.processingStatus}><small>{item.processingStatus}</small><strong>{item._count}</strong></div>)}
      <div className="stat-card"><small>Authenticated annotations</small><strong>{annotationCount}</strong></div>
    </div>
    <p className="notice">Annotated PDFs are generated only from an Available source. The original is retained as an immutable historical source, while the generated PDF becomes the current package version and inherits Clean or Bypassed security provenance.</p>
    <section className="card" style={{ marginTop: 18 }}>
      <table className="table">
        <thead><tr><th>Document</th><th>State</th><th>Security</th><th>Processing</th><th>Control</th></tr></thead>
        <tbody>
          {documents.map((item) => <tr key={item.id}>
            <td><strong>{item.originalName}</strong><small className="registry-secondary">{item.correspondence.referenceNumber} · SHA-256 {item.sha256.slice(0, 12)}…</small></td>
            <td>{item.processingStatus}<small className="registry-secondary">OCR {item.ocrStatus}</small></td>
            <td>{item.malwareScanStatus}<small className="registry-secondary">{item.detectedMimeType ?? "Signature pending"}</small></td>
            <td>{item.processingAttempts} attempt(s)<small className="registry-secondary">{item.processingError ?? item.documentEvents[0]?.detail ?? "Awaiting worker"}</small></td>
            <td>{item.processingStatus !== DocumentProcessingStatus.PROCESSING && item.processingStatus !== DocumentProcessingStatus.AVAILABLE
              ? <form action={retryDocumentProcessingAction}><input type="hidden" name="attachmentId" value={item.id} /><button className="btn secondary compact">Retry</button></form>
              : "—"}</td>
          </tr>)}
          {!documents.length ? <tr><td colSpan={5}>No document records.</td></tr> : null}
        </tbody>
      </table>
    </section>
  </>;
}
