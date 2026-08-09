"use client";

import { useMemo, useState } from "react";
import { LogRow } from "./LogRow";
import { MyRows, type MyRow } from "./MyRows";
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

/* Signed-in + joined: your bib (→ your profile), a takeout-menu stat list,
 * and the log form. Everything else — curve, heatmap, full log — lives on
 * the public profile page. */
export function Dashboard(props: {
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: Division;
  meters: number;
  sessions: number;
  bigDay: number;
  rows: MyRow[];
  defaultDay: string;
  phase: "before" | "open" | "closed";
  simulateOpen?: boolean;
}) {
  const [fixing, setFixing] = useState(false);
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
      days: b.total[0]?.days ?? 0,
      longest: b.longest[0]?.value ?? 0,
      fastest: RECORD_DISTANCES.map((d) => ({ d, s: b.fastest[d][0]?.value ?? null })),
    };
  }, [props.rows, props.displayName, props.division, props.rowerNumber, props.instagram]);

  const totalSeconds = props.rows.reduce((s, r) => s + r.seconds, 0);

  const menu: { k: string; val: string; tone?: "blue" | "dim" }[] = [
    { k: "Total meters", val: props.meters.toLocaleString("en-US"), tone: "blue" },
    { k: "Sessions", val: String(props.sessions) },
    { k: "Days rowed", val: String(bests.days) },
    { k: "Biggest day", val: props.bigDay > 0 ? fmtMeters(props.bigDay) : "—", tone: props.bigDay > 0 ? undefined : "dim" },
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
          <div className="ev">100K SEPTEMBER · 2026</div>
          <div className="num">{fmtRowerNumber(props.rowerNumber)}</div>
          <div className="nm">
            {props.displayName} · @{props.instagram}
          </div>
        </div>
      </a>
      <div className="bib-actions">
        <a className="share-btn" href={profileHref} style={{ textDecoration: "none", display: "inline-block" }}>
          My profile →
        </a>
      </div>

      <div className="grid2" style={{ marginTop: 22 }}>
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

      {props.phase === "before" && !props.simulateOpen ? (
        <p className="board-empty" style={{ marginTop: 26 }}>
          LOGGING OPENS SEP 1 — YOU&rsquo;RE IN.
        </p>
      ) : (
        <>
          <div className="rec-eyebrow" style={{ marginTop: 30 }}>Log a row</div>
          <LogRow defaultDay={props.defaultDay} phase={props.phase} simulate={props.simulateOpen} />
        </>
      )}

      {props.rows.length > 0 && (
        <p style={{ marginTop: 26 }}>
          <button type="button" className="quiet-btn" onClick={() => setFixing((v) => !v)}>
            {fixing ? "DONE FIXING" : "FIX A MISTAKE"}
          </button>
        </p>
      )}
      {fixing && <MyRows rows={props.rows} canDelete={props.phase !== "closed"} />}
    </div>
  );
}
