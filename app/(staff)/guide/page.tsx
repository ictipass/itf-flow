const originatorSteps = [
  ["Open Raise correspondence", "Choose the option from the left navigation or dashboard."],
  ["Choose the document type", "Select an internal memo, outgoing letter, or—where authorized—an incoming letter."],
  ["Describe the correspondence", "Enter the subject, summary, full text, classification, priority, reference, and due date."],
  ["Select To recipients", "Search by name, staff number, department, division, unit, position, email, or role. Action choices follow your hierarchy plus any authorized Director or same-department Division Head peers."],
  ["Select Copy recipients", "Search the wider staff directory for anyone who should be informed but is not accountable for action."],
  ["Add the routing minute", "State clearly what should be done, the expected result, and any deadline."],
  ["Attach supporting material", "Add a PDF, JPEG, or PNG scan when the source document or evidence is required."],
  ["Raise and route", "Review the information, submit it, and retain the generated ITF Flow reference number."],
];

const recipientSteps = [
  ["Open My inbox", "New action and copied correspondence appear in your attention queue."],
  ["Open and read", "Review the subject, summary, composed text, attachments, classification, priority, due date, and all prior minutes."],
  ["Acknowledge receipt", "Use Acknowledge receipt to confirm that the correspondence is now in your custody."],
  ["Treat the matter", "Carry out the requested review, decision, consultation, or operational action outside or within the supporting process."],
  ["Minute, refer, or forward", "Write a clear purpose, select an authorized hierarchy or peer recipient, optionally copy the department Director, and route it."],
  ["Resolve", "When no further routing is required, enter a resolution note and mark the correspondence resolved."],
  ["Preserve the record", "The movement timeline keeps every acknowledgement, minute, recipient, decision, actor, and timestamp."],
];

function StepList({ steps }: { steps: string[][] }) {
  return (
    <ol className="guide-steps">
      {steps.map(([title, description], index) => (
        <li key={title}>
          <span className="guide-step-number">{index + 1}</span>
          <div><strong>{title}</strong><p>{description}</p></div>
        </li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  return (
    <>
      <span className="eyebrow">Operating guide</span>
      <h1>How correspondence moves in ITF Flow</h1>
      <p className="muted" style={{ maxWidth: 820, lineHeight: 1.7 }}>
        Action recipients are responsible for treatment. CC recipients receive visibility
        without becoming accountable owners. Formal action routing follows explicit supervisor
        and direct-report assignments, with controlled peer referrals for Directors and same-department Division Heads.
      </p>
      <div className="grid guide-grid">
        <section className="card"><h2>Raising correspondence</h2><StepList steps={originatorSteps} /></section>
        <section className="card"><h2>Receiving and treating correspondence</h2><StepList steps={recipientSteps} /></section>
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <h2>Formal routing line</h2>
        <p className="workflow-line">Officer ↔ Unit Head ↔ Division Head ↔ Director ↔ DG</p>
        <p className="workflow-line">Director ↔ Director · Division Head ↔ Division Head (same department)</p>
        <p className="muted">External submissions first enter the DG Secretariat intake queue before registration and delivery to the DG.</p>
      </section>
    </>
  );
}
