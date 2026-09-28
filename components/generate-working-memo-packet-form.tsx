"use client";

import { useActionState } from "react";
import { generateWorkingMemoPacketAction, type WorkingMemoPacketState } from "@/app/memo-output-actions";

const initialState: WorkingMemoPacketState = { status: "idle", message: "", attempt: 0 };

export function GenerateWorkingMemoPacketForm({ correspondenceId }: { correspondenceId: string }) {
  const [state, action, pending] = useActionState(generateWorkingMemoPacketAction, initialState);
  return <div className="grid" style={{ marginTop: 12 }}>
    <p className="notice">This memo predates automatic working-packet generation. Create its ITF template PDF to make it available in the in-app annotation workspace.</p>
    {state.status === "error" ? <p className="notice error" role="alert">{state.message}</p> : null}
    {state.status === "success" ? <p className="notice success">{state.message}</p> : null}
    <form action={action}><input type="hidden" name="correspondenceId" value={correspondenceId} /><button className="btn" disabled={pending}>{pending ? "Creating…" : "Create ITF memo packet"}</button></form>
  </div>;
}
