"use client";

import { useRef, useState, useTransition } from "react";
import { autosaveDraftAction, registerCorrespondenceAction, saveDraftAction } from "@/app/actions";
import { DirectoryPerson, RecipientSelector } from "@/components/recipient-selector";
import { categoriesForDocumentType, routingPurposeHelp, type WorkflowCategoryOption } from "@/lib/correspondence-form";
import { RichTextEditor } from "@/components/rich-text-editor";
import { SingleStaffPicker } from "@/components/single-staff-picker";

type InitialDraft = {
  id: string;
  type: string;
  senderName: string;
  subject: string;
  senderReference: string;
  dueAt: string;
  classification: string;
  priority: string;
  summary: string;
  body: string;
  instruction: string;
  workPurpose: string;
  actionRecipients: DirectoryPerson[];
  copyRecipients: DirectoryPerson[];
  ultimateRecipient?: DirectoryPerson | null;
  ultimateRecipientName?: string;
  recordCategory?: string;
  recordSubject?: DirectoryPerson | null;
  filePlanCode?: string;
  retentionClass?: string;
  ownerOrgUnitName?: string;
};

export function CorrespondenceComposer({
  userName,
  isRegistrar,
  canReferToPeers,
  defaultOrgUnitName,
  initial,
  categories = [],
}: {
  userName: string;
  isRegistrar: boolean;
  canReferToPeers: boolean;
  defaultOrgUnitName: string;
  initial?: InitialDraft;
  categories?: WorkflowCategoryOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [documentType, setDocumentType] = useState(initial?.type ?? (isRegistrar ? "INCOMING_LETTER" : "INTERNAL_MEMO"));
  const [categoryCode, setCategoryCode] = useState("");
  const [routingPurpose, setRoutingPurpose] = useState(initial?.workPurpose ?? "ACTION");
  const [recordCategory, setRecordCategory] = useState(initial?.recordCategory ?? "OFFICE");
  const compatibleCategories = categoriesForDocumentType(categories, documentType);

  function autosave() {
    if (!initial?.id || !dirty || !formRef.current || saving) return;
    const data = new FormData(formRef.current);
    startSaving(async () => {
      const result = await autosaveDraftAction(data);
      if (result.saved) {
        setDirty(false);
        setSavedAt(result.savedAt);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={registerCorrespondenceAction}
      className="card form-grid"
      onChange={() => setDirty(true)}
      onBlur={autosave}
    >
      {initial ? <input type="hidden" name="draftId" value={initial.id} /> : null}
      <div className="field"><label>Document type</label><select name="type" value={documentType} onChange={(event) => { setDocumentType(event.target.value); setCategoryCode(""); }}>
        {isRegistrar ? <option value="INCOMING_LETTER">Incoming letter</option> : null}<option value="INTERNAL_MEMO">Internal memo</option><option value="OUTGOING_LETTER">Outgoing letter</option>
      </select><small className="muted">{documentType === "INCOMING_LETTER" ? "Received from outside ITF and registered by authorized Secretariat/Records staff." : documentType === "OUTGOING_LETTER" ? "An official letter intended for an external recipient and completed through dispatch." : "An official memorandum moving within ITF."} {!isRegistrar ? "Incoming letters are registered through the Secretariat intake process." : ""}</small></div>
      <div className="field"><label>Workflow category</label><select name="categoryCode" value={categoryCode} onChange={(event) => setCategoryCode(event.target.value)}><option value="">Automatic default</option>{compatibleCategories.map((category) => <option key={category.code} value={category.code}>{category.name} (SLA {category.routineSlaDays}/{category.urgentSlaDays}/{category.immediateSlaDays} days)</option>)}</select><small className="muted">Selects the business policy, permitted purposes and priority-based response target. Only categories compatible with the document type are shown.</small></div>
      <div className="field"><label>Sender *</label><input name="senderName" defaultValue={initial?.senderName ?? userName} placeholder="Name of the originating officer or external sender" required /></div>
      <div className="field span-2"><label>Subject *</label><input name="subject" defaultValue={initial?.subject} placeholder="Briefly state what the correspondence is about" required minLength={5} /></div>
      <div className="field"><label>Sender reference</label><input name="senderReference" defaultValue={initial?.senderReference} placeholder="e.g. ITF/ICT/PASS/2026/014" /></div>
      <div className="field"><label>Due date</label><input name="dueAt" defaultValue={initial?.dueAt} type="date" aria-label="Required response or action date" /></div>
      <div className="field"><label>Classification</label><select name="classification" defaultValue={initial?.classification ?? "INTERNAL"}><option>PUBLIC</option><option>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={initial?.priority ?? "ROUTINE"}><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
      <div className="field span-2"><h2 style={{ marginBottom: 0 }}>Intended endpoint and official filing</h2><small className="muted">The ultimate recipient remains constant while action ownership moves through intermediate desks. Filing identifies the official record owner; it does not grant access by Blob path.</small></div>
      {documentType === "INTERNAL_MEMO" ? <div className="field span-2"><SingleStaffPicker fieldName="ultimateRecipientUserId" label="Ultimate recipient" hint="Select the staff member for whom the correspondence is finally intended, even when it must first pass through reviewers or approving officers." required initial={initial?.ultimateRecipient} onSelectionChange={() => setDirty(true)} /></div> : <div className="field span-2"><label>{documentType === "INCOMING_LETTER" ? "Ultimate destination office *" : "Ultimate external recipient *"}</label><input name="ultimateRecipientName" defaultValue={initial?.ultimateRecipientName ?? (documentType === "INCOMING_LETTER" ? "Director-General's Office" : "")} required minLength={2} placeholder={documentType === "INCOMING_LETTER" ? "Destination office or organizational unit" : "Person or external organization"} /></div>}
      <div className="field"><label>Official record category</label><select name="recordCategory" value={recordCategory} onChange={(event) => { setRecordCategory(event.target.value); setDirty(true); }}><option value="OFFICE">Office / departmental record</option><option value="PERSONNEL">Personnel record</option><option value="CORPORATE">Corporate record</option><option value="EXTERNAL_CASE">External case file</option></select></div>
      <div className="field"><label>File-plan code *</label><input name="filePlanCode" defaultValue={initial?.filePlanCode ?? "GENERAL-CORRESPONDENCE"} required pattern="[A-Za-z0-9._/-]{3,80}" placeholder="e.g. HR/PERSONNEL/QUERY" /><small className="muted">Use an approved functional classification code, not a Blob folder name.</small></div>
      <div className="field"><label>Retention class *</label><input name="retentionClass" defaultValue={initial?.retentionClass ?? "GENERAL-7Y"} required pattern="[A-Za-z0-9._/-]{3,80}" placeholder="e.g. PERSONNEL-EMPLOYMENT" /></div>
      {recordCategory === "PERSONNEL" ? <div className="field span-2"><SingleStaffPicker fieldName="recordSubjectUserId" label="Personnel-file subject" hint="The official personnel file belongs to this staff member. The creator and ultimate recipient may be different people." required initial={initial?.recordSubject} onSelectionChange={() => setDirty(true)} /></div> : null}
      {recordCategory !== "PERSONNEL" ? <div className="field"><label>Owning office/unit *</label><input name="ownerOrgUnitName" defaultValue={initial?.ownerOrgUnitName ?? defaultOrgUnitName} required minLength={2} placeholder="Department, division, unit or corporate registry" /></div> : null}
      <div className="field span-2"><label>Summary *</label><textarea name="summary" defaultValue={initial?.summary} placeholder="Summarize the request, decision required, and important context" required minLength={10} /></div>
      <div className="field span-2"><label>Compose memo / transcribe letter</label><RichTextEditor initialHtml={initial?.body} onDirty={() => setDirty(true)} /></div>
      <div className="field span-2"><RecipientSelector
        initialActionRecipients={initial?.actionRecipients}
        initialCopyRecipients={initial?.copyRecipients}
        onSelectionChange={() => setDirty(true)}
        actionHint={isRegistrar
          ? "Incoming letters go to the DG automatically. For internal correspondence, choose an authorized recipient."
          : canReferToPeers
            ? "Choose your supervisor, a direct report, or an authorized peer. Peer referrals require a clear routing purpose."
            : "Select your assigned supervisor or one or more direct reports responsible for taking action."}
      /></div>
      <div className="field"><label>Routing purpose</label><select name="workPurpose" value={routingPurpose} onChange={(event) => setRoutingPurpose(event.target.value)}>
        <option value="ACTION">Action / treatment</option><option value="REVIEW">Review and recommendation</option><option value="CONCURRENCE">Concurrence</option><option value="APPROVAL">Formal approval</option>
      </select><small className="muted">{routingPurposeHelp[routingPurpose]}</small></div>
      <div className="field span-2"><label>Routing minute / referral purpose</label><textarea name="instruction" defaultValue={initial?.instruction} placeholder="State the action required, referral purpose, expected outcome, and deadline…" /><small className="muted">For a sequential path A → B → C → Z, A selects only B as the action recipient. Each accountable holder minutes it to the next person. Select D as a copy recipient only when D is being informed, not asked to act.</small></div>
      <div className="field span-2"><label>Supporting document</label><input name="attachment" type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" /><small className="muted">PDF and images are normalized into the memo packet. DOCX/XLSX are converted when the governed converter is enabled.</small></div>
      <div className="actions span-2">
        <button className="btn secondary" type="submit" formAction={saveDraftAction} formNoValidate>Save draft</button>
        <button className="btn" type="submit">Submit through reporting line</button>
        {initial ? <span className="muted" aria-live="polite">{saving ? "Saving…" : savedAt ? `Autosaved ${new Date(savedAt).toLocaleTimeString("en-NG")}` : dirty ? "Unsaved changes" : "Draft saved"}</span> : null}
      </div>
    </form>
  );
}
