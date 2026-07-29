import { registerCorrespondenceAction } from "@/app/actions";
import { canRegister } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function NewCorrespondencePage() {
  const user = await requireUser();
  if (!canRegister(user.role)) return <div className="notice">Only the DG Secretariat or Registry can register incoming correspondence.</div>;
  return (
    <>
      <span className="eyebrow">DG Secretariat intake</span><h1>Register correspondence</h1>
      <p className="muted">The registered item will be sent directly to the DG’s inbox.</p>
      <form action={registerCorrespondenceAction} className="card form-grid">
        <div className="field"><label>Document type</label><select name="type"><option value="INCOMING_LETTER">Incoming letter</option><option value="INTERNAL_MEMO">Internal memo</option><option value="OUTGOING_LETTER">Outgoing letter</option></select></div>
        <div className="field"><label>Sender *</label><input name="senderName" required /></div>
        <div className="field span-2"><label>Subject *</label><input name="subject" required minLength={5} /></div>
        <div className="field"><label>Sender reference</label><input name="senderReference" /></div>
        <div className="field"><label>Due date</label><input name="dueAt" type="date" /></div>
        <div className="field"><label>Classification</label><select name="classification"><option>PUBLIC</option><option selected>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
        <div className="field"><label>Priority</label><select name="priority"><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
        <div className="field span-2"><label>Summary *</label><textarea name="summary" required minLength={10} /></div>
        <div className="field span-2"><label>Compose memo / transcribe letter</label><textarea name="body" style={{ minHeight: 180 }} /></div>
        <div className="field span-2"><label>Scanned document</label><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></div>
        <button className="btn span-2" type="submit">Register and send to DG</button>
      </form>
    </>
  );
}
