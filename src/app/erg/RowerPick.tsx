"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import { fmtRowerNumber } from "@/lib/row100k";
import { setErgRower } from "./hub";

/* THE ROWER ON AN ERG, AS A SEARCH BOX (owner, 2026-09-23: "make the rower
 * selection a search box"). A hundred names in a select was a scroll; one
 * box that finds "bla" or "32" is a glance. It sits on the monitors row
 * beside the dots and in the console head under the name, and it is the
 * only door to setErgRower.
 *
 * Empty, it says ROWER… and the erg is the monitor on its own. Type and
 * the matches drop under it, best first; pick one by click, Enter or the
 * arrows and the box shows their number and name. A small cross clears.
 * Nothing here is a form: it writes straight to the hub, which repaints
 * every screen the erg is on.
 *
 * The list is the same ranking the profile search uses (RowerSearch.tsx):
 * a digit query is a rower number first, a name anywhere in a word after.
 * Number and name are the two public facts about every rower, and this
 * list prints nothing else. */

export type Roster = { rowerNumber: number; name: string }[];

const SHOWN = 8;

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function search(roster: Roster, query: string): Roster {
  const q = fold(query);
  if (!q) return [];
  const digits = /^[0-9]+$/.test(q);
  const hits: { r: Roster[number]; score: number }[] = [];
  for (const r of roster) {
    const pad = fmtRowerNumber(r.rowerNumber);
    const name = fold(r.name);
    let score: number | null = null;
    if (digits) {
      if (Number(q) === r.rowerNumber) score = 0;
      else if (pad.startsWith(q)) score = 1;
      else if (pad.includes(q)) score = 4;
    }
    const at = name.indexOf(q);
    if (at >= 0) {
      const wordStart = at === 0 || /[\s\-.']/.test(name.charAt(at - 1));
      const byName = wordStart ? 2 : 3;
      if (score === null || byName < score) score = byName;
    }
    if (score !== null) hits.push({ r, score });
  }
  hits.sort((a, b) => a.score - b.score || a.r.rowerNumber - b.r.rowerNumber);
  return hits.map((h) => h.r);
}

export function RowerPick({
  ergId,
  rower,
  roster,
  signedIn,
  onChanged,
}: {
  ergId: string;
  rower: { rowerNumber: number; name: string } | null;
  roster: Roster | null;
  signedIn: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const hits = useMemo(() => (open && roster ? search(roster, q).slice(0, SHOWN) : []), [open, roster, q]);
  const shown = open ? q : rower ? `${fmtRowerNumber(rower.rowerNumber)} · ${rower.name}` : "";

  const pick = (r: Roster[number] | null) => {
    setErgRower(ergId, r);
    setOpen(false);
    setQ("");
    setHi(0);
    box.current?.blur();
    onChanged?.();
  };

  const onKey = (ev: ReactKeyEvent<HTMLInputElement>) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      setOpen(false);
      box.current?.blur();
      return;
    }
    if (!open) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setHi((i) => Math.min(hits.length - 1, i + 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setHi((i) => Math.max(0, i - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const r = hits[hi] ?? (hits.length === 1 ? hits[0] : null);
      if (r) pick(r);
    }
  };

  const placeholder = !signedIn ? "Sign in to assign" : !roster ? "Roster…" : "Rower…";

  return (
    <div className={open ? "eg-rp eg-rp-open" : "eg-rp"} onKeyDown={onKey}>
      <input
        ref={box}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Rower on this erg"
        className="eg-rp-in"
        value={shown}
        placeholder={placeholder}
        disabled={!roster}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          setQ("");
          setHi(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(ev) => {
          setQ(ev.target.value);
          setHi(0);
        }}
      />
      {rower && !open ? (
        <button type="button" className="eg-rp-x" aria-label={`No rower on this erg (was ${rower.name})`} title="No rower" onClick={() => pick(null)}>
          ×
        </button>
      ) : null}
      {/* Hung under the box; mousedown is prevented so the pick lands
       * before the blur closes the list. */}
      {open ? (
        <ul className="eg-rp-list" id={listId} role="listbox">
          {q.trim() === "" ? (
            <li className="eg-rp-note">{roster && roster.length ? "NAME OR NUMBER" : "THE ROSTER IS EMPTY"}</li>
          ) : hits.length === 0 ? (
            <li className="eg-rp-note">NOBODY BY THAT NAME OR NUMBER</li>
          ) : (
            hits.map((r, i) => (
              <li key={r.rowerNumber} role="option" aria-selected={i === hi}>
                <button type="button" className={i === hi ? "eg-rp-row hi" : "eg-rp-row"} onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(r)}>
                  <span className="n">{fmtRowerNumber(r.rowerNumber)}</span>
                  <span className="nm">{r.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
