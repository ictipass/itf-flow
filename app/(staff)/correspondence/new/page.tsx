import { registerCorrespondenceAction } from "@/app/actions";
import { RecipientSelector } from "@/components/recipient-selector";
import { canOriginate, canRegister, getAdjacentRoles } from "@/lib/permissions";
import { label } from "@/lib/reference";
import { requireUser } from "@/lib/session";

export default async function NewCorrespondencePage() {
  const user = await requireUser();

  if (!canOriginate(user.role)) {
    return <div className="notice">You cannot raise correspondence.</div>;
  }

  const isRegistrar = canRegister(user.role);
  const adjacentRoles = getAdjacentRoles(user.role);

  return (
    <>
      <span className="eyebrow">
        {isRegistrar ? "Secretariat intake or internal origination" : "Internal origination"}
      </span>
      <h1>Raise correspondence</h1>
      <p className="muted">
        {isRegistrar
          ? "Incoming letters go directly to the DG. Internal correspondence follows the formal hierarchy."
          : `Route to the adjacent ${adjacentRoles.map(label).join(" or ")} level without skipping the hierarchy.`}
      </p>

      <form action={registerCorrespondenceAction} className="card form-grid">
        <div className="field">
          <label>Document type</label>
          <select
            name="type"
            defaultValue={isRegistrar ? "INCOMING_LETTER" : "INTERNAL_MEMO"}
          >
            {isRegistrar ? <option value="INCOMING_LETTER">Incoming letter</option> : null}
            <option value="INTERNAL_MEMO">Internal memo</option>
            <option value="OUTGOING_LETTER">Outgoing letter</option>
          </select>
        </div>

        <div className="field">
          <label>Sender *</label>
          <input
            name="senderName"
            defaultValue={user.name}
            placeholder="Name of the originating officer or external sender"
            required
          />
        </div>

        <div className="field span-2">
          <label>Subject *</label>
          <input
            name="subject"
            placeholder="Briefly state what the correspondence is about"
            required
            minLength={5}
          />
        </div>

        <div className="field">
          <label>Sender reference</label>
          <input name="senderReference" placeholder="e.g. ITF/ICT/PASS/2026/014" />
        </div>

        <div className="field">
          <label>Due date</label>
          <input name="dueAt" type="date" aria-label="Required response or action date" />
        </div>

        <div className="field">
          <label>Classification</label>
          <select name="classification" defaultValue="INTERNAL">
            <option>PUBLIC</option>
            <option>INTERNAL</option>
            <option>CONFIDENTIAL</option>
            <option>SECRET</option>
          </select>
        </div>

        <div className="field">
          <label>Priority</label>
          <select name="priority" defaultValue="ROUTINE">
            <option>ROUTINE</option>
            <option>URGENT</option>
            <option>IMMEDIATE</option>
          </select>
        </div>

        <div className="field span-2">
          <label>Summary *</label>
          <textarea
            name="summary"
            placeholder="Summarize the request, decision required, and important context"
            required
            minLength={10}
          />
        </div>

        <div className="field span-2">
          <label>Compose memo / transcribe letter</label>
          <textarea
            name="body"
            placeholder="Compose the full memo or transcribe the main content of the letter"
            style={{ minHeight: 180 }}
          />
        </div>

        <div className="field span-2">
          <RecipientSelector
            actionHint={
              isRegistrar
                ? "Incoming letters go to the DG automatically. For internal correspondence, choose a formal adjacent-level recipient."
                : "Select one or more adjacent-level staff responsible for taking action."
            }
          />
        </div>

        <div className="field span-2">
          <label>Routing minute / instruction</label>
          <textarea
            name="instruction"
            placeholder="For attention and necessary action…"
          />
        </div>

        <div className="field span-2">
          <label>Scanned document</label>
          <input name="attachment" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        </div>

        <button className="btn span-2" type="submit">
          Raise and route correspondence
        </button>
      </form>
    </>
  );
}
