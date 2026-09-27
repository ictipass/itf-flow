"use client";

import { useActionState, useState } from "react";
import { routeCorrespondenceAction, type RouteCorrespondenceState } from "@/app/actions";
import { RecipientSelector } from "@/components/recipient-selector";
import { label } from "@/lib/reference";

const initialState: RouteCorrespondenceState = { status: "idle", message: "", attempt: 0 };

export function RouteCorrespondenceForm({
  correspondenceId,
  currentClassification,
  authorityRole,
  canReferToPeers,
}: {
  correspondenceId: string;
  currentClassification: string;
  authorityRole: string;
  canReferToPeers: boolean;
}) {
  const [state, formAction, pending] = useActionState(routeCorrespondenceAction, initialState);
  const [classification, setClassification] = useState(currentClassification);
  const [dismissedAttempt, setDismissedAttempt] = useState(0);
  const restricted = classification === "CONFIDENTIAL" || classification === "SECRET";
  const canChangeClassification = authorityRole === "DG" || authorityRole === "DIRECTOR";

  return <>
    {state.status === "error" && dismissedAttempt !== state.attempt ? <div className="route-error-toast" role="alert" aria-live="assertive">
      <div><strong>Routing was not completed</strong><span>{state.message}</span></div>
      <button type="button" onClick={() => setDismissedAttempt(state.attempt)} aria-label="Dismiss routing error">×</button>
    </div> : null}
    <form action={formAction} className="grid">
      <input type="hidden" name="correspondenceId" value={correspondenceId} />
      <div className="field"><label>Routing purpose</label><select name="workPurpose" defaultValue="ACTION"><option value="ACTION">Action / treatment</option><option value="REVIEW">Review and recommendation</option><option value="CONCURRENCE">Concurrence</option><option value="APPROVAL">Formal approval</option></select></div>
      {canChangeClassification ? <>
        <div className="field"><label>Distribution classification</label><select name="routeClassification" value={classification} onChange={(event) => setClassification(event.target.value)}><option value={currentClassification}>Keep {label(currentClassification)}</option>{currentClassification === "PUBLIC" || currentClassification === "INTERNAL" ? <option value="CONFIDENTIAL">Mark Confidential</option> : null}</select><small className="muted">Public/Internal routing automatically copies the recipient department Secretary. Confidential/Secret routing creates no copies; the DG must send it to a Director.</small></div>
        <div className="field"><label>Classification reason, when changing</label><textarea name="classificationReason" maxLength={500} placeholder="Give a reason of at least 10 characters when changing classification…" /></div>
      </> : null}
      <div className="field"><label>Minute / instruction</label><textarea name="minute" required minLength={3} placeholder="State the action required, expected outcome, and any deadline…" /></div>
      <div className="field">
        <RecipientSelector
          actionHint={canReferToPeers ? "Select your supervisor, direct reports, or an authorized peer. Division Head peers are limited to your department." : "Select your assigned supervisor or one or more direct reports."}
          copyDisabled={restricted}
        />
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Routing…" : "Record minute and route"}</button>
    </form>
  </>;
}
