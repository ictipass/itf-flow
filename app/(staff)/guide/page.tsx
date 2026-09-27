const guides = [
  {
    title: "All staff and originators",
    steps: [
      ["Raise or save", "Create correspondence, select authorized action and copy recipients, add a clear minute, and either save privately or route it."],
      ["Monitor", "Use My inbox for assigned work, Notifications for alerts, and the correspondence register to search matters you are permitted to see."],
      ["Treat and route", "Acknowledge custody, record any requested formal decision, then resolve or minute the matter to an authorized next recipient."],
      ["Correct safely", "When returned, create a numbered revision with a change note; the earlier document and superseded decisions remain auditable."],
    ],
  },
  {
    title: "DG, Directors and line managers",
    steps: [
      ["Prioritize the inbox", "Review urgent, overdue, and decision-requested items before routine correspondence."],
      ["Record authority", "Use review, concurrence, or approval outcomes where requested; always add a decision note."],
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
    ],
  },
  {
    title: "System administrator",
    steps: [
      ["Provision access", "Review synchronized users and organizational identifiers; access follows active role and reporting-line data."],
      ["Configure experience", "Privately preview Classic, Modern, Soft UI, or Glass, then activate the approved interface with an audit reason."],
      ["Operate automation", "Monitor reminder policy and runs, process or retry email delivery, and investigate dead-letter items without changing correspondence history."],
      ["Respect separation", "Administration does not silently broaden document visibility; Secret classification remains restricted by role."],
    ],
  },
];

const endToEndSteps = [
  ["Compose and route", "The sender creates the correspondence, selects one or more action recipients, adds copy recipients only for awareness, records a clear instruction, and submits."],
  ["Secure the document", "With scanning enabled, an attachment is quarantined until validation and malware scanning mark it Available and Clean. Under the explicit temporary bypass, a signature-valid upload is immediately Available and Bypassed, with the exception retained in its audit history."],
  ["Receive and acknowledge", "Each action recipient sees the item in My inbox and acknowledges it to establish custody. Copy recipients can follow it but do not own treatment."],
  ["Treat or decide", "The action owner performs the required work and records any requested review, concurrence, approval, recommendation, or clarification."],
  ["Minute and move", "If further action is required, the owner records a minute and routes to an authorized supervisor, direct report, or permitted peer. Sequential work is sent to the next desk only."],
  ["Correct when returned", "The originator creates a numbered revision, explains the correction, and resubmits. Earlier versions and decisions remain in the audit history."],
  ["Resolve", "The final action owner records the outcome and selects Mark resolved. Incoming letters and internal memos normally finish in Resolved status."],
  ["Dispatch and close", "For an outgoing letter, authorized Secretariat or Records staff prepare dispatch, record delivery or failure, and successful delivery closes the correspondence."],
  ["Retain the evidence", "Movement, minutes, decisions, revisions, document events and physical-file history remain available according to the user's authorization."],
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
