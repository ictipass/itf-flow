const guides = [
  {
    title: "All staff and originators",
    steps: [
      ["Raise or save", "Create correspondence and format the memo body. Select the ultimate recipient separately from the next action desk, then choose the official filing category, file-plan code, retention class and personnel subject/owning unit."],
      ["Monitor", "Use My inbox for assigned work, Notifications for alerts, and the correspondence register to search matters you are permitted to see."],
      ["Annotate a document", "While you own the Action item, use pen/eraser, stroke undo/redo, custom draggable minute placement and typed text. Flow preserves the source and creates a signed PDF version."],
      ["Register your signature", "Open Signature profile and submit your own PNG signature. Your authenticated submission activates immediately and can appear on new ITF memo outputs."],
      ["Treat and route", "For an internal memo, open the single ITF memo packet to read and annotate the formatted document and converted attachment pages. Source files already present in the packet are hidden from the package list to prevent duplication."],
      ["Correct safely", "When returned, create a numbered revision with a change note; the earlier document and superseded decisions remain auditable."],
    ],
  },
  {
    title: "DG, Directors and line managers",
    steps: [
      ["Prioritize the inbox", "Review urgent, overdue, and decision-requested items before routine correspondence."],
      ["Record authority", "Use review, concurrence, or approval outcomes where requested; always add a decision note."],
      ["Minute directly", "Use Minute and sign on document for PDF, JPEG, or PNG material. After saving your annotation on the current document version, the separate routing-minute field may be left blank."],
      ["Route within policy", "Send work through explicit reporting lines. Directors and eligible Division Heads may use controlled peer referrals."],
      ["Use the audit trail", "Confirm current custody and elapsed time from the correspondence passage before following up or escalating."],
    ],
  },
  {
    title: "Secretariat and Records",
    steps: [
      ["Claim intake", "Claim an unassigned external submission in the shared queue so another secretary cannot process it simultaneously."],
      ["Register the file", "Verify the document, capture scan desk, pages, physical location and file reference, then review any duplicate suggestion."],
      ["Label and move", "Print the QR tracking label and record every physical-file reassignment with a reason."],
      ["Dispatch", "For approved outgoing correspondence, prepare a delivery record and update it through dispatch, delivery, or failure."],
      ["Retrieve official records", "Open Registry appointments retrieve Public/Internal files; Secret Registry appointments retrieve every classification under the active MFA policy. Export the S29 evidence ZIP when an auditor or archive needs the complete record."],
    ],
  },
  {
    title: "System administrator",
    steps: [
      ["Provision access", "Review synchronized users and organizational identifiers; access follows active role and reporting-line data."],
      ["Configure experience", "Privately preview Classic, Modern, Soft UI, or Glass, then activate the approved interface with an audit reason."],
      ["Govern annotations", "Under Document Administration, require or relax annotation re-authentication separately for DG, Directors, and Division Heads. Every change needs an audit reason."],
      ["Govern signature profiles", "Use Signature governance to audit staff submissions and revoke a signature with a recorded reason when it must no longer be used."],
      ["Govern records access", "Use Records governance to appoint or revoke Open/Secret Registry staff and to enforce or relax Secret Registry MFA with a recorded reason."],
      ["Operate automation", "Monitor reminder policy and runs, process or retry email delivery, and investigate dead-letter items without changing correspondence history."],
      ["Respect separation", "Administration does not silently broaden document visibility; Secret classification remains restricted by role."],
    ],
  },
];

const endToEndSteps = [
  ["Compose, file and route", "The sender selects the stable ultimate recipient and logical official file, then selects the next action recipient, adds copies only for awareness, records a clear instruction, and submits."],
  ["Secure the document", "With scanning enabled, an attachment is quarantined until validation and malware scanning mark it Available and Clean. Under the explicit temporary bypass, a signature-valid upload is immediately Available and Bypassed, with the exception retained in its audit history."],
  ["Receive and acknowledge", "Each action recipient sees the item in My inbox and acknowledges it to establish custody. Copy recipients can follow it but do not own treatment."],
  ["Treat or decide", "The action owner performs the required work and records any requested review, concurrence, approval, recommendation, or clarification."],
  ["Annotate where needed", "An internal memo is automatically stored as an ITF template working packet. Available PDF, JPEG and PNG attachments follow its memo pages. The owner can select any packet page and write with a stylus, touch, or mouse and/or add typed text; saving preserves the source and creates a new authenticated PDF version."],
  ["Minute and move", "If further action is required, the owner records a minute and routes to an authorized supervisor, direct report, or permitted peer. If that owner just annotated the current document, the saved annotation can supply the routing minute. Sequential work is sent to the next desk only."],
  ["Correct when returned", "The originator creates a numbered revision, explains the correction, and resubmits. Earlier versions and decisions remain in the audit history."],
  ["Resolve", "The final action owner records the outcome and selects Mark resolved. Incoming letters and internal memos normally finish in Resolved status."],
  ["Generate the memo output", "For a resolved internal memo whose originator has an active signature profile, generate the versioned PDF. It contains the ITF memo, compatible attachments, and then the lifecycle evidence appendix with movement/decision history and attachment hashes."],
  ["Dispatch and close", "For an outgoing letter, authorized Secretariat or Records staff prepare dispatch, record delivery or failure, and successful delivery closes the correspondence."],
  ["Retain and export evidence", "Movement, minutes, decisions, revisions, annotations, documents and hashes remain authorized and auditable. The S29 ZIP provides one integrity-checked archival/auditor package."],
];

function StepList({ steps }: { steps: string[][] }) {
  return <ol className="guide-steps">{steps.map(([title, description], index) => <li key={title}><span className="guide-step-number">{index + 1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>;
}

export default function GuidePage() {
  return <>
    <span className="eyebrow">Role-based operating guide</span>
    <h1>How to use ITF Flow</h1>
    <p className="muted" style={{ maxWidth: 860, lineHeight: 1.7 }}>Action recipients own treatment; copy recipients have visibility only. Every user sees only correspondence allowed by their role, classification, authorship, or assignment.</p>
    <section className="card" style={{ marginTop: 24 }}><span className="eyebrow">Sender to final outcome</span><h2>End-to-end correspondence workflow</h2><StepList steps={endToEndSteps} /></section>
    <div className="grid guide-grid">{guides.map((guide) => <section className="card" key={guide.title}><h2>{guide.title}</h2><StepList steps={guide.steps} /></section>)}</div>
    <section className="card" style={{ marginTop: 18 }}><h2>Search, registers and reports</h2><p>Open <strong>All correspondence</strong>, search references, sender, subject, content, minutes, or tracking code, and filter by classification, priority, status, owner, office, department, or received date. The register and movement CSV downloads preserve the active filters and your access restrictions.</p></section>
    <section className="card" style={{ marginTop: 18 }}><h2>Formal routing line</h2><p className="workflow-line">Officer ↔ Unit Head ↔ Division Head ↔ Director ↔ DG</p><p className="workflow-line">Director ↔ Director · Division Head ↔ Division Head (same department)</p><p className="muted">External submissions enter the shared DG Secretariat intake before registration. Outgoing items requiring approval cannot be dispatched without a current approval.</p></section>
  </>;
}
