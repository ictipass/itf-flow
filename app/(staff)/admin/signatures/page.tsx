import Image from "next/image";
import { redirect } from "next/navigation";
import { reviewSignatureProfileAction, revokeSignatureProfileAction } from "@/app/signature-profile-actions";
import { SignatureProfileStatus, UserRole } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

export default async function SignatureAdministrationPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const user = await requireUser();
  if (user.role !== UserRole.SYSTEM_ADMIN) redirect("/dashboard");
  const query = await searchParams;
  const profiles = await db.signatureProfile.findMany({
    include: { user: true, reviewedBy: true },
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    take: 200,
  });
  return <>
    <span className="eyebrow">Document governance</span>
    <h1>Signature profile approvals</h1>
    <p className="muted">Approve only a staff member’s verified signature. Approval permits the visual mark on future generated memo outputs; it does not create a certificate-backed electronic signature.</p>
    {query.result === "updated" ? <p className="notice success">Signature review recorded.</p> : null}
    {query.result === "revoked" ? <p className="notice success">Signature approval revoked for future outputs.</p> : null}
    {query.result === "validation" ? <p className="notice error">Give a review reason of at least 10 characters.</p> : null}
    {query.result === "stale" ? <p className="notice error">This profile changed before the action completed. Review its current status.</p> : null}
    <div className="grid signature-review-grid" style={{ marginTop: 18 }}>
      {profiles.map((profile) => <section className="card" key={profile.id}>
        <div className="section-heading"><div><strong>{profile.user.name}</strong><small className="registry-secondary">{profile.user.staffNumber ?? profile.user.email} · v{profile.version}</small></div><span className="badge">{label(profile.status)}</span></div>
        <Image className="signature-profile-preview" src={`/signature-profiles/${profile.id}/image`} alt={`Signature submitted by ${profile.user.name}`} width={420} height={160} unoptimized />
        <small className="muted">Submitted {profile.submittedAt.toLocaleString("en-NG")} · SHA-256 {profile.sha256.slice(0, 16)}…</small>
        {profile.status === SignatureProfileStatus.PENDING_REVIEW ? <form action={reviewSignatureProfileAction} className="grid" style={{ marginTop: 14 }}>
          <input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="version" value={profile.version} />
          <div className="field"><label>Review reason</label><textarea name="reason" minLength={10} maxLength={500} required placeholder="Record identity verification and approving or rejection reason…" /></div>
          <div className="actions"><button className="btn" name="decision" value="APPROVE">Approve</button><button className="btn secondary" name="decision" value="REJECT">Reject</button></div>
        </form> : null}
        {profile.status === SignatureProfileStatus.APPROVED ? <form action={revokeSignatureProfileAction} className="grid" style={{ marginTop: 14 }}>
          <input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="version" value={profile.version} />
          <div className="field"><label>Revocation reason</label><input name="reason" minLength={10} maxLength={500} required placeholder="Reason approval must no longer be used" /></div>
          <button className="btn secondary">Revoke for future outputs</button>
        </form> : null}
        {profile.reviewReason ? <p className="notice">{profile.reviewReason} · {profile.reviewedBy?.name ?? "Administrator"}</p> : null}
      </section>)}
      {!profiles.length ? <section className="card muted">No signature profiles have been submitted.</section> : null}
    </div>
  </>;
}
