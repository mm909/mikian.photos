"use client";

import { useEffect, useMemo, useState } from "react";
import { type MyRow } from "./MyRows";
import { ShareDialog } from "./ShareMenu";
import {
  GOAL_METERS,
  RECORD_DISTANCES,
  computeBoards,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  type Division,
} from "@/lib/row100k";

/* Signed-in + joined: your bib (→ your profile), the two actions that matter
 * — log a row, share a card — then a takeout-menu stat list. The log form
 * itself lives on your profile page (LogPanel); LOG A ROW links there. */
export function Dashboard(props: {
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: Division;
  meters: number;
  sessions: number;
  rows: MyRow[];
  phase: "before" | "open" | "closed";
  /* Board standing + record placements for the share cards — optional so the
   * dashboard still works when the cached board is unavailable. */
  rank?: { place: number; of: number } | null;
  records?: { key: string; label: string; place: number }[];
  /* Dev preview only: behave as if the join JUST happened (bib dialog pops). */
  simulateJustJoined?: boolean;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  // Set only when this dashboard just replaced the join form: JoinPanel
  // leaves a one-shot flag, and the dialog opens straight onto the bib card.
  const [preferredCardId, setPreferredCardId] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      if (props.simulateJustJoined || sessionStorage.getItem("row100k.justJoined") === "1") {
        sessionStorage.removeItem("row100k.justJoined");
        setPreferredCardId("rowtember-bib");
        setShareOpen(true);
      }
    } catch {
      /* storage blocked — no auto-open */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pct = Math.min(100, Math.round((props.meters / GOAL_METERS) * 100));
  const profileHref = `/row100k/r/${props.rowerNumber}`;

  // Reuse the board math on a board of one to get personal bests.
  const bests = useMemo(() => {
    const b = computeBoards(
      [
        {
          id: "me",
          displayName: props.displayName,
          division: props.division,
          rowerNumber: props.rowerNumber,
          instagram: props.instagram,
        },
      ],
      props.rows.map((r) => ({ participantId: "me", day: r.day, meters: r.meters, seconds: r.seconds })),
    );
    return {
      longest: b.longest[0]?.value ?? 0,
      fastest: RECORD_DISTANCES.map((d) => ({ d, s: b.fastest[d][0]?.value ?? null })),
    };
  }, [props.rows, props.displayName, props.division, props.rowerNumber, props.instagram]);

  const totalSeconds = props.rows.reduce((s, r) => s + r.seconds, 0);
  const byDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of props.rows) m[r.day] = (m[r.day] ?? 0) + r.meters;
    return m;
  }, [props.rows]);

  const menu: { k: string; val: string; tone?: "blue" | "dim" }[] = [
    { k: "Total meters", val: props.meters.toLocaleString("en-US"), tone: "blue" },
    { k: "Sessions", val: String(props.sessions) },
    { k: "Longest row", val: bests.longest > 0 ? fmtMeters(bests.longest) : "—", tone: bests.longest > 0 ? undefined : "dim" },
    {
      k: "Avg split",
      val: props.meters > 0 ? `${fmtSplit(props.meters, totalSeconds)} /500m` : "—",
      tone: props.meters > 0 ? undefined : "dim",
    },
    ...bests.fastest.map(({ d, s }) => ({
      k: `Fastest ${d / 1000}k`,
      val: s !== null ? fmtRecordTime(s) : "—",
      tone: s !== null ? undefined : ("dim" as const),
    })),
  ];

  return (
    <div>
      <a href={profileHref} style={{ textDecoration: "none", display: "block" }}>
        <div className="bib">
          <div className="pins"><i /><i /></div>
          <div className="ev">ROWTEMBER · 2026</div>
          <div className="num">{fmtRowerNumber(props.rowerNumber)}</div>
          <div className="nm">
            {props.displayName} · @{props.instagram}
          </div>
        </div>
      </a>

      <div className="act-row">
        <button
          type="button"
          className="big-act"
          onClick={() => {
            setPreferredCardId(undefined);
            setShareOpen(true);
          }}
        >
          Share a card
        </button>
        {props.phase !== "closed" && (
          <a className="big-act primary" href={`${profileHref}#log`}>
            Log a row
          </a>
        )}
      </div>

      <div className="grid2" style={{ marginTop: 26 }}>
        <ul className="menu">
          {menu.slice(0, Math.ceil(menu.length / 2)).map((m) => (
            <li key={m.k}>
              <span className="k">{m.k}</span>
              <span className="dots" />
              <span className={`val${m.tone ? ` ${m.tone}` : ""}`}>{m.val}</span>
            </li>
          ))}
        </ul>
        <ul className="menu">
          {menu.slice(Math.ceil(menu.length / 2)).map((m) => (
            <li key={m.k}>
              <span className="k">{m.k}</span>
              <span className="dots" />
              <span className={`val${m.tone ? ` ${m.tone}` : ""}`}>{m.val}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="me-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="me-bar-label">
        <span>{fmtMeters(props.meters)}</span>
        <span>
          {props.meters >= GOAL_METERS
            ? "100K — DONE. KEEP GOING."
            : `${fmtMeters(GOAL_METERS - props.meters)} TO GO`}
        </span>
      </div>

      <ShareDialog
        data={{
          displayName: props.displayName,
          rowerNumber: props.rowerNumber,
          instagram: props.instagram,
          meters: props.meters,
          sessions: props.sessions,
          byDay,
          division: props.division,
          longest: bests.longest,
          rank: props.rank,
          records: props.records,
        }}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        preferredCardId={preferredCardId}
      />
    </div>
  );
}
