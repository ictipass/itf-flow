"use client";

import { useActionState } from "react";
import { prepareDispatchAction, type PrepareDispatchState } from "@/app/actions";

export function FinalizeOutgoingLetterForm({ correspondenceId, recipientName, recipientEmail, recipientAddress }: { correspondenceId: string; recipientName: string; recipientEmail: string; recipientAddress: string }) {
  const initial: PrepareDispatchState = { status: "idle", message: "", attempt: 0 };
  const [state, action, pending] = useActionState(prepareDispatchAction, initial);
  return <form action={action} className="form-grid">
    <input type="hidden" name="correspondenceId" value={correspondenceId} />
    <div className="field"><label>External recipient</label><input value={recipientName} readOnly /></div>
    <div className="field"><label>Governed email</label><input value={recipientEmail} readOnly /></div>
    <div className="field span-2"><label>Delivery address printed on letter</label><textarea value={recipientAddress} readOnly /></div>
    <div className="field span-2"><label>Final dispatch note</label><textarea name="dispatchNote" placeholder="Optional final handling or delivery note" /></div>
    <button className="btn span-2" type="submit" disabled={pending}>{pending ? "Finalizing and queuing…" : "Finalize, sign and queue official email"}</button>
    {state.status === "error" ? <div className="notice error span-2" role="alert">{state.message}</div> : null}
  </form>;
}
