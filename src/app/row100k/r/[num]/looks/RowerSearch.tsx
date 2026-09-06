"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import type { RosterRower } from "./view";

/* The nameplate, with the NAME as the way to find another rower (owner
 * ask, 2026-09-06: "let me tap on the name and search for someone").
 *
 * The whole head lives here rather than in pieces.tsx because the panel
 * has to be a sibling of the h1 — a div inside a headline is not a
 * headline — and the dateline still comes in from the server as children,
 * so this component owns the control and the panel and nothing else.
 *
 * The affordance is the account chip's, one size up: the name in ink with
 * a small water caret after it, no box and no button chrome, so the h1
 * still reads as the headline of the page. It is an INLINE span carrying
 * the button role, not a button element: a real button is an atomic
 * inline-block that cannot share a line with the number, so nine of the
 * ninety-seven names — Malaya Isabella Santos, Edgar Rodriguez — wrapped
 * onto a second line and grew the nameplate the moment it became a control
 * (review, 2026-09-06). A span flows with the number exactly as the plain
 * text did, and Enter and Space are wired by hand as the role requires.
 *
 * The panel is the account menu's (BarAccount.tsx): paper, a 2px ink
 * border, hung under its control, with a full-screen overlay behind it so
 * a click anywhere else closes it — its OWN overlay, under the sticky bar
 * rather than over it (theme.ts). Escape closes it and puts focus back on
 * the name; so does the click outside.
 *
 * BLACKOUT (blackoutRules.ts): the roster is numbers and names, which are
 * public for every rower including the hidden fifteen, and this list
 * prints nothing else. No meters, no time, no place, no tier — see
 * RosterRower, whose three fields are the entire contract. */

/* Case- and accent-insensitive: NFD splits an accent off its letter and
 * the combining marks are dropped, so JOSE finds José and José finds Jose. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* How many matches the panel shows before it says how many it is holding
 * back. Eight fills the panel on a phone without turning it into the
 * board. */
const SHOWN = 8;

type Hit = { rower: RosterRower; score: number };

/* Everyone the query finds, best match first. A digits-only query is read
 * as a rower number AND as a name (nobody is called 45, but the rule costs
 * nothing); anything else is a name search that matches anywhere in the
 * name, not just the start — "ROW" finds Rowan and Crowley both, with the
 * one whose name starts that way first.
 *
 * 0 the rower number exactly (45 and 045 are the same rower)
 * 1 the number the query starts    2 a name whose word starts the query
 * 3 the name anywhere              4 the number anywhere (145 for 45)
 */
function search(roster: RosterRower[], query: string): Hit[] {
  const q = fold(query);
  if (!q) return [];
  const digits = /^[0-9]+$/.test(q);
  const hits: Hit[] = [];
  for (const rower of roster) {
    const pad = fmtRowerNumber(rower.rowerNumber);
    const name = fold(rower.displayName);
    let score: number | null = null;
    if (digits) {
      if (Number(q) === rower.rowerNumber) score = 0;
      else if (pad.startsWith(q)) score = 1;
      else if (pad.includes(q)) score = 4;
    }
    const at = name.indexOf(q);
    if (at >= 0) {
      const wordStart = at === 0 || /[\s\-.']/.test(name.charAt(at - 1));
      const byName = wordStart ? 2 : 3;
      if (score === null || byName < score) score = byName;
    }
    if (score !== null) hits.push({ rower, score });
  }
  hits.sort((a, b) => a.score - b.score || a.rower.rowerNumber - b.rower.rowerNumber);
  return hits;
}

export function RowerSearch({
  rowerNumber,
  displayName,
  roster,
  children,
}: {
  /** The rower whose page this is — their number stays plain text. */
  rowerNumber: number;
  displayName: string;
  roster: RosterRower[];
  /** The dateline, rendered on the server (pieces.tsx). */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLSpanElement>(null);
  const box = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const router = useRouter();

  // Closing always hands focus back to the name, whichever way it closes,
  // so the keyboard never ends up on an element inside a hidden panel and
  // the next Tab carries on from the headline.
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };

  // Escape anywhere closes, the same way. The input takes focus the moment
  // the panel opens.
  useEffect(() => {
    if (!open) return;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Every open starts blank: the panel is a search, not a saved filter.
  // Shutting it from the control goes through close() like every other way
  // out, so focus lands back on the name rather than falling to the body
  // when the input it was sitting in is hidden.
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setQ("");
    setOpen(true);
  };

  // The span carries the button role, so the two keys a button answers to
  // are wired here. Space is prevented as well as handled: on a span it
  // would otherwise scroll the page out from under the panel.
  const onControlKey = (e: ReactKeyEvent<HTMLSpanElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  };

  const hits = useMemo(() => (open ? search(roster, q) : []), [open, roster, q]);
  const shown = hits.slice(0, SHOWN);
  const more = hits.length - shown.length;
  const typed = q.trim() !== "";
  const others = hits.filter((h) => h.rower.rowerNumber !== rowerNumber);

  // Enter lands the search when it can only mean one rower: the phone
  // keyboard says GO, and with a single name on screen it should go. It
  // does NOT guess. Taking the best match was one stray keystroke away
  // from a page nobody chose — after a single letter, with sixty-five
  // matches held back, Enter jumped to whoever the ranker put first
  // (review, 2026-09-06) — so it now waits until there is exactly one
  // rower to go to, this page aside.
  const onEnter = (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    if (others.length !== 1) return;
    e.preventDefault();
    setOpen(false);
    router.push(`/row100k/r/${others[0].rower.rowerNumber}`);
  };

  // What came back, for a screen reader: the list swaps in silently as you
  // type, so the count goes to a live region off-screen (theme.ts
  // .pf-find-sr). On the page the list itself is the answer.
  const said = !typed
    ? ""
    : hits.length === 0
      ? "No rowers match"
      : more > 0
        ? `${shown.length} of ${hits.length} rowers`
        : `${hits.length} rower${hits.length === 1 ? "" : "s"}`;

  return (
    <div className="pf-head">
      <h1 className="pf-name">
        <span className="num">{fmtRowerNumber(rowerNumber)}</span>{" "}
        <span
          ref={btn}
          role="button"
          tabIndex={0}
          className="pf-find-btn"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${displayName} — find another rower`}
          onClick={toggle}
          onKeyDown={onControlKey}
        >
          {displayName}
          <span className="pf-find-caret" aria-hidden="true">
            ▾
          </span>
        </span>
      </h1>
      {children}
      {open ? (
        <div className="pf-find-overlay" onClick={close} aria-hidden="true" />
      ) : null}
      {/* Always in the markup, hidden when shut: aria-controls has to point
          at something real, and the panel is part of the page, not a modal
          that arrives from somewhere else. */}
      <div className="pf-find" id={panelId} role="search" aria-label="Find a rower" hidden={!open}>
        <input
          ref={box}
          type="text"
          className="pf-find-in"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onEnter}
          placeholder="NAME OR NUMBER"
          aria-label="Find a rower by name or number"
          autoComplete="off"
          spellCheck={false}
        />
        {/* Nothing under the field until you type: the placeholder already
            says NAME OR NUMBER, and a line repeating it back is the
            explanatory copy the page does without (review, 2026-09-06). */}
        {roster.length === 0 ? (
          <p className="pf-find-note">THE ROSTER COULD NOT BE READ.</p>
        ) : typed && shown.length === 0 ? (
          <p className="pf-find-note">NOBODY BY THAT NAME OR NUMBER.</p>
        ) : shown.length === 0 ? null : (
          <ul className="pf-find-list">
            {shown.map(({ rower }) =>
              rower.rowerNumber === rowerNumber ? (
                /* The rower whose page this is: kept in the list, because a
                 * search for your own name that comes back empty reads as a
                 * fault, but not a link to where you already are. */
                <li key={rower.rowerNumber}>
                  <span className="pf-find-row self">
                    <span className="n">{fmtRowerNumber(rower.rowerNumber)}</span>
                    <span className="nm">{rower.displayName}</span>
                    <span className="tag">THIS PAGE</span>
                  </span>
                </li>
              ) : (
                <li key={rower.rowerNumber}>
                  <Link
                    className="pf-find-row"
                    href={`/row100k/r/${rower.rowerNumber}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="n">{fmtRowerNumber(rower.rowerNumber)}</span>
                    <span className="nm">{rower.displayName}</span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
        {more > 0 ? <p className="pf-find-more">{more} MORE — KEEP TYPING</p> : null}
        <p className="pf-find-sr" aria-live="polite">
          {said}
        </p>
      </div>
    </div>
  );
}
