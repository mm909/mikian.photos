"use client";

import { useState } from "react";
import { useRunner } from "./RunnerProvider";
import { findRacerByName } from "@/lib/data";

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
  const { runSearch } = useRunner();
  const [query, setQuery] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setErr("Enter your name or bib number to search.");
      return;
    }
    let bib = q;
    if (!/^\d+$/.test(q)) {
      const racer = findRacerByName(q);
      if (!racer) {
        setErr("No runner found by that name — try your bib number.");
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
        Name or bib number
      </label>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          id="bib-in"
          className="input"
          placeholder="e.g. your name or bib number"
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
