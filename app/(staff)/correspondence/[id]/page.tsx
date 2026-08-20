import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  acceptExternalSubmissionAction,
  acknowledgeAction,
  claimIntakeAction,
  prepareDispatchAction,
  releaseIntakeAction,
  recordDecisionAction,
  resubmitReturnedAction,
  resolveAction,
  returnToInitiatorAction,
  routeCorrespondenceAction,
  updateDispatchStatusAction,
} from "@/app/actions";
import { recordScanningMetadataAction, reassignSecretariatLocationAction, reviewDuplicateAction } from "@/app/secretariat-actions";
import { RecipientSelector } from "@/components/recipient-selector";
import { CorrespondencePassage } from "@/components/correspondence-passage";
import { CorrespondenceStatus, CorrespondenceType, DecisionOutcome, DispatchChannel, DispatchStatus, EventType, UserRole, WorkItemStatus, WorkPurpose } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { activeDelegationsFor } from "@/lib/delegations";
import { canDispatch, canMinute, canRegister } from "@/lib/permissions";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";
import { canAccessSensitiveRecord, logSensitiveAccess } from "@/lib/sensitive-access";
import { verifyApprovalSignature } from "@/lib/approval-signatures";

export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const record = await db.correspondence.findUnique({
    where: { id },
    include: {
      externalOrganization: true,
      createdBy: true,
      claimedBy: true,
      emailMessage: true,
      attachments: true,
      workItems: { include: { assignee: true, decisionRequest: { include: { requestedBy: true, decidedBy: true, signature: { include: { revision: true } } } } }, orderBy: { assignedAt: "desc" } },
      events: { include: { actor: true }, orderBy: { createdAt: "desc" } },
      revisions: { include: { createdBy: true }, orderBy: { version: "desc" } },
      dispatchRecords: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      decisionRequests: true,
      secretariatRecord: { include: { duplicateOf: true, updatedBy: true, events: { include: { actor: true }, orderBy: { createdAt: "desc" } } } },
      accessGroups: { include: { group: { include: { members: true } } } },
    },
  });
  if (!record) notFound();
  const delegations = await activeDelegationsFor(user.id);
  const delegationByPrincipal = new Map(delegations.map((item) => [item.principalId, item]));
  const delegatedPrincipalIds = delegations.map((item) => item.principalId);
  const dispatchEmailItems = record.dispatchRecords.length ? await db.emailOutbox.findMany({
    where: { sourceType: "OFFICIAL_EMAIL_DISPATCH", sourceId: { in: record.dispatchRecords.map((dispatch) => dispatch.id) } },
    select: { sourceId: true, status: true, attemptCount: true, lastErrorCode: true },
  }) : [];
  const dispatchEmailById = new Map(dispatchEmailItems.map((item) => [item.sourceId, item]));
  if (record.status === CorrespondenceStatus.DRAFT) {
    if (record.createdById === user.id) redirect(`/correspondence/${record.id}/edit`);
    notFound();
  }
  const broadRoles: UserRole[] = [UserRole.DG_SECRETARY, UserRole.DG, UserRole.RECORDS_ADMIN, UserRole.SYSTEM_ADMIN];
  const broadAccess = broadRoles.includes(user.role);
  const participant = record.createdById === user.id || record.workItems.some((item) => item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId));
  if (!broadAccess && !participant) notFound();
  const sensitivePolicy = await canAccessSensitiveRecord({ user, classification: record.classification, createdById: record.createdById, hasAccessGroups: record.accessGroups.length > 0, groupMemberIds: [...new Set(record.accessGroups.flatMap((item) => item.group.isActive ? item.group.members.map((member) => member.userId) : []))] });
  if (sensitivePolicy.needsStepUp) redirect(`/step-up?returnTo=${encodeURIComponent(`/correspondence/${record.id}`)}`);
  if (!sensitivePolicy.allowed) notFound();
  if (record.classification === "CONFIDENTIAL" || record.classification === "SECRET") await logSensitiveAccess({ correspondenceId: record.id, userId: user.id, type: "VIEW", detail: "Correspondence detail viewed" });
  const activeStatuses: WorkItemStatus[] = [WorkItemStatus.OPEN, WorkItemStatus.ACKNOWLEDGED];
  const activeActionItem = record.workItems.find(
    (item) =>
      (item.assigneeId === user.id || delegatedPrincipalIds.includes(item.assigneeId)) &&
      item.kind === "ACTION" &&
      activeStatuses.includes(item.status),
  );
  const activeDelegation = activeActionItem ? delegationByPrincipal.get(activeActionItem.assigneeId) : undefined;
  const authorityRole = activeDelegation?.principal.role ?? user.role;
  const pendingDecision = activeActionItem?.decisionRequest?.outcome === null ? activeActionItem.decisionRequest : null;
  const mayDecide = !pendingDecision || pendingDecision.purpose !== WorkPurpose.APPROVAL || !activeDelegation || activeDelegation.canApprove;
  const canRoute = Boolean(activeActionItem && !pendingDecision && canMinute(authorityRole));
  const canReferToPeers = authorityRole === UserRole.DIRECTOR || authorityRole === UserRole.DIVISION_HEAD;
  const canHandleIntake =
    record.status === CorrespondenceStatus.SUBMITTED &&
    canRegister(user.role) &&
    record.claimedById === user.id;
  const canReturnToInitiator = Boolean(activeActionItem && !pendingDecision && record.createdById && record.createdById !== user.id);
  const latestReturnDecision = record.events.find((event) => event.type === EventType.RETURNED || event.type === EventType.DECISION_RECORDED);
  const canResubmit = record.status === CorrespondenceStatus.RETURNED && record.createdById === user.id && latestReturnDecision?.type === EventType.RETURNED;
  const currentApproval = record.decisionRequests.some((request) => request.purpose === WorkPurpose.APPROVAL && request.outcome === DecisionOutcome.APPROVED && !request.supersededAt);
  const canPrepareDispatch = canDispatch(user.role) && record.type === CorrespondenceType.OUTGOING_LETTER && (!record.requiresApproval || currentApproval) && record.status !== CorrespondenceStatus.CLOSED;
  return (
    <>
      {record.classification === "CONFIDENTIAL" || record.classification === "SECRET" ? <div className="sensitive-watermark" aria-hidden="true">CONTROLLED COPY · {user.staffNumber ?? user.email} · {new Date().toLocaleDateString("en-NG")}</div> : null}
      <span className="eyebrow">{record.referenceNumber}</span>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
        <div><h1 style={{ maxWidth: 800 }}>{record.subject}</h1><p className="muted">From {record.senderName} · received {record.receivedAt.toLocaleString("en-NG")}</p></div>
        <div className="actions" style={{ marginTop: 0 }}><span className={`badge ${record.classification === "SECRET" ? "secret" : ""}`}>{label(record.classification)}</span><span className="badge">{label(record.status)}</span></div>
      </div>
      {record.emailMessage ? <p className="notice">Imported from email. External content and attachments are untrusted until production malware scanning is enabled.</p> : null}
      {record.accessGroups.length ? <p className="notice">Need-to-know restriction: {record.accessGroups.map((item) => item.group.name).join(", ")}.</p> : null}
      {activeDelegation ? <p className="notice">Acting authority: you are handling this item for <strong>{activeDelegation.principal.name}</strong> through the <strong>{activeDelegation.officeLabel}</strong> desk until {activeDelegation.endsAt.toLocaleString("en-NG")}.{activeDelegation.canApprove ? " Formal approval authority is enabled." : " Formal approval authority is not delegated."}</p> : null}
      {record.status === CorrespondenceStatus.SUBMITTED ? (
        <section className="handler-strip">
          <div>
            <strong>{record.claimedBy ? `Being handled by ${record.claimedBy.name}` : "Unassigned Secretariat intake"}</strong>
            <small>{record.claimedBy ? `${record.claimedBy.office} · claimed ${record.claimedAt?.toLocaleString("en-NG")}` : "A secretary must claim this correspondence before registering it."}</small>
          </div>
          {!record.claimedById && canRegister(user.role) ? (
            <form action={claimIntakeAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn compact" type="submit">Claim</button></form>
          ) : record.claimedById === user.id ? (
            <form action={releaseIntakeAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn secondary compact" type="submit">Release</button></form>
          ) : null}
        </section>
      ) : null}
      <CorrespondencePassage
        status={record.status}
        receivedAt={record.receivedAt}
        initiator={record.createdBy}
        externalSender={record.externalOrganization?.contactName ?? null}
        events={record.events}
        workItems={record.workItems}
      />
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, .7fr)", marginTop: 22 }}>
        <div className="grid">
          <section className="card">
            <h2>Correspondence</h2>
            <p style={{ lineHeight: 1.7 }}>{record.summary}</p>
            {record.body ? <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, borderTop: "1px solid #ece9e0", paddingTop: 18 }}>{record.body}</div> : null}
            {record.attachments.length ? <div style={{ marginTop: 20 }}><strong>Attachments</strong>{record.attachments.map((file) => <p key={file.id}><a className="eyebrow" href={`/attachments/${file.id}`}>{file.originalName}</a> <small className="muted">({Math.ceil(file.sizeBytes / 1024)} KB · {label(file.malwareScanStatus)})</small></p>)}</div> : null}
          </section>
          {canRegister(user.role) ? <section className="card">
            <span className="eyebrow">Records desk</span><h2>Scanning and physical file</h2>
            <form action={recordScanningMetadataAction} className="form-grid">
              <input type="hidden" name="correspondenceId" value={record.id} />
              <div className="field"><label>Scanning desk</label><input name="scanDesk" required minLength={2} defaultValue={record.secretariatRecord?.scanDesk ?? user.office} /></div>
              <div className="field"><label>Scanned at</label><input name="scannedAt" type="datetime-local" required defaultValue={(record.secretariatRecord?.scannedAt ?? record.receivedAt).toISOString().slice(0, 16)} /></div>
              <div className="field"><label>Page count</label><input name="pageCount" type="number" min="1" max="10000" required defaultValue={record.secretariatRecord?.pageCount ?? 1} /></div>
              <div className="field"><label>Current physical location</label><input name="currentLocation" required minLength={2} defaultValue={record.secretariatRecord?.currentLocation ?? "DG Secretariat - Intake Desk"} /></div>
              <div className="field"><label>Physical file reference</label><input name="physicalFileReference" defaultValue={record.secretariatRecord?.physicalFileReference ?? ""} /></div>
              <div className="field"><label>Audit reason</label><input name="reason" required minLength={5} placeholder="Initial scan registration or metadata correction" /></div>
              <div className="field span-2"><label>Handling notes</label><textarea name="notes" defaultValue={record.secretariatRecord?.notes ?? ""} /></div>
              <button className="btn span-2">{record.secretariatRecord ? "Update scanning metadata" : "Create tracking record"}</button>
            </form>
            {record.secretariatRecord ? <>
              <div className="handler-strip"><div><strong>{record.secretariatRecord.trackingCode}</strong><small>{record.secretariatRecord.currentLocation} · {record.secretariatRecord.pageCount} pages · {label(record.secretariatRecord.duplicateStatus)}</small></div><Link className="btn secondary compact" href={`/intake/labels/${record.id}`}>Print QR label</Link></div>
              <h3>Reassign physical location</h3><form action={reassignSecretariatLocationAction} className="form-grid"><input type="hidden" name="correspondenceId" value={record.id} /><div className="field"><label>New location</label><input name="location" required minLength={2} placeholder="Registry shelf, desk, room or file store" /></div><div className="field"><label>Reason</label><input name="reason" required minLength={10} /></div><button className="btn secondary span-2">Record movement</button></form>
              <h3>Duplicate review</h3>{record.secretariatRecord.duplicateOf ? <p className="notice">Potential/original match: <Link href={`/correspondence/${record.secretariatRecord.duplicateOf.id}`}><strong>{record.secretariatRecord.duplicateOf.referenceNumber}</strong></Link> · {record.secretariatRecord.duplicateOf.subject}</p> : null}
              <form action={reviewDuplicateAction} className="form-grid"><input type="hidden" name="correspondenceId" value={record.id} /><div className="field"><label>Original correspondence ID (required to confirm)</label><input name="duplicateOfCorrespondenceId" defaultValue={record.secretariatRecord.duplicateOfCorrespondenceId ?? ""} /></div><div className="field"><label>Review reason</label><input name="reason" required minLength={10} /></div><div className="actions span-2"><button className="btn secondary" name="outcome" value="CLEARED">Clear duplicate flag</button><button className="btn" name="outcome" value="CONFIRMED_DUPLICATE">Confirm duplicate</button></div></form>
            </> : null}
          </section> : null}
          {canHandleIntake ? (
            <section className="card"><h2>Secretariat intake</h2><p className="muted">Verify this external submission, register it, and place it in the DG’s inbox.</p><form action={acceptExternalSubmissionAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn" type="submit">Register and send to DG</button></form></section>
          ) : null}
          {activeActionItem?.status === WorkItemStatus.OPEN ? <section className="card"><form action={acknowledgeAction}><input type="hidden" name="correspondenceId" value={record.id} /><button className="btn secondary" type="submit">Acknowledge receipt</button></form></section> : null}
          {pendingDecision && mayDecide ? (
            <section className="card">
              <span className="eyebrow">Decision required</span><h2>{label(pendingDecision.purpose)}</h2>
              <p className="muted">Requested by {pendingDecision.requestedBy.name}. Record the formal decision before forwarding or resolving this correspondence.</p>
              <form action={recordDecisionAction} className="grid">
                <input type="hidden" name="correspondenceId" value={record.id} />
                <input type="hidden" name="decisionRequestId" value={pendingDecision.id} />
                {pendingDecision.purpose === "APPROVAL" ? <div className="field"><label>Re-confirm password to approve</label><input name="approvalPassword" type="password" autoComplete="current-password" required /><small className="muted">Approval creates an immutable signature assertion for the current document revision.</small></div> : null}
                <div className="field"><label>Decision note</label><textarea name="note" minLength={5} required placeholder="State the basis, conditions, correction required, or reason for this decision…" /></div>
                <div className="actions">
                  {pendingDecision.purpose === "REVIEW" ? <button className="btn" name="outcome" value="RECOMMENDED" type="submit">Recommend</button> : null}
                  {pendingDecision.purpose === "CONCURRENCE" ? <button className="btn" name="outcome" value="CONCURRED" type="submit">Concur</button> : null}
                  {pendingDecision.purpose === "APPROVAL" ? <button className="btn" name="outcome" value="APPROVED" type="submit">Approve</button> : null}
                  {pendingDecision.purpose !== "REVIEW" ? <button className="btn secondary" name="outcome" value="REJECTED" type="submit">Reject</button> : null}
                  <button className="btn secondary" name="outcome" value="RETURNED" type="submit">Return to requester</button>
                </div>
              </form>
            </section>
          ) : pendingDecision ? <section className="card"><div className="notice">This desk appointment does not include formal approval authority. The substantive authority holder must record this decision.</div></section> : null}
          {canRoute ? (
            <section className="card">
              <h2>Minute and route</h2>
              <p className="muted">{canReferToPeers ? "Route through the formal hierarchy or make an authorized peer referral." : "Formal reporting line: your assigned supervisor or direct reports."}</p>
              <form action={routeCorrespondenceAction} className="grid">
                <input type="hidden" name="correspondenceId" value={record.id} />
                <div className="field"><label>Routing purpose</label><select name="workPurpose" defaultValue="ACTION"><option value="ACTION">Action / treatment</option><option value="REVIEW">Review and recommendation</option><option value="CONCURRENCE">Concurrence</option><option value="APPROVAL">Formal approval</option></select></div>
                <div className="field"><label>Minute / instruction</label><textarea name="minute" required minLength={3} placeholder="State the action required, expected outcome, and any deadline…" /></div>
                <div className="field">
                  <RecipientSelector
                    actionHint={canReferToPeers ? "Select your supervisor, direct reports, or an authorized peer. Division Head peers are limited to your department." : "Select your assigned supervisor or one or more direct reports."}
                  />
                </div>
                <button className="btn" type="submit">Record minute and route</button>
              </form>
            </section>
          ) : null}
          {activeActionItem && !pendingDecision ? <section className="card"><h2>Resolve</h2><form action={resolveAction} className="grid"><input type="hidden" name="correspondenceId" value={record.id} /><div className="field"><label>Resolution note</label><textarea name="minute" placeholder="Describe the action taken, outcome, and any remaining follow-up…" required /></div><button className="btn secondary" type="submit">Mark resolved</button></form></section> : null}
          {canReturnToInitiator ? (
            <section className="card">
              <h2>Return for correction</h2>
              <p className="muted">The initiator will receive this in their inbox. The return and resubmission remain in the audit trail.</p>
              <form action={returnToInitiatorAction} className="grid">
                <input type="hidden" name="correspondenceId" value={record.id} />
                <div className="field"><label>Reason and correction required</label><textarea name="reason" minLength={5} required placeholder="Explain what must be corrected before this correspondence can proceed…" /></div>
                <button className="btn secondary" type="submit">Return to initiator</button>
              </form>
            </section>
          ) : null}
          {canResubmit ? (
            <section className="card">
              <h2>Resubmit corrected correspondence</h2>
              <p><Link className="btn secondary" href={`/correspondence/${record.id}/revise`}>Edit and create new version</Link></p>
              <form action={resubmitReturnedAction} className="grid">
                <input type="hidden" name="correspondenceId" value={record.id} />
                <div className="field"><label>Correction note</label><textarea name="note" minLength={5} required placeholder="Describe the correction made and any supporting update…" /></div>
                <button className="btn" type="submit">Resubmit to reviewing officer</button>
              </form>
            </section>
          ) : null}
          {canPrepareDispatch ? <section className="card"><span className="eyebrow">Outgoing delivery</span><h2>Prepare dispatch</h2><p className="muted">Official email dispatch is recorded here; automated SMTP delivery will be connected in the email-delivery slice.</p><form action={prepareDispatchAction} className="form-grid"><input type="hidden" name="correspondenceId" value={record.id} />
            <div className="field"><label>Delivery channel</label><select name="channel" defaultValue="OFFICIAL_EMAIL"><option value="OFFICIAL_EMAIL">Official email</option><option value="PHYSICAL_DELIVERY">Physical delivery</option><option value="COURIER">Courier</option><option value="STAKEHOLDER_PORTAL">Stakeholder portal</option></select></div>
            <div className="field"><label>Recipient name</label><input name="recipientName" required minLength={2} placeholder="Full name of the receiving person or office" /></div>
            <div className="field"><label>Organization</label><input name="recipientOrganization" placeholder="Recipient organization or agency" /></div><div className="field"><label>Email</label><input name="recipientEmail" type="email" placeholder="recipient@example.org" /></div>
            <div className="field span-2"><label>Delivery address</label><textarea name="recipientAddress" placeholder="Physical, courier, or portal delivery address" /></div><div className="field"><label>Tracking number</label><input name="trackingNumber" placeholder="Courier, registry, or portal tracking number" /></div>
            <div className="field span-2"><label>Dispatch note</label><textarea name="dispatchNote" placeholder="State delivery instructions or handling notes" /></div><button className="btn span-2" type="submit">Create dispatch record</button>
          </form></section> : null}
        </div>
        <aside className="card">
          {record.dispatchRecords.length ? <><h2>Dispatch records</h2>{record.dispatchRecords.map((dispatch) => { const emailItem = dispatchEmailById.get(dispatch.id); return <div key={dispatch.id} style={{ borderBottom: "1px solid #ece9e0", paddingBottom: 12, marginBottom: 12 }}><strong>{dispatch.outgoingReference}</strong> <span className="badge">{label(dispatch.status)}</span><p>{label(dispatch.channel)} · {dispatch.recipientName}{dispatch.recipientOrganization ? ` · ${dispatch.recipientOrganization}` : ""}</p><small className="muted">Prepared by {dispatch.createdBy.name} · {dispatch.createdAt.toLocaleString("en-NG")}</small>{emailItem ? <p><span className="badge">Email {label(emailItem.status)}</span> <small className="muted">{emailItem.attemptCount} attempt{emailItem.attemptCount === 1 ? "" : "s"}{emailItem.lastErrorCode ? ` · ${emailItem.lastErrorCode}` : ""}</small></p> : null}
            {canDispatch(user.role) && dispatch.status !== DispatchStatus.DELIVERED ? <form action={updateDispatchStatusAction} className="grid" style={{ marginTop: 10 }}><input type="hidden" name="dispatchId" value={dispatch.id} /><div className="field"><label>Delivery update note</label><input name="note" placeholder="Delivery confirmation, failure reason, or retry note" /></div><div className="actions">{dispatch.channel !== DispatchChannel.OFFICIAL_EMAIL && (dispatch.status === DispatchStatus.PREPARED || dispatch.status === DispatchStatus.FAILED) ? <button className="btn compact" name="status" value="DISPATCHED">Mark dispatched</button> : null}{dispatch.status === DispatchStatus.DISPATCHED ? <button className="btn compact" name="status" value="DELIVERED">Confirm delivery</button> : null}{dispatch.status === DispatchStatus.PREPARED || dispatch.status === DispatchStatus.DISPATCHED ? <button className="btn secondary compact" name="status" value="FAILED">Record failure</button> : null}</div>{dispatch.channel === DispatchChannel.OFFICIAL_EMAIL && dispatch.status === DispatchStatus.PREPARED ? <small className="muted">Queued for the protected email worker. SMTP acceptance will mark it dispatched.</small> : null}</form> : null}
          </div>; })}</> : null}
          {record.workItems.some((item) => item.decisionRequest) ? <>
            <h2>Decision register</h2>
            {record.workItems.filter((item) => item.decisionRequest).map((item) => {
              const decision = item.decisionRequest!;
              return <div key={decision.id} style={{ borderBottom: "1px solid #ece9e0", paddingBottom: 12, marginBottom: 12 }}>
                <strong>{label(decision.purpose)} · {decision.outcome ? label(decision.outcome) : "Pending"}{decision.supersededAt ? " · Superseded" : ""}</strong>
                <p style={{ margin: "5px 0" }}>{decision.decisionNote ?? item.instruction}</p>
                {decision.signature ? <div className={`notice ${verifyApprovalSignature(decision.signature) ? "success" : "error"}`}><strong>{verifyApprovalSignature(decision.signature) ? "Signature assertion verified" : "Signature verification failed"}</strong><br /><small>Revision {decision.signature.revisionVersion} · SHA-256 {decision.signature.documentDigest.slice(0, 16)}… · {decision.signature.algorithm} / {decision.signature.keyId} · authenticated by {decision.signature.authenticationMethod.toLowerCase().replaceAll("_", " ")}{decision.signature.authorityPrincipalName ? ` · acting for ${decision.signature.authorityPrincipalName}` : ""}</small></div> : decision.outcome === DecisionOutcome.APPROVED ? <p className="notice">Legacy approval: recorded before signed approval assertions were enabled.</p> : null}
                <small className="muted">Requested by {decision.requestedBy.name} for {item.assignee.name}{decision.decidedBy ? ` · decided by ${decision.decidedBy.name}` : ""}{decision.decidedAt ? ` · ${decision.decidedAt.toLocaleString("en-NG")}` : ""}</small>
              </div>;
            })}
          </> : null}
          {record.revisions.length ? <>
            <h2>Version history</h2>
            {record.revisions.map((revision) => <details key={revision.id} style={{ borderBottom: "1px solid #ece9e0", paddingBottom: 12, marginBottom: 12 }} open={revision.version === record.revisions[0].version}>
              <summary><strong>Version {revision.version}</strong> · {revision.changeNote}</summary>
              <small className="muted">{revision.createdBy?.name ?? "External submitter / system"} · {revision.createdAt.toLocaleString("en-NG")}</small>
              <p><strong>Subject:</strong> {revision.subject}</p><p>{revision.summary}</p>
              {revision.body ? <div style={{ whiteSpace: "pre-wrap" }}>{revision.body}</div> : null}
            </details>)}
          </> : null}
          {record.secretariatRecord ? <>
            <h2>Physical-file history</h2>
            <p><strong>{record.secretariatRecord.trackingCode}</strong><br /><small className="muted">Current location: {record.secretariatRecord.currentLocation} · updated by {record.secretariatRecord.updatedBy.name}</small></p>
            {record.secretariatRecord.events.map((event) => <div key={event.id} style={{ borderBottom: "1px solid #ece9e0", paddingBottom: 10, marginBottom: 10 }}><strong>{label(event.type)}</strong><p style={{ margin: "5px 0" }}>{event.reason}</p><small className="muted">{event.fromLocation && event.toLocation ? `${event.fromLocation} → ${event.toLocation} · ` : ""}{event.actor.name} · {event.createdAt.toLocaleString("en-NG")}</small></div>)}
          </> : null}
          <h2>Movement & minutes</h2>
          <div className="timeline">
            {record.events.map((event) => <article className="event" key={event.id}>
              <strong>{label(event.type)}</strong>
              <p style={{ margin: "5px 0" }}>{event.minute}</p>
              <small className="muted">{event.actor?.name ?? record.externalOrganization?.contactName ?? "System"} · {event.createdAt.toLocaleString("en-NG")}</small>
            </article>)}
          </div>
          <h3>Current recipients</h3>
          {record.workItems.filter((item) => activeStatuses.includes(item.status)).map((item) => <p key={item.id}><span className="badge">{label(item.kind)}</span> {item.assignee.name} <small className="muted">· {label(item.purpose)}</small></p>)}
        </aside>
      </div>
    </>
  );
}
