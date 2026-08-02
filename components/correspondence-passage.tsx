import { Check, CircleDot, Clock3, Copy, GitBranch, MapPin, RotateCcw, UserRound } from "lucide-react";
import { label } from "@/lib/reference";

type Person = { id: string; name: string; role: string; office: string; department: string | null; division: string | null };
type PassageEvent = { id: string; type: string; fromStatus: string | null; toStatus: string | null; minute: string | null; metadata: unknown; createdAt: Date; actor: Person | null };
type PassageWorkItem = { id: string; assigneeId: string; kind: string; status: string; instruction: string | null; assignedAt: Date; acknowledgedAt: Date | null; completedAt: Date | null; assignee: Person };

function duration(from: Date, to: Date) {
  const minutes = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "Less than a minute";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${minutes % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ${hours % 24} hr`;
}

function metadataIds(metadata: unknown, keys: string[]) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const value = metadata as Record<string, unknown>;
  return keys.flatMap((key) => {
    const item = value[key];
    if (Array.isArray(item)) return item.filter((id): id is string => typeof id === "string");
    return typeof item === "string" ? [item] : [];
  });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function CorrespondencePassage({ status, receivedAt, initiator, externalSender, events, workItems }: {
  status: string;
  receivedAt: Date;
  initiator: Person | null;
  externalSender: string | null;
  events: PassageEvent[];
  workItems: PassageWorkItem[];
}) {
  const chronologicalEvents = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const statusAtEvent = chronologicalEvents.reduce<{ current: string; values: string[] }>(
    (state, event) => {
      const current = event.toStatus ?? state.current;
      return { current, values: [...state.values, current] };
    },
    { current: "SUBMITTED", values: [] },
  ).values;
  const activeItems = workItems.filter((item) => item.status === "OPEN" || item.status === "ACKNOWLEDGED");
  const actionItems = activeItems.filter((item) => item.kind === "ACTION");
  const copyItems = activeItems.filter((item) => item.kind === "COPY");
  const people = new Map(workItems.map((item) => [item.assignee.id, item.assignee]));
  if (initiator) people.set(initiator.id, initiator);
  for (const event of chronologicalEvents) if (event.actor) people.set(event.actor.id, event.actor);
  const latestItemByAssignee = new Map<string, PassageWorkItem>();
  for (const item of [...workItems].sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())) latestItemByAssignee.set(item.assigneeId, item);
  const offices = [...new Set(actionItems.map((item) => item.assignee.office))];
  const currentSince = actionItems.length ? new Date(Math.min(...actionItems.map((item) => item.assignedAt.getTime()))) : chronologicalEvents.at(-1)?.createdAt ?? receivedAt;

  return (
    <section className="passage-card card">
      <div className="passage-heading">
        <div><span className="eyebrow">Passage and status</span><h2>Correspondence journey</h2><p className="muted">An immutable, chronological view of where this correspondence has been and where it is now.</p></div>
        <span className="passage-current-status"><CircleDot size={15} /> {label(status)}</span>
      </div>
      <div className="passage-summary">
        <div><small>Current action owner{actionItems.length === 1 ? "" : "s"}</small><strong>{actionItems.length ? actionItems.map((item) => item.assignee.name).join(", ") : "No active action owner"}</strong></div>
        <div><small>Current location</small><strong>{offices.length ? offices.join(" · ") : "Workflow completed or awaiting intake"}</strong></div>
        <div><small>At current stage</small><strong>{duration(currentSince, new Date())}</strong></div>
        <div><small>Active copies</small><strong>{copyItems.length}</strong></div>
      </div>
      <div className="passage-flow">
        {!chronologicalEvents.length ? <article className="passage-stage complete">
          <div className="passage-marker"><Check size={16} /></div>
          <div className="passage-stage-body"><div className="passage-stage-top"><strong>Correspondence received</strong><time>{receivedAt.toLocaleString("en-NG")}</time></div><p>{initiator ? `${initiator.name} initiated this correspondence.` : `Received from ${externalSender ?? "an external sender"}.`}</p><span className="status-at-time">Status: Submitted</span></div>
        </article> : null}
        {chronologicalEvents.map((event, index) => {
          const nextAt = chronologicalEvents[index + 1]?.createdAt ?? new Date();
          const actionIds = metadataIds(event.metadata, ["actionRecipientIds", "recipientIds", "returnedToId", "resubmittedToId"]);
          const copyIds = metadataIds(event.metadata, ["copyRecipientIds"]);
          const recipients = [...new Set([...actionIds, ...copyIds])].flatMap((id) => {
            const person = people.get(id);
            return person ? [{ person, kind: copyIds.includes(id) ? "COPY" : "ACTION", workItem: latestItemByAssignee.get(id) }] : [];
          });
          const last = index === chronologicalEvents.length - 1;
          return (
            <article className={`passage-stage ${last ? "current" : "complete"}`} key={event.id}>
              <div className="passage-marker">{event.type === "RETURNED" ? <RotateCcw size={16} /> : last ? <CircleDot size={16} /> : <Check size={16} />}</div>
              <div className="passage-stage-body">
                <div className="passage-stage-top"><strong>{label(event.type)}</strong><time>{event.createdAt.toLocaleString("en-NG")}</time></div>
                <div className="passage-actor"><span className="passage-avatar">{event.actor ? initials(event.actor.name) : "ITF"}</span><div><strong>{event.actor?.name ?? "System / external sender"}</strong><small>{event.actor ? `${label(event.actor.role)} · ${event.actor.office}` : "Automated or external event"}</small></div></div>
                {event.minute ? <p className="passage-minute">{event.minute}</p> : null}
                <div className="passage-stage-meta"><span className="status-at-time">Status: {label(statusAtEvent[index])}</span><span><Clock3 size={13} /> {duration(event.createdAt, nextAt)} at this point</span></div>
                {recipients.length ? <div className="passage-branches"><div className="passage-branch-label"><GitBranch size={14} /> Routed simultaneously</div>{recipients.map(({ person, kind, workItem }) => <div className="passage-recipient" key={`${event.id}-${person.id}-${kind}`}><span className="passage-avatar">{initials(person.name)}</span><div><strong>{person.name}</strong><small>{label(person.role)} · {person.office}</small></div><span className={`badge ${kind === "COPY" ? "copy" : ""}`}>{kind === "COPY" ? <Copy size={11} /> : <UserRound size={11} />} {label(kind)} · Current: {label(workItem?.status ?? "Assigned")}</span></div>)}</div> : null}
              </div>
            </article>
          );
        })}
      </div>
      {activeItems.length ? <div className="passage-now"><strong><MapPin size={16} /> Current position</strong><div className="passage-now-grid">{activeItems.map((item) => <div className="passage-recipient" key={item.id}><span className="passage-avatar">{initials(item.assignee.name)}</span><div><strong>{item.assignee.name}</strong><small>{item.assignee.office} · assigned {item.assignedAt.toLocaleString("en-NG")}</small></div><span className={`badge ${item.kind === "COPY" ? "copy" : ""}`}>{label(item.kind)} · {label(item.status)}</span></div>)}</div></div> : null}
    </section>
  );
}
