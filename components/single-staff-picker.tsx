"use client";

import { useEffect, useState } from "react";
import type { DirectoryPerson } from "@/components/recipient-selector";

export function SingleStaffPicker({
  fieldName,
  label,
  hint,
  required = false,
  initial,
  onSelectionChange,
}: {
  fieldName: string;
  label: string;
  hint: string;
  required?: boolean;
  initial?: DirectoryPerson | null;
  onSelectionChange?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<DirectoryPerson | null>(initial ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || selected) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/directory/search?mode=copy&q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Directory search failed.");
        const payload = (await response.json()) as { people: DirectoryPerson[] };
        setResults(payload.people);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);

  return <div className="recipient-picker">
    <label className="recipient-picker-label">{label}{required ? " *" : ""}</label>
    <p className="recipient-picker-hint">{hint}</p>
    {selected ? <div className="recipient-chips"><span className="recipient-chip"><span>{selected.name} · {[selected.staffNumber, selected.position, selected.department].filter(Boolean).join(" · ")}</span><button type="button" aria-label={`Remove ${selected.name}`} onClick={() => { setSelected(null); setQuery(""); onSelectionChange?.(); }}>×</button><input type="hidden" name={fieldName} value={selected.id} /></span></div> : <>
      <input className="recipient-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, staff number, office or department…" autoComplete="off" required={required} />
      <div className="recipient-results">
        {loading ? <p className="recipient-empty">Searching the staff directory…</p> : null}
        {!loading && results.map((person) => <button className="recipient-result" type="button" key={person.id} onClick={() => { setSelected(person); setResults([]); setQuery(""); onSelectionChange?.(); }}><span className="recipient-avatar" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="recipient-identity"><strong>{person.name}</strong><small>{[person.staffNumber, person.position, person.department, person.office].filter(Boolean).join(" · ")}</small></span><span className="recipient-add">Select</span></button>)}
        {!loading && query.trim().length >= 2 && !results.length ? <p className="recipient-empty">No active staff member matches “{query}”.</p> : null}
      </div>
    </>}
  </div>;
}
