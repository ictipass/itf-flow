import Link from "next/link";
import { externalSubmitAction } from "@/app/actions";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="content" style={{ maxWidth: 900 }}>
      <Link href="/" className="eyebrow">← ITF Flow</Link>
      <div style={{ margin: "28px 0" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: 8 }}>Submit correspondence to ITF</h1>
        <p className="muted">For organizations and external stakeholders. Required fields are marked.</p>
      </div>
      {error ? <p className="notice">Please review the required details and submit again.</p> : null}
      <form action={externalSubmitAction} className="card form-grid">
        <div className="field"><label>Organization name *</label><input name="organizationName" required /></div>
        <div className="field"><label>Contact person *</label><input name="contactName" required /></div>
        <div className="field"><label>Email *</label><input name="email" type="email" required /></div>
        <div className="field"><label>Phone</label><input name="phone" /></div>
        <div className="field span-2"><label>Address</label><input name="address" /></div>
        <div className="field span-2"><label>Subject *</label><input name="subject" minLength={5} required /></div>
        <div className="field"><label>Your reference</label><input name="senderReference" /></div>
        <div className="field"><label>Requested response date</label><input name="dueAt" type="date" /></div>
        <div className="field"><label>Classification</label><select name="classification" defaultValue="PUBLIC"><option>PUBLIC</option><option>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
        <div className="field"><label>Priority</label><select name="priority" defaultValue="ROUTINE"><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
        <div className="field span-2"><label>Summary *</label><textarea name="summary" minLength={10} required /></div>
        <div className="field span-2"><label>Letter or memo text</label><textarea name="body" style={{ minHeight: 180 }} /></div>
        <div className="field span-2"><label>Scanned letter (PDF, JPEG or PNG; 10 MB maximum)</label><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></div>
        <button className="btn span-2" type="submit">Submit to ITF</button>
      </form>
    </main>
  );
}
