"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { metersText, tokensFor } from "@/components/home/digits";
import { fmtRowerNumber, type Division, type RecordBadge, type SanityBand } from "@/lib/row100k";
import { type MyRow } from "./MyRows";
import { LogInPlace } from "./LogInPlace";
import type { ShareData } from "./share/cards";
import { ROLL_COOKIE, type Roll } from "./roll";
import { LOGGED_EVENT, LOOP_BEAT_MS, LOOP_COUNT_MS, easeOut, reducedMotion, type LoggedDetail, type LoopData } from "./loop";
import { LoopRank } from "./LoopRank";

/* THE ROLL-DOWN (owner, 2026-10-01, the first morning of a new month): "when
 * everyone first logs in on the new month, animate the number they look at
 * — their total — down to zero." The wheels start on last month's total and
 * run down to this month's number, once per rower per month. The page
 * decides whether this visit rolls (ROLL_COOKIE unset for this month, see
 * page.tsx) and renders the OLD number, so the first paint is the number
 * they ended on — no flash of zero before the script lands — and the
 * client runs it down, then writes the cookie so the next visit is static. */
const ROLL_MS = 3200;

function rolled(cookie: string) {
  document.cookie = `${ROLL_COOKIE}=${cookie}; path=/; max-age=${60 * 60 * 24 * 45}; samesite=lax`;
}

/* THE BIG NUMBER of the front page: the landing counter's wheels (Home.tsx
 * .od geometry, theme.ts .my-od), static, the leading zeros dimmed. Seven
 * wheels for a rower's own month, eight for everyone together (owner,
 * 2026-09-25, signed out: "the big number is the month's total meters,
 * like mikianmusser.com's counter head, dimmed leading wheels are fine but
 * static"). With `href` the number is a link with no chrome of its own.
 * With `roll` the wheels open on `roll.from` and run down to `meters`. */
export function Wheels({
  meters,
  digits,
  href,
  label,
  roll,
  loop,
}: {
  meters: number;
  digits: 7 | 8;
  href?: string;
  /* The link's accessible name — where tapping the number goes. */
  label?: string;
  roll?: Roll;
  /* THE LOOP (loop.ts): a saved row (LOGGED_EVENT) runs the wheels UP by
   * its meters — a beat after the sheet closes, over LOOP_COUNT_MS, easing
   * out — before the refresh lands with the same number. */
  loop?: boolean;
}) {
  const [shown, setShown] = useState(roll ? roll.from : meters);
  // Primitives, so a re-render with a fresh `roll` object does not restart
  // a roll already in flight.
  const from = roll?.from;
  const cookie = roll?.cookie;

  /* THE COUNT-UP. `bump` is the run asked for; `running` keeps the prop
   * effect below from snapping the wheels to the refreshed total while the
   * run is still in flight (the run ends on that same number). */
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const running = useRef(false);
  const [bump, setBump] = useState<{ from: number; to: number; n: number } | null>(null);
  useEffect(() => {
    if (!loop) return;
    const on = (e: Event) => {
      const add = (e as CustomEvent<LoggedDetail>).detail?.meters ?? 0;
      if (!(add > 0)) return;
      setBump((b) => ({ from: shownRef.current, to: shownRef.current + add, n: (b?.n ?? 0) + 1 }));
    };
    window.addEventListener(LOGGED_EVENT, on);
    return () => window.removeEventListener(LOGGED_EVENT, on);
  }, [loop]);
  useEffect(() => {
    if (!bump) return;
    if (reducedMotion()) {
      setShown(bump.to);
      return;
    }
    running.current = true;
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / LOOP_COUNT_MS);
      setShown(Math.round(bump.from + (bump.to - bump.from) * easeOut(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
      else running.current = false;
    };
    const wait = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, LOOP_BEAT_MS);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(raf);
      running.current = false;
    };
  }, [bump]);

  useEffect(() => {
    if (from === undefined || cookie === undefined) {
      if (!running.current) setShown(meters);
      return;
    }
    // Reduced motion: land on the number and remember the month as rolled.
    if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(meters);
      rolled(cookie);
      return;
    }
    const delta = meters - from;
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = Math.min(1, (now - t0) / ROLL_MS);
      // Ease in and out: the wheels gather speed, then settle on the number.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setShown(Math.round(from + delta * e));
      if (t < 1) raf = requestAnimationFrame(tick);
      else rolled(cookie);
    };
    // A beat on the old number first, so it registers before it moves.
    const wait = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(raf);
    };
  }, [from, cookie, meters]);

  const tokens = tokensFor(metersText(shown, digits));
  const od = (
    <div className="my-od" role="img" aria-label={`${meters.toLocaleString("en-US")} meters rowed`}>
      {tokens.map((t, i) => (
        <span key={i} className={`${t.sep ? "sep" : "cell"}${t.lead ? " lead" : ""}`} aria-hidden="true">
          {t.ch}
        </span>
      ))}
    </div>
  );
  return href ? (
    <Link href={href} className="my-od-link" aria-label={label}>
      {od}
    </Link>
  ) : (
    od
  );
}

/* Meters per day and the longest row, off a rower's month — what the share
 * cards need beyond the totals (share/cards.ts). The front page computes
 * the same on the server (page.tsx) for the form it mounts under the
 * counter row; a client module cannot lend it a function. */
function shareSummary(rows: MyRow[]): { byDay: Record<string, number>; longest: number } {
  const byDay: Record<string, number> = {};
  let longest = 0;
  for (const r of rows) {
    byDay[r.day] = (byDay[r.day] ?? 0) + r.meters;
    if (r.meters > longest) longest = r.meters;
  }
  return { byDay, longest };
}

/* The signed-in rower's top of the front page (owner call, 2026-09-05:
 * "almost the same as mikianmusser.com"): their meters in the landing's
 * odometer look — seven digits with commas, the leading zeros dimmed —
 * tapping it opens their profile; then one line saying whose number it is.
 * Since the owner's review (2026-09-25) that line is the unit line itself,
 * "METERS · ROWER 095 · MIKIAN MUSSER": no id line under it, no Instagram
 * handle ("remove the @"), and no SHARE word anywhere on the landing. The
 * takeout-menu stats and the progress bar moved to the profile. Still
 * called Dashboard so the dev preview and JoinSim keep their import.
 *
 * The number is the rower's OWN total, summed from their fresh rows on the
 * server: a blackout never masks you from yourself. Static digits — the
 * landing rolls because it polls; this page refreshes on write.
 *
 * `bare` (the front page): the number and the line only. The log form and
 * the share dialog (LogInPlace) are mounted by the page under the counter
 * row — owner, 2026-09-25: "when I click LOG A ROW the form opens ABOVE the
 * button; it should open BELOW the cells bar". Without `bare` (the dev
 * preview) the form still opens right here. */
export function Dashboard(props: {
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: Division;
  meters: number;
  sessions: number;
  rows: MyRow[];
  phase: "before" | "open" | "closed";
  /* Board standing + record placements (to #10, with display values) for the
   * share cards — optional so the block still works when the cached board
   * is unavailable. */
  rank?: { place: number; of: number } | null;
  records?: RecordBadge[];
  /* Prefills for the log form (LogRow). */
  defaultDay?: string;
  defaultTitle?: string;
  earlyAdmin?: boolean;
  /* Blackout (blackoutRules.ts): this rower is in the elite right
   * now, read off the PUBLIC board by the page. Their own number stays on
   * the page; the cards draw `digits` blocks instead (share/cards.ts). */
  masked?: boolean;
  digits?: number;
  /* September days elapsed, so the curve and month cards stop at today. */
  days?: number;
  /* The did-you-mean-that band for the log form (sanity.ts). */
  sanity?: SanityBand;
  /* RACE DAY with the rower's own told wave on it (shareables/waveShare.ts)
   * — unlocks MY WAVE in the share dialog. Absent until the wave note has
   * gone out. */
  race?: ShareData["race"];
  /* Dev preview only. */
  simulate?: boolean;
  simulateJustJoined?: boolean;
  /* The front page: the number and its line only (see above). */
  bare?: boolean;
  /* First visit of a new month: open on last month's total and run down. */
  roll?: Roll;
  /* THE LOOP (loop.ts): the wheels count up on a saved row and the place
   * line under the number ticks (LoopRank.tsx). Absent: static, as before. */
  loop?: LoopData;
}) {
  const profileHref = `/row100k/r/${props.rowerNumber}`;
  const { byDay, longest } = useMemo(() => shareSummary(props.rows), [props.rows]);

  return (
    <div className="mine">
      {/* Seven wheels, not the landing's eight: nobody rows ten million
        * meters in a month, and the empty ten-millions digit read as noise
        * (owner, 2026-09-05). Room for 9,999,999 stays. */}
      <Wheels meters={props.meters} digits={7} href={profileHref} label="your stats" roll={props.roll} loop={props.loop != null} />
      <p className="my-unit mono">
        Meters ·{" "}
        <b>
          rower {fmtRowerNumber(props.rowerNumber)} · {props.displayName}
        </b>
      </p>
      {props.loop ? <LoopRank loop={props.loop} me={props.rowerNumber} meters={props.meters} name={props.displayName} /> : null}

      {props.bare ? null : (
        <LogInPlace
          share={{
            displayName: props.displayName,
            rowerNumber: props.rowerNumber,
            instagram: props.instagram,
            meters: props.meters,
            sessions: props.sessions,
            byDay,
            division: props.division,
            longest,
            rank: props.rank,
            records: props.records,
            days: props.days,
            masked: props.masked,
            digits: props.digits,
            race: props.race,
          }}
          defaultDay={props.defaultDay}
          defaultTitle={props.defaultTitle}
          phase={props.phase}
          earlyAdmin={props.earlyAdmin}
          sanity={props.sanity}
          simulate={props.simulate}
          justJoined={props.simulateJustJoined}
        />
      )}
    </div>
  );
}
