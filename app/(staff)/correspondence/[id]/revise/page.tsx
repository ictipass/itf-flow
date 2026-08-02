import { notFound } from "next/navigation";
import { reviseReturnedCorrespondenceAction } from "@/app/actions";
import { CorrespondenceStatus, RecipientKind, WorkItemStatus } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function ReviseCorrespondencePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const record = await db.correspondence.findFirst({
    where: {
      id,
      createdById: user.id,
      status: CorrespondenceStatus.RETURNED,
      workItems: { some: { assigneeId: user.id, kind: RecipientKind.ACTION, status: { in: [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED] } } },
    },
  });
  if (!record) notFound();
  return <>
    <span className="eyebrow">Controlled correction</span><h1>Revise returned correspondence</h1>
    <p className="muted">Saving creates an immutable new version. You can review it before resubmitting.</p>
    <form action={reviseReturnedCorrespondenceAction} className="card form-grid">
      <input type="hidden" name="correspondenceId" value={record.id} /><input type="hidden" name="type" value={record.type} /><input type="hidden" name="senderName" value={record.senderName} />
      <div className="field span-2"><label>Subject</label><input name="subject" defaultValue={record.subject} minLength={5} required placeholder="Briefly state what the correspondence is about" /></div>
      <div className="field"><label>Classification</label><select name="classification" defaultValue={record.classification}><option>PUBLIC</option><option>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={record.priority}><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
      <div className="field"><label>Sender reference</label><input name="senderReference" defaultValue={record.senderReference ?? ""} placeholder="e.g. ITF/ICT/PASS/2026/014" /></div>
      <div className="field"><label>Due date</label><input name="dueAt" type="date" defaultValue={record.dueAt?.toISOString().slice(0, 10) ?? ""} /></div>
      <div className="field span-2"><label>Summary</label><textarea name="summary" defaultValue={record.summary} minLength={10} required placeholder="Summarize the corrected request and important context" /></div>
      <div className="field span-2"><label>Correspondence body</label><textarea name="body" defaultValue={record.body ?? ""} style={{ minHeight: 220 }} placeholder="Enter the corrected correspondence content" /></div>
      <div className="field span-2"><label>Correction note</label><textarea name="changeNote" minLength={5} required placeholder="Explain exactly what changed and why" /></div>
      <div className="field span-2"><label>Add supporting attachment</label><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></div>
      <button className="btn span-2" type="submit">Create corrected version</button>
    </form>
  </>;
}
