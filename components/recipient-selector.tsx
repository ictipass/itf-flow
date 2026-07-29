"use client";

import { useEffect, useState } from "react";

export type DirectoryPerson = {
  id: string;
  name: string;
  email: string;
  staffNumber: string | null;
  department: string | null;
  division: string | null;
  office: string;
  position: string | null;
  role: string;
};

type RecipientSelectorProps = {
  actionFieldName?: string;
  copyFieldName?: string;
  actionLabel?: string;
  actionHint?: string;
};

function PersonPicker({
  mode,
  selected,
  blockedIds,
  onChange,
  label,
  hint,
  fieldName,
  placeholder,
}: {
  mode: "action" | "copy";
  selected: DirectoryPerson[];
  blockedIds: string[];
  onChange: (people: DirectoryPerson[]) => void;
  label: string;
  hint: string;
  fieldName: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/directory/search?mode=${mode}&q=${encodeURIComponent(normalized)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Directory search failed.");
        const payload = (await response.json()) as { people: DirectoryPerson[] };
        setResults(payload.people.filter((person) => !blockedIds.includes(person.id)));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [blockedIds, mode, query]);

  function toggle(person: DirectoryPerson) {
    const exists = selected.some((item) => item.id === person.id);
    onChange(exists ? selected.filter((item) => item.id !== person.id) : [...selected, person]);
  }

  return (
    <div className="recipient-picker">
      <label className="recipient-picker-label">{label}</label>
      <p className="recipient-picker-hint">{hint}</p>

      {selected.length ? (
        <div className="recipient-chips">
          {selected.map((person) => (
            <span className="recipient-chip" key={person.id}>
              <span>
                {person.name}
                {person.staffNumber ? ` · ${person.staffNumber}` : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove ${person.name}`}
                onClick={() => toggle(person)}
              >
                ×
              </button>
              <input type="hidden" name={fieldName} value={person.id} />
            </span>
          ))}
        </div>
      ) : null}

      <input
        className="recipient-search"
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < 2) {
            setResults([]);
            setLoading(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      <div className="recipient-results">
        {loading ? <p className="recipient-empty">Searching the staff directory…</p> : null}
        {!loading &&
          results.map((person) => {
            const isSelected = selected.some((item) => item.id === person.id);
            return (
              <button
                className={`recipient-result ${isSelected ? "selected" : ""}`}
                type="button"
                key={person.id}
                onClick={() => toggle(person)}
              >
                <span className="recipient-avatar" aria-hidden="true">
                  {person.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span className="recipient-identity">
                  <strong>{person.name}</strong>
                  <small>
                    {[person.staffNumber, person.position, person.department]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="recipient-add">{isSelected ? "Selected" : "Add"}</span>
              </button>
            );
          })}
        {!loading && query.trim().length >= 2 && !results.length ? (
          <p className="recipient-empty">No staff member matches “{query}”.</p>
        ) : null}
        {query.trim().length < 2 ? (
          <p className="recipient-empty">Type at least two characters to search.</p>
        ) : null}
      </div>
    </div>
  );
}

export function RecipientSelector({
  actionFieldName = "actionRecipientIds",
  copyFieldName = "copyRecipientIds",
  actionLabel = "To — action recipients",
  actionHint = "These recipients are responsible for taking action.",
}: RecipientSelectorProps) {
  const [actionRecipients, setActionRecipients] = useState<DirectoryPerson[]>([]);
  const [copyRecipients, setCopyRecipients] = useState<DirectoryPerson[]>([]);

  return (
    <div className="recipient-selector-grid">
      <PersonPicker
        mode="action"
        selected={actionRecipients}
        blockedIds={copyRecipients.map((person) => person.id)}
        onChange={setActionRecipients}
        label={actionLabel}
        hint={actionHint}
        fieldName={actionFieldName}
        placeholder="Type a name, staff number, department, division or position…"
      />
      <PersonPicker
        mode="copy"
        selected={copyRecipients}
        blockedIds={actionRecipients.map((person) => person.id)}
        onChange={setCopyRecipients}
        label="Copy — CC recipients"
        hint="Copied recipients can read and track the correspondence but are not accountable owners."
        fieldName={copyFieldName}
        placeholder="Type a name, staff number or department to copy someone…"
      />
    </div>
  );
}
