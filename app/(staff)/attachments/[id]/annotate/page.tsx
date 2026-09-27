import Link from "next/link";
import { notFound } from "next/navigation";
import { annotateAttachmentAction } from "@/app/annotation-actions";
import { db } from "@/lib/db";
import { workAuthority } from "@/lib/delegations";
import { isAnnotatableDocument } from "@/lib/document-annotation";
import { attachmentPassesDocumentSecurityGate } from "@/lib/document-security";
import { canMinute } from "@/lib/permissions";
import { hasActiveEnterpriseMfa, requireUser } from "@/lib/session";
import { label } from "@/lib/reference";
import { annotationAuthenticationPolicyFor } from "@/lib/annotation-policy";

export default async function AnnotateAttachmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const attachment = await db.attachment.findFirst({
    where: { id, isIncluded: true },
    include: { correspondence: true },
  });
  if (!attachment || !attachmentPassesDocumentSecurityGate(attachment) || !isAnnotatableDocument(attachment.mimeType)) notFound();
  const authority = await workAuthority({ correspondenceId: attachment.correspondenceId, actor: user });
  if (!authority || !canMinute(authority.principal.role)) notFound();
  const authenticationPolicy = await annotationAuthenticationPolicyFor(authority.principal.role);
  const enterpriseMfaActive = authenticationPolicy.required ? await hasActiveEnterpriseMfa() : false;
  const isImage = attachment.mimeType === "image/jpeg" || attachment.mimeType === "image/png";

  return (
    <>
      <div className="annotation-heading">
        <div>
          <span className="eyebrow">In-document minute and sign</span>
          <h1>{attachment.originalName}</h1>
          <p className="muted">{attachment.correspondence.referenceNumber} · {attachment.correspondence.subject}</p>
        </div>
        <Link className="btn secondary" href={`/correspondence/${attachment.correspondenceId}`}>Cancel</Link>
      </div>
      <p className="notice">The original remains immutable. Saving creates a new PDF version, a correspondence revision and a tamper-evident authenticated signing record. It does not record formal approval.</p>
      <div className="annotation-workspace">
        <section className="card annotation-preview">
          <iframe src={`/attachments/${attachment.id}?inline=1`} title={`Preview of ${attachment.originalName}`} />
          <a className="btn secondary compact" href={`/attachments/${attachment.id}`} target="_blank" rel="noreferrer">Open source in a new tab</a>
        </section>
        <section className="card annotation-form-card">
          <span className="eyebrow">Authenticated signing block</span>
          <h2>Add minute</h2>
          <p className="muted">Signing as <strong>{user.name}</strong> · {label(authority.principal.role)}{authority.delegation ? ` · acting for ${authority.principal.name}` : ""}.</p>
          <form action={annotateAttachmentAction} className="grid">
            <input type="hidden" name="attachmentId" value={attachment.id} />
            <div className="field">
              <label>Page number</label>
              <input name="pageNumber" type="number" min="1" max={isImage ? 1 : 10000} defaultValue="1" required readOnly={isImage} />
              <small className="muted">{isImage ? "Images are converted to a one-page PDF." : "Use the page number shown in the preview."}</small>
            </div>
            <div className="field">
              <label>Placement</label>
              <select name="placement" defaultValue="TOP_RIGHT" required>
                <option value="TOP_RIGHT">Top right</option>
                <option value="TOP_LEFT">Top left</option>
                <option value="BOTTOM_RIGHT">Bottom right</option>
                <option value="BOTTOM_LEFT">Bottom left</option>
              </select>
            </div>
            <div className="field">
              <label>Minute</label>
              <textarea name="minuteText" minLength={3} maxLength={1500} required rows={9} placeholder="Enter the instruction, observation or decision to place directly on the document…" />
            </div>
            {!authenticationPolicy.required ? (
              <p className="notice">The administrator has relaxed annotation re-authentication for the {label(authority.principal.role)} role. This exception and policy version will be recorded with the annotation.</p>
            ) : enterpriseMfaActive ? (
              <p className="notice success">Your recent Workspace MFA will authenticate this signing action.</p>
            ) : (
              <div className="field">
                <label>Re-confirm password</label>
                <input name="signaturePassword" type="password" autoComplete="current-password" required />
                <small className="muted">Strong re-authentication is required before the signed version is created.</small>
              </div>
            )}
            <label className="check-field">
              <input type="checkbox" name="confirmSignature" value="CONFIRM" required />
              <span>I confirm this minute is mine and authorize ITF Flow to apply my authenticated name, role and timestamp to the new PDF version.</span>
            </label>
            <button className="btn" type="submit">Create signed PDF version</button>
          </form>
        </section>
      </div>
    </>
  );
}
