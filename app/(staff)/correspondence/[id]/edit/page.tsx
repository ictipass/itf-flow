import { notFound, redirect } from "next/navigation";
import { CorrespondenceComposer } from "@/components/correspondence-composer";
import { CorrespondenceStatus, UserRole } from "@/lib/generated/prisma/client";
import { canRegister } from "@/lib/permissions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const personSelect = { id: true, name: true, email: true, staffNumber: true, department: true, division: true, unit: true, office: true, position: true, role: true } as const;

export default async function EditDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const draft = await db.correspondence.findFirst({ where: { id, createdById: user.id } });
  if (!draft) notFound();
  if (draft.status !== CorrespondenceStatus.DRAFT) redirect(`/correspondence/${draft.id}`);
  const [actionRecipients, copyRecipients, categories] = await Promise.all([
    db.user.findMany({ where: { id: { in: draft.draftActionRecipientIds }, isActive: true }, select: personSelect }),
    db.user.findMany({ where: { id: { in: draft.draftCopyRecipientIds }, isActive: true }, select: personSelect }),
    db.workflowCategory.findMany({ where: { isActive: true }, select: { code: true, name: true, correspondenceType: true, routineSlaDays: true, urgentSlaDays: true, immediateSlaDays: true }, orderBy: { code: "asc" } }),
  ]);
  return <>
    <span className="eyebrow">Private working copy</span><h1>Edit draft</h1>
    <p className="muted">Only you can see this draft. Changes autosave when you leave a field.</p>
    <CorrespondenceComposer userName={user.name} isRegistrar={canRegister(user.role)} canReferToPeers={user.role === UserRole.DIRECTOR || user.role === UserRole.DIVISION_HEAD} categories={categories} initial={{
      id: draft.id, type: draft.type, senderName: draft.senderName, subject: draft.subject,
      senderReference: draft.senderReference ?? "", dueAt: draft.dueAt?.toISOString().slice(0, 10) ?? "",
      classification: draft.classification, priority: draft.priority, summary: draft.summary,
      body: draft.body ?? "", instruction: draft.draftInstruction ?? "", workPurpose: draft.draftWorkPurpose, actionRecipients, copyRecipients,
    }} />
  </>;
}
