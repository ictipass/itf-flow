"use client";

import { useRef, useState, useTransition } from "react";
import { autosaveDraftAction, registerCorrespondenceAction, saveDraftAction } from "@/app/actions";
import { DirectoryPerson, RecipientSelector } from "@/components/recipient-selector";

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
  actionRecipients: DirectoryPerson[];
  copyRecipients: DirectoryPerson[];
};

export function CorrespondenceComposer({
  userName,
  isRegistrar,
  canReferToPeers,
  initial,
}: {
  userName: string;
  isRegistrar: boolean;
  canReferToPeers: boolean;
  initial?: InitialDraft;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

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
      <div className="field"><label>Document type</label><select name="type" defaultValue={initial?.type ?? (isRegistrar ? "INCOMING_LETTER" : "INTERNAL_MEMO")}>
        {isRegistrar ? <option value="INCOMING_LETTER">Incoming letter</option> : null}<option value="INTERNAL_MEMO">Internal memo</option><option value="OUTGOING_LETTER">Outgoing letter</option>
      </select></div>
      <div className="field"><label>Sender *</label><input name="senderName" defaultValue={initial?.senderName ?? userName} placeholder="Name of the originating officer or external sender" required /></div>
      <div className="field span-2"><label>Subject *</label><input name="subject" defaultValue={initial?.subject} placeholder="Briefly state what the correspondence is about" required minLength={5} /></div>
      <div className="field"><label>Sender reference</label><input name="senderReference" defaultValue={initial?.senderReference} placeholder="e.g. ITF/ICT/PASS/2026/014" /></div>
      <div className="field"><label>Due date</label><input name="dueAt" defaultValue={initial?.dueAt} type="date" aria-label="Required response or action date" /></div>
      <div className="field"><label>Classification</label><select name="classification" defaultValue={initial?.classification ?? "INTERNAL"}><option>PUBLIC</option><option>INTERNAL</option><option>CONFIDENTIAL</option><option>SECRET</option></select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={initial?.priority ?? "ROUTINE"}><option>ROUTINE</option><option>URGENT</option><option>IMMEDIATE</option></select></div>
      <div className="field span-2"><label>Summary *</label><textarea name="summary" defaultValue={initial?.summary} placeholder="Summarize the request, decision required, and important context" required minLength={10} /></div>
      <div className="field span-2"><label>Compose memo / transcribe letter</label><textarea name="body" defaultValue={initial?.body} placeholder="Compose the full memo or transcribe the main content of the letter" style={{ minHeight: 180 }} /></div>
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
      <div className="field span-2"><label>Routing minute / referral purpose</label><textarea name="instruction" defaultValue={initial?.instruction} placeholder="State the action required, referral purpose, expected outcome, and deadline…" /></div>
      <div className="field span-2"><label>Scanned document</label><input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" /></div>
      <div className="actions span-2">
        <button className="btn secondary" type="submit" formAction={saveDraftAction} formNoValidate>Save draft</button>
        <button className="btn" type="submit">Submit through reporting line</button>
        {initial ? <span className="muted" aria-live="polite">{saving ? "Saving…" : savedAt ? `Autosaved ${new Date(savedAt).toLocaleTimeString("en-NG")}` : dirty ? "Unsaved changes" : "Draft saved"}</span> : null}
      </div>
    </form>
  );
}
