"use client";

import { useActionState } from "react";
import { generateMemoOutputAction, type MemoOutputState } from "@/app/memo-output-actions";

const initialState: MemoOutputState = { status: "idle", message: "", attempt: 0 };

export function GenerateMemoOutputForm({ correspondenceId, hasApprovedOriginatorSignature }: { correspondenceId: string; hasApprovedOriginatorSignature: boolean }) {
  const [state, action, pending] = useActionState(generateMemoOutputAction, initialState);
  return <>
    {!hasApprovedOriginatorSignature ? <p className="notice">The originator needs an approved signature profile before the governed output can be generated.</p> : null}
    {state.status === "error" ? <p className="notice error" role="alert">{state.message}</p> : null}
    {state.status === "success" ? <p className="notice success">{state.message} {state.outputId ? <a href={`/memo-outputs/${state.outputId}`}>Download output</a> : null}</p> : null}
    <form action={action}><input type="hidden" name="correspondenceId" value={correspondenceId} /><button className="btn" type="submit" disabled={pending || !hasApprovedOriginatorSignature}>{pending ? "Generating…" : "Generate ITF memo output"}</button></form>
  </>;
}
