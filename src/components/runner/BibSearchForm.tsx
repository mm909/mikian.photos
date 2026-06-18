"use client";

import { useState } from "react";
import { useRunner } from "./RunnerProvider";
import { findRacerByName, ROSTER_EVENT_ID } from "@/lib/data";

/**
 * The bib/name search form — the single search "model" reused on the landing
 * page and in the empty-results state (so a runner who mistyped, or whose bib
 * isn't tagged yet, can search again without leaving the screen).
 *
 * Numeric input is treated as a bib; anything else is resolved to a bib via
 * the roster by name. On submit we run the search and call `onSearched`
 * (e.g. to advance the flow to the teaser).
 */
export function BibSearchForm({
  onSearched,
  autoFocus = false,
}: {
  onSearched?: () => void;
  autoFocus?: boolean;
}) {
  const { runSearch, activeEventId } = useRunner();
  const [query, setQuery] = useState("");
  const [err, setErr] = useState("");
  // Only the event with roster data (Lighthouse) supports name search.
  const nameSearch = activeEventId === ROSTER_EVENT_ID;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setErr(nameSearch ? "Enter your name or bib number." : "Enter your bib number.");
      return;
    }
    let bib = q;
    if (!/^\d+$/.test(q)) {
      const racer = nameSearch ? findRacerByName(q) : undefined;
      if (!racer) {
        setErr(
          nameSearch
            ? "No runner found by that name — try your bib number."
            : "Enter your bib number to search."
        );
        return;
      }
      bib = String(racer.bib);
    }
    setErr("");
    setQuery("");
    runSearch({ kind: "bib", value: bib });
    onSearched?.();
  }

  return (
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="bib-in">
        {nameSearch ? "Name or bib number" : "Bib number"}
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          id="bib-in"
          className="input"
          placeholder={nameSearch ? "e.g. your name or bib number" : "e.g. your bib number"}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (err) setErr("");
          }}
          autoFocus={autoFocus}
        />
        <button type="submit" className="btn btn--primary">
          Search
        </button>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>{err}</div>}
    </form>
  );
}
