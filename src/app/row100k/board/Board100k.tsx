"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GOAL_METERS, fmtRowerNumber } from "@/lib/row100k";
import { BlockShape, Blocks } from "../Blackout";

/* THE 100K BOARD, drawn (see page.tsx). The server hands the month, the
 * count, the listed rows in board order, the four tiers and who is
 * looking; this draws the page under the site bar — the dateline with its
 * day cells, the strip, the ruled table with a bar behind every row, the
 * dashed line for a rower not yet in, and the sheet — and makes the one
 * call:
 *
 *   OPT IN   POST /api/row100k/month-optin
 *
 * THERE IS NO WAY OUT (owner, 2026-10-01: "don't include not this month.
 * There's no opt out. Once you opt in, you're opted in"). The sheet's
 * second word is SEE THE BOARD, which only closes it.
 *
 * OPT IN puts the rower's row on the board at once, at its place, and
 * bumps the count; the route refresh that follows brings the server's list
 * and the two agree. The sheet opens on its own for a signed-in rower who
 * is on the roster but not on this month's board, once per month per
 * browser (a localStorage note written when it is closed). */

export type BoardRow = {
  rowerNumber: number;
  name: string;
  /* What the page may print: the real total, the tier floor on a hidden
   * row, the digits still showing in the run-up (blackoutRules.ts). */
  meters: number;
  /* Lights out: this many blocks instead of the number, and no bar. */
  blocks?: number;
  /* The run-up: "142,###" — the digits showing, a block for each covered
   * (blackoutRules.partialShape). No bar either: its width is the tail. */
  shape?: string;
  /* One of the hidden: no place is printed (a place is a number too). */
  unranked: boolean;
  me: boolean;
};

/* Highest first. `floor` is the meters the tier starts at; WARMING UP is 0. */
export type BoardTier = { key: string; title: string; floor: number };

export type BoardMe = {
  rowerNumber: number;
  name: string;
  meters: number;
  in: boolean;
  unranked: boolean;
  blocks?: number;
  shape?: string;
};

type Reply = { ok?: boolean; in?: boolean; error?: string };
type Placed = BoardRow & { rank: number | null };
/* Where OPT IN was pressed: a refusal is printed there, not a screen away. */
type Ask = "strip" | "gap";
type Block = { kind: "gap" } | { kind: "tier"; tier: BoardTier; items: (Placed | "gap")[] };

const ASKED = (month: string) => `row100k.b100k.asked.${month}`;
const SORRY = "Could not take that. Try again.";
const num = (n: number) => Math.round(n).toLocaleString("en-US");

/* Where a rower with these meters lands in the board's order: ahead of the
 * first ranked row with fewer. The hidden lead the list, in an order that
 * says nothing, so one of them goes to the front. */
function placeOf(rows: BoardRow[], meters: number, unranked: boolean): number {
  if (unranked) return 0;
  const i = rows.findIndex((r) => !r.unranked && r.meters < meters);
  return i === -1 ? rows.length : i;
}

export function Board100k({
  month,
  count: count0,
  rows: rows0,
  tiers,
  unreadable,
  signedIn,
  me,
  signInHref,
}: {
  /* label "October 2026", name "October" ("Rowtember" in September — the
   * challenge's name), word "October" (the calendar month, always). */
  month: { key: string; label: string; name: string; word: string; days: number; day: number };
  count: number;
  rows: BoardRow[];
  tiers: BoardTier[];
  unreadable: boolean;
  signedIn: boolean;
  me: BoardMe | null;
  signInHref: string;
}) {
  const router = useRouter();
  const [inNow, setInNow] = useState(me?.in ?? false);
  const [count, setCount] = useState(count0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ at: Ask; say: string } | null>(null);
  const [asked, setAsked] = useState(false);
  /* Set by a successful OPT IN: the new row is brought into view once. */
  const [landed, setLanded] = useState(false);
  const mineRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // The server's answer wins whenever it changes (the refresh after OPT IN).
  useEffect(() => {
    setInNow(me?.in ?? false);
    setCount(count0);
  }, [me?.in, count0]);

  /* The sheet, once per month per browser, for a rower on the roster who
   * is not on this month's board. */
  const onRoster = me !== null;
  const meIn = me?.in ?? false;
  useEffect(() => {
    if (!onRoster || meIn || unreadable) return;
    try {
      if (localStorage.getItem(ASKED(month.key)) === "1") return;
    } catch {
      /* storage blocked — ask anyway */
    }
    const t = setTimeout(() => setAsked(true), 400);
    return () => clearTimeout(t);
  }, [onRoster, meIn, month.key, unreadable]);
  /* Open only while the rower is still out: OPT IN on the strip, pressed
   * before the sheet arrives, means there is nothing left to ask. */
  const sheet = asked && !inNow;

  const closeSheet = useCallback(() => {
    try {
      localStorage.setItem(ASKED(month.key), "1");
    } catch {
      /* fine */
    }
    setAsked(false);
  }, [month.key]);

  // Open, the sheet takes the focus (the panel itself, so no ring is drawn
  // until Tab is pressed) and Escape closes it; closed, the focus goes
  // back where it was.
  useEffect(() => {
    if (!sheet) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [sheet, closeSheet]);

  // Tab stays inside the sheet while it is open.
  const trap = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab") return;
    const stops = sheetRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)");
    if (!stops || stops.length === 0) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === sheetRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* OPT IN, for a rower on the roster. A stranger and an account that
   * never joined get a link instead (below), not this. The row goes on the
   * board and the count goes up on the press, before the answer; a refusal
   * takes both back and says so where it was pressed — under the strip, or
   * under the dashed line, which can be sixty rows down the page from the
   * strip (review, 2026-10-01: pressed there, the row came and went and the
   * one line that said why was off the screen). */
  const optIn = async (at: Ask) => {
    if (busy || !me || inNow) return;
    setBusy(true);
    setErr(null);
    setInNow(true);
    setCount((c) => c + 1);
    setAsked(false);
    setLanded(true);
    const undo = (why: string) => {
      setLanded(false);
      setInNow(false);
      setCount((c) => Math.max(0, c - 1));
      setErr({ at, say: why });
    };
    try {
      const res = await fetch("/api/row100k/month-optin", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Reply;
      if (res.ok && data.ok) router.refresh();
      else if (res.status === 401) {
        // The session ran out under the page: sign in and come back here.
        window.location.href = signInHref;
      } else undo(data.error ?? SORRY);
    } catch {
      undo(SORRY);
    }
    setBusy(false);
  };

  /* THE LIST: the server's, plus the viewer's own row at its place from
   * the moment OPT IN lands until the refresh hands the same row back. */
  const rows = useMemo<BoardRow[]>(() => {
    if (!me || !inNow || rows0.some((r) => r.me)) return rows0;
    const mine: BoardRow = {
      rowerNumber: me.rowerNumber,
      name: me.name,
      meters: me.meters,
      blocks: me.blocks,
      shape: me.shape,
      unranked: me.unranked,
      me: true,
    };
    const at = placeOf(rows0, me.meters, me.unranked);
    return [...rows0.slice(0, at), mine, ...rows0.slice(at)];
  }, [rows0, me, inNow]);

  /* THE BLOCKS: the tiers, highest first, and ONLY the ones somebody on the
   * board is in (owner, 2026-10-01: "if someone is not in that tier yet,
   * then we do not show the tier ... right now, since I'm the only one, I
   * should see just warming up") — no lock line, no empty head. Places run
   * down the whole list, not per tier. The dashed line for a rower who is
   * not in sits where their row would: inside their tier when it prints,
   * otherwise ahead of the first tier below theirs, otherwise last. */
  const blocks = useMemo<Block[]>(() => {
    const placed: Placed[] = rows.map((r, i) => ({ ...r, rank: r.unranked ? null : i + 1 }));
    const gapFor = me && !inNow && !unreadable ? me : null;
    const myTier = gapFor ? (tiers.find((t) => gapFor.meters >= t.floor) ?? tiers[tiers.length - 1]) : null;
    let gapDone = gapFor === null;
    const out: Block[] = [];
    tiers.forEach((t, ti) => {
      const ceil = ti === 0 ? Infinity : tiers[ti - 1].floor;
      const inTier = placed.filter((r) => r.meters >= t.floor && r.meters < ceil);
      if (!gapDone && myTier && t.floor < myTier.floor) {
        out.push({ kind: "gap" });
        gapDone = true;
      }
      if (inTier.length === 0) return;
      const mineHere = !gapDone && myTier?.key === t.key;
      const items: (Placed | "gap")[] = [];
      for (const r of inTier) {
        if (mineHere && !gapDone && gapFor && !r.unranked && r.meters < gapFor.meters) {
          items.push("gap");
          gapDone = true;
        }
        items.push(r);
      }
      if (mineHere && !gapDone) {
        items.push("gap");
        gapDone = true;
      }
      out.push({ kind: "tier", tier: t, items });
    });
    if (!gapDone) out.push({ kind: "gap" });
    return out;
  }, [rows, tiers, me, inNow, unreadable]);

  // The row that just landed: into view, and the focus on its name (the
  // control that was pressed is gone).
  useEffect(() => {
    if (!landed) return;
    const el = mineRef.current;
    if (!el) return;
    setLanded(false);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    el.querySelector("a")?.focus({ preventScroll: true });
  }, [landed, blocks]);

  const any = rows.length > 0;

  /* The dashed line. On an empty board there is no column to sit in, so
   * the words start on the measure (.solo). */
  const gap = (key: string): ReactNode => (
    <div key={key} className="bd-ask" role="row">
      <div role="cell">
        <button type="button" className={any ? "bd-gap" : "bd-gap solo"} onClick={() => void optIn("gap")} disabled={busy}>
          <span>Opt in to be on this board</span>
        </button>
        {err?.at === "gap" ? (
          <p className="bd-say at" role="alert">
            {err.say}
          </p>
        ) : null}
      </div>
    </div>
  );

  const row = (r: Placed): ReactNode => {
    const hidden = r.blocks != null || r.shape != null;
    /* The share of 100,000 m, as a share of the track (board100kCss.ts:
     * the row less the figures). */
    const share = Math.min(1, r.meters / GOAL_METERS);
    const left = GOAL_METERS - r.meters;
    return (
      <div
        key={r.rowerNumber}
        ref={r.me ? mineRef : undefined}
        className={r.me ? "bd-row me" : "bd-row"}
        role="row"
        aria-current={r.me ? "true" : undefined}
      >
        {!hidden && (
          <span
            className="bd-bar"
            style={{ width: `calc((100% - var(--bd-figs)) * ${share.toFixed(4)})` }}
            aria-hidden="true"
          />
        )}
        <div className="bd-in" role="presentation">
          <span className="bd-rk" role="cell">
            {r.rank ?? ""}
          </span>
          <span className="bd-who" role="cell">
            <span className="n">{fmtRowerNumber(r.rowerNumber)} · </span>
            <a href={`/r/${r.rowerNumber}`}>{r.name}</a>
          </span>
          <span className="bd-num" role="cell">
            {r.blocks != null ? (
              <Blocks digits={r.blocks} />
            ) : r.shape != null ? (
              <BlockShape shape={r.shape} label="partly hidden" />
            ) : (
              num(r.meters)
            )}
          </span>
          <span className="bd-num bd-togo" role="cell">
            {!hidden && left > 0 ? num(left) : ""}
          </span>
        </div>
      </div>
    );
  };

  const showGap = blocks.some((b) => b.kind === "gap" || b.items.includes("gap"));

  return (
    <main className="bd">
      <div className="wrap front">
        <h1 className="bd-date">
          <b>{month.label}</b>
          <span>
            Day {month.day} of {month.days}
          </span>
        </h1>
        <div className="bd-days" role="img" aria-label={`Day ${month.day} of ${month.days}`}>
          {Array.from({ length: month.days }, (_, i) => (
            <i key={i} className={i < month.day ? "on" : undefined} />
          ))}
        </div>

        <div className="bd-strip">
          {/* No count over a board that could not be read: "0 in" would
              be a number nobody counted. */}
          <span className="t">{unreadable ? `The ${month.name} 100K` : `The ${month.name} 100K · ${count} in`}</span>
          {inNow || unreadable ? null : me ? (
            <button type="button" className="bd-ctl" onClick={() => void optIn("strip")} disabled={busy}>
              Opt in
            </button>
          ) : (
            /* A stranger signs in and comes back here; an account that
             * never joined joins first, on the sign-up page (/join). */
            <Link className="bd-ctl" href={signedIn ? "/join" : signInHref}>
              Opt in
            </Link>
          )}
        </div>
        {err?.at === "strip" ? (
          <p className="bd-say" role="alert">
            {err.say}
          </p>
        ) : null}

        {unreadable ? (
          <p className="bd-say" role="alert">
            The board could not be read. Try again.
          </p>
        ) : (
          <div className="bd-table" role="table" aria-label={`The ${month.name} 100K board`}>
            {any ? (
              <div role="rowgroup">
                <div className="bd-cols" role="row">
                  <span role="columnheader">#</span>
                  <span role="columnheader">Rower</span>
                  <span role="columnheader" className="bd-num">
                    Meters
                  </span>
                  <span role="columnheader" className="bd-num bd-togo">
                    To go
                  </span>
                </div>
              </div>
            ) : null}
            {blocks.map((b, i) =>
              b.kind === "gap" ? (
                <div key={`gap-${i}`} role="rowgroup">
                  {gap("gap")}
                </div>
              ) : (
                <div key={b.tier.key} role="rowgroup">
                  <div role="row">
                    <div role="cell">
                      <h2 className="bd-tier">{b.tier.title}</h2>
                    </div>
                  </div>
                  {b.items.map((it) => (it === "gap" ? gap("gap") : row(it)))}
                </div>
              ),
            )}
            {/* An empty month: one plain line (a rower who could be the
                first gets the dashed line instead). */}
            {!any && !showGap ? (
              <div role="row">
                <div role="cell">
                  <p className="bd-none">Nobody is in yet</p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* THE SHEET: the first-visit ask, over the board. */}
      <div className={sheet ? "bd-scrim on" : "bd-scrim"} onClick={closeSheet} aria-hidden="true" />
      <section
        ref={sheetRef}
        className={sheet ? "bd-sheet on" : "bd-sheet"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-ask"
        aria-hidden={!sheet}
        tabIndex={-1}
        onKeyDown={trap}
      >
        <h2 id="bd-ask">
          Row {num(GOAL_METERS)} meters in <i>{month.word}</i>
        </h2>
        <p>
          Your {month.word} rows count toward it. You are on the board.
        </p>
        <div className="bd-acts">
          <button type="button" className="bd-ctl big" onClick={() => void optIn("strip")} disabled={busy}>
            Opt in
          </button>
          <button type="button" className="bd-quiet" onClick={closeSheet}>
            See the board
          </button>
        </div>
      </section>
    </main>
  );
}
