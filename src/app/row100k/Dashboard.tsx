"use client";

import Link from "next/link";
import { useMemo } from "react";
import { metersText, tokensFor } from "@/components/home/digits";
import { fmtRowerNumber, type Division, type RecordBadge, type SanityBand } from "@/lib/row100k";
import { type MyRow } from "./MyRows";
import { LogInPlace } from "./LogInPlace";

/* The signed-in rower's top of the front page (owner call, 2026-09-05:
 * "almost the same as mikianmusser.com"): their meters in the landing's
 * odometer look — eight digits with commas, room for ten million, the
 * leading zeros dimmed — tapping it opens their profile; then LOG A ROW
 * and SHARE (LogInPlace, the form opens right there); then who they are
 * as a line of newspaper text, not a bib card. The takeout-menu stats and
 * the progress bar moved to the profile. Still called Dashboard so the dev
 * preview and JoinSim keep their import.
 *
 * The number is the rower's OWN total, summed from their fresh rows on the
 * server: a blackout never masks you from yourself. Static digits — the
 * landing rolls because it polls; this page refreshes on write. */
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
  /* Blackout (blackoutRules.ts): this rower is in the elite fifteen right
   * now, read off the PUBLIC board by the page. Their own number stays on
   * the page; the cards draw `digits` blocks instead (share/cards.ts). */
  masked?: boolean;
  digits?: number;
  /* September days elapsed, so the curve and month cards stop at today. */
  days?: number;
  /* The did-you-mean-that band for the log form (sanity.ts). */
  sanity?: SanityBand;
  /* Dev preview only. */
  simulate?: boolean;
  simulateJustJoined?: boolean;
}) {
  const profileHref = `/row100k/r/${props.rowerNumber}`;

  const { byDay, longest } = useMemo(() => {
    const m: Record<string, number> = {};
    let longest = 0;
    for (const r of props.rows) {
      m[r.day] = (m[r.day] ?? 0) + r.meters;
      if (r.meters > longest) longest = r.meters;
    }
    return { byDay: m, longest };
  }, [props.rows]);

  const tokens = tokensFor(metersText(props.meters, 8));

  return (
    <div className="mine">
      <Link href={profileHref} className="my-od-link" aria-label="your stats">
        <div className="my-od" role="img" aria-label={`${props.meters.toLocaleString("en-US")} meters rowed`}>
          {tokens.map((t, i) => (
            <span
              key={i}
              className={`${t.sep ? "sep" : "cell"}${t.lead ? " lead" : ""}`}
              aria-hidden="true"
            >
              {t.ch}
            </span>
          ))}
        </div>
      </Link>
      <p className="my-unit mono">
        Meters · <b>you</b>
      </p>

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
        }}
        defaultDay={props.defaultDay}
        defaultTitle={props.defaultTitle}
        phase={props.phase}
        earlyAdmin={props.earlyAdmin}
        sanity={props.sanity}
        simulate={props.simulate}
        justJoined={props.simulateJustJoined}
      />

      <p className="front-id mono">
        ROWER {fmtRowerNumber(props.rowerNumber)} · {props.displayName.toUpperCase()}
        {props.instagram ? ` · @${props.instagram.toUpperCase()}` : ""}
      </p>
    </div>
  );
}
