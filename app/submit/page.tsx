import Link from "next/link";
import Image from "next/image";
import { externalSubmitAction } from "@/app/actions";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="content" style={{ maxWidth: 900 }}>
      <Link href="/" className="public-brand">
        <Image src="/itf-logo.png" alt="Industrial Training Fund logo" width={40} height={40} priority />
        <span>ITF Flow</span>
      </Link>
      <div style={{ margin: "28px 0" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: 8 }}>Submit correspondence to ITF</h1>
        <p className="muted">For organizations and external stakeholders. Required fields are marked.</p>
      </div>
      {error ? <p className="notice">Please review the required details and submit again.</p> : null}
      <form action={externalSubmitAction} className="card form-grid">
        <div className="field"><label>Organization name *</label><input name="organizationName" placeholder="e.g. Acme Manufacturing Limited" required /></div>
        <div className="field"><label>Contact person *</label><input name="contactName" placeholder="Full name of the contact person" required /></div>
        <div className="field"><label>Email *</label><input name="email" type="email" placeholder="contact@organization.com" required /></div>
        <div className="field"><label>Phone</label><input name="phone" placeholder="e.g. +234 801 234 5678" /></div>
        <div className="field span-2"><label>Address</label><input name="address" placeholder="Organization’s postal or office address" /></div>
        <div className="field span-2"><label>Subject *</label><input name="subject" placeholder="Briefly state the purpose of your letter" minLength={5} required /></div>
        <div className="field"><label>Your reference</label><input name="senderReference" placeholder="Your organization’s document reference" /></div>
        <div className="field"><label>Requested response date</label><input name="dueAt" type="date" /></div>
        <div className="field"><label>Classification</label><select name="classification" defaultValue="PUBLIC"><option>PUBLIC</option><option>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
        <div className="field"><label>Priority</label><select name="priority" defaultValue="ROUTINE"><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
        <div className="field span-2"><label>Summary *</label><textarea name="summary" placeholder="Summarize your request and the response or action expected from ITF" minLength={10} required /></div>
        <div className="field span-2"><label>Letter or memo text</label><textarea name="body" placeholder="Enter the complete letter or memo text, if it is not only in the attachment" style={{ minHeight: 180 }} /></div>
        <div className="field span-2"><label>Scanned letter (PDF, JPEG or PNG; 10 MB maximum)</label><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></div>
        <button className="btn span-2" type="submit">Submit to ITF</button>
      </form>
    </main>
  );
}
