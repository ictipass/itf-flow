"use client";

import { useEffect, useState } from "react";
import type { DirectoryPerson } from "@/components/recipient-selector";

export function SingleDirectoryPersonPicker({ fieldName = "secretaryId" }: { fieldName?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<DirectoryPerson | null>(null);
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
        setResults(payload.people.filter((person) => Boolean(person.department)));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);

  return <div className="recipient-picker">
    <label className="recipient-picker-label">Department Secretary</label>
    <p className="recipient-picker-hint">Select the staff member currently assigned to the department secretariat. Their department is taken from the authoritative directory profile.</p>
    {selected ? <div className="recipient-chips"><span className="recipient-chip"><span>{selected.name} · {selected.department}</span><button type="button" aria-label={`Remove ${selected.name}`} onClick={() => { setSelected(null); setQuery(""); }}>×</button><input type="hidden" name={fieldName} value={selected.id} /></span></div> : <>
      <input className="recipient-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, staff number or department…" autoComplete="off" />
      <div className="recipient-results">
        {loading ? <p className="recipient-empty">Searching the staff directory…</p> : null}
        {!loading && results.map((person) => <button className="recipient-result" type="button" key={person.id} onClick={() => { setSelected(person); setResults([]); }}><span className="recipient-avatar" aria-hidden="true">{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="recipient-identity"><strong>{person.name}</strong><small>{[person.staffNumber, person.position, person.department].filter(Boolean).join(" · ")}</small></span><span className="recipient-add">Select</span></button>)}
        {!loading && query.trim().length >= 2 && !results.length ? <p className="recipient-empty">No department-based staff member matches “{query}”.</p> : null}
      </div>
    </>}
  </div>;
}
