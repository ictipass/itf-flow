import Image from "next/image";
import { submitSignatureProfileAction } from "@/app/signature-profile-actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { label } from "@/lib/reference";

const messages: Record<string, { tone: string; text: string }> = {
  submitted: { tone: "success", text: "Signature profile submitted for administrator review." },
  "missing-file": { tone: "error", text: "Select a PNG signature image before submitting." },
  attestation: { tone: "error", text: "Confirm that the signature is yours and authorize its governed use." },
  "invalid-image": { tone: "error", text: "Use a valid PNG up to 1 MB and within the permitted dimensions." },
};

export default async function SignatureProfilePage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const profiles = await db.signatureProfile.findMany({
    where: { userId: user.id },
    include: { reviewedBy: true },
    orderBy: { version: "desc" },
  });
  const current = profiles[0];
  const message = query.result ? messages[query.result] : undefined;
  return <>
    <span className="eyebrow">Personal profile</span>
    <h1>Signature profile</h1>
    <p className="muted">Submit your own transparent PNG signature for governed use on generated ITF memo outputs. It cannot be used until a system administrator approves it.</p>
    {message ? <p className={`notice ${message.tone}`}>{message.text}</p> : null}
    <div className="form-grid" style={{ marginTop: 18 }}>
      <section className="card">
        <h2>Submit a signature</h2>
        <form action={submitSignatureProfileAction} className="grid">
          <div className="field"><label>Signature image</label><input name="signatureImage" type="file" accept="image/png,.png" required /><small className="muted">PNG only, maximum 1 MB and 3000×1500 pixels. Crop excess whitespace; a transparent background is preferred.</small></div>
          <label className="check-field"><input type="checkbox" name="confirmOwnership" value="CONFIRM" required /><span>I confirm this is my signature and authorize its governed use on ITF outputs.</span></label>
          <button className="btn" type="submit">Submit for review</button>
        </form>
      </section>
      <section className="card">
        <h2>Current status</h2>
        {current ? <>
          <Image className="signature-profile-preview" src={`/signature-profiles/${current.id}/image`} alt="Your submitted signature" width={420} height={160} unoptimized />
          <p><span className="badge">{label(current.status)}</span></p>
          <p>Version {current.version} · submitted {current.submittedAt.toLocaleString("en-NG")}</p>
          <small className="muted">SHA-256 {current.sha256}</small>
          {current.reviewReason ? <p className="notice">{current.reviewReason} · {current.reviewedBy?.name ?? "Administrator"}</p> : null}
        </> : <p className="muted">No signature profile has been submitted.</p>}
      </section>
    </div>
    {profiles.length ? <section className="card" style={{ marginTop: 18 }}><h2>Profile history</h2><table className="table"><thead><tr><th>Version</th><th>Status</th><th>Submitted</th><th>Review</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td>v{profile.version}</td><td>{label(profile.status)}</td><td>{profile.submittedAt.toLocaleString("en-NG")}</td><td>{profile.reviewReason ?? "Awaiting review"}</td></tr>)}</tbody></table></section> : null}
  </>;
}
