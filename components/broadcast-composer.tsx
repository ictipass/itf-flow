"use client";

import { useState } from "react";
import { createBroadcastAction } from "@/app/broadcast-actions";

type Option = { value: string; label: string };
type AudienceRow = { id: number; scopeType: string; scopeValue: string };
type InitialBroadcast = { id: string; title: string; message: string; category: string; priority: string; publishAt: string; expiresAt: string; mandatoryAcknowledgement: boolean; audiences: Array<{ scopeType: string; scopeValue: string }> };

export function BroadcastComposer({ options, categories, canRequireAcknowledgement, initial }: {
  options: Record<string, Option[]>;
  categories: string[];
  canRequireAcknowledgement: boolean;
  initial?: InitialBroadcast;
}) {
  const scopeOptions = Object.keys(options);
  const [rows, setRows] = useState<AudienceRow[]>(initial?.audiences.length ? initial.audiences.map((audience, index) => ({ id: index + 1, ...audience })) : [{ id: 1, scopeType: scopeOptions[0] ?? "ORGANIZATION", scopeValue: "" }]);
  function update(id: number, patch: Partial<AudienceRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }
  return (
    <form action={createBroadcastAction} className="card form-grid">
      {initial ? <input type="hidden" name="broadcastId" value={initial.id} /> : null}
      <div className="field span-2"><label>Broadcast title</label><input name="title" minLength={5} maxLength={180} required defaultValue={initial?.title} placeholder="e.g. Revised staff resumption arrangements" /></div>
      <div className="field"><label>Category</label><select name="category" required defaultValue={initial?.category}>{categories.map((category) => <option value={category} key={category}>{category.toLowerCase().replaceAll("_", " ")}</option>)}</select></div>
      <div className="field"><label>Priority</label><select name="priority" defaultValue={initial?.priority ?? "ROUTINE"}><option value="ROUTINE">Routine</option><option value="IMPORTANT">Important</option><option value="URGENT">Urgent</option></select></div>
      <div className="field span-2"><label>Message</label><textarea name="message" minLength={10} maxLength={20000} required defaultValue={initial?.message} style={{ minHeight: 220 }} placeholder="Write the complete announcement, required action, effective date, and contact point…" /></div>
      <div className="field span-2">
        <label>Audience</label>
        <p className="recipient-picker-hint">Recipients are resolved and permanently snapshotted when the broadcast is published.</p>
        <div className="audience-builder">
          {rows.map((row) => {
            const values = options[row.scopeType] ?? [];
            const selected = values.find((option) => option.value === row.scopeValue);
            return <div className="audience-row" key={row.id}>
              <select name="audienceScopeTypes" value={row.scopeType} onChange={(event) => update(row.id, { scopeType: event.target.value, scopeValue: "" })}>{scopeOptions.map((scope) => <option value={scope} key={scope}>{scope.toLowerCase().replaceAll("_", " ")}</option>)}</select>
              {row.scopeType === "ORGANIZATION" ? <div className="audience-fixed">All active staff</div> : <select name="audienceScopeValues" required value={row.scopeValue} onChange={(event) => update(row.id, { scopeValue: event.target.value })}><option value="">Select audience…</option>{values.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>}
              {row.scopeType === "ORGANIZATION" ? <input type="hidden" name="audienceScopeValues" value="" /> : null}
              <input type="hidden" name="audienceLabels" value={row.scopeType === "ORGANIZATION" ? "Entire organization" : selected?.label ?? row.scopeValue} />
              <button className="audience-remove" type="button" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button>
            </div>;
          })}
          <button className="btn secondary compact" type="button" onClick={() => setRows((current) => [...current, { id: Math.max(...current.map((row) => row.id)) + 1, scopeType: scopeOptions[0], scopeValue: "" }])}>Add another audience</button>
        </div>
      </div>
      <div className="field"><label>Publish date and time</label><input type="datetime-local" name="publishAt" defaultValue={initial?.publishAt} /></div>
      <div className="field"><label>Expiry date and time</label><input type="datetime-local" name="expiresAt" defaultValue={initial?.expiresAt} /></div>
      <label className="check-field span-2"><input type="checkbox" name="mandatoryAcknowledgement" defaultChecked={initial?.mandatoryAcknowledgement} disabled={!canRequireAcknowledgement} /><span><strong>Require acknowledgement</strong><small>{canRequireAcknowledgement ? "Recipients must explicitly confirm receipt." : "Your publishing grant does not permit mandatory acknowledgement."}</small></span></label>
      <div className="actions span-2" style={{ marginTop: 0 }}><button className="btn secondary" type="submit" name="intent" value="draft">Save draft</button><button className="btn" type="submit" name="intent" value="publish">Publish broadcast</button></div>
    </form>
  );
}
