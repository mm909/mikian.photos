"use client";

import { useEffect } from "react";
import { fmtPace } from "@/lib/pm5/pm5";
import { lockBody, unlockBody } from "./charts";
import { DEFAULT_GOAL_M, type Erg } from "./hub";
import { laneRows, type Lane } from "./RaceBoard";
import { tvCss } from "./tvCss";

/* THE RACE BOARD ON THE TELEVISION (owner, 2026-09-21: "race board looks
 * good but this will be on a full screen monitor, give me a view that would
 * go on a TV. Give me 3 different looks for what this page could look
 * like").
 *
 * THE SAME LANES AS THE DESK BOARD — laneRows() in RaceBoard.tsx — so the
 * wall and the laptop can never disagree. Everything else is different: it
 * fills the screen (a fixed overlay, so the site bar and the footer never
 * enter the picture and nothing under it remounts), it sizes every letter
 * against the screen in vh, and nothing on it is a button to press with a
 * mouse, because a wall has no mouse. The controls — back, the three
 * looks, full screen — sit in a strip that shows under the pointer only.
 *
 * THREE LOOKS, one root class each, the keys 1 2 3 or ?board=tv&look=a|b|c:
 *
 *   A  THE SCOREBOARD — a stadium board. One row per lane, the four
 *      numbers in columns under a header row, the leader inverted white.
 *      The densest of the three: every number for every lane, always.
 *   B  THE LANES — a regatta. Each lane is a track from 0 to the 5,000 m
 *      line with a kilometre grid behind it; the fill is where they are,
 *      the number rides its bow. The GAP is read off the picture, not a
 *      column, and pace and expected finish sit small at the far end.
 *   C  THE BROADCAST — TV graphics. The leader is the picture: name, the
 *      metres huge, pace, expected, rate. The field is the standings list
 *      beside it, each with seconds behind and a thin bar.
 *
 * THE CLOCK is the longest elapsed on any lane, which is the race clock
 * when everybody started together and the honest number when they did not.
 * Every lane is read against DEFAULT_GOAL_M, as on the desk board. */

export type TvLook = "a" | "b" | "c";

export const TV_LOOKS: { key: TvLook; label: string; note: string }[] = [
  { key: "a", label: "Scoreboard", note: "Stadium board: one row per lane, every number in a column, the leader inverted." },
  { key: "b", label: "Lanes", note: "A regatta: each lane is a track to the 5,000 m line, the fill is where they are." },
  { key: "c", label: "Broadcast", note: "TV graphics: the leader as the picture, the field as the standings beside them." },
];

export function parseTvLook(v: string | null | undefined): TvLook | null {
  return v === "a" || v === "b" || v === "c" ? v : null;
}

const GOAL = DEFAULT_GOAL_M;
const GOAL_WORD = `${GOAL.toLocaleString("en-US")} M`;

function metresWord(l: Lane): string {
  return l.hasData ? Math.floor(l.m).toLocaleString("en-US") : "—";
}

function paceWord(l: Lane): string {
  return l.pace ? fmtPace(l.pace) : "—";
}

/* mm:ss for the race clock — whole seconds, a wall does not need tenths. */
function clockWord(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const m = Math.floor(t / 60);
  const r = t % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/* The gap, as the wall says it: the leader has none, a finished lane has
 * a finish, everyone else is +seconds at their own pace. */
function gapWord(l: Lane): string {
  if (l.rank === 0) return "LEADER";
  if (l.done) return "FIN";
  return l.behindS > 0 ? `+${l.behindS.toFixed(1)}` : "—";
}

export function RaceBoardTv({ ergs, look, onLook, onExit }: { ergs: Erg[]; look: TvLook; onLook: (l: TvLook) => void; onExit: () => void }) {
  const lanes = laneRows(ergs, GOAL);
  const clockS = lanes.reduce((best, l) => Math.max(best, l.elapsedS), 0);

  /* The page under the overlay must not scroll under a wheel on the wall,
   * and the keys are the whole remote: Escape leaves, 1 2 3 pick a look,
   * F fills the screen. */
  useEffect(() => {
    lockBody();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onExit();
      } else if (ev.key === "1" || ev.key === "2" || ev.key === "3") {
        onLook(ev.key === "1" ? "a" : ev.key === "2" ? "b" : "c");
      } else if (ev.key === "f" || ev.key === "F") {
        fullScreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockBody();
    };
  }, [onExit, onLook]);

  return (
    <div className={`eg-tv eg-tv-${look}`} role="dialog" aria-modal="true" aria-label="Race board on the TV">
      <style>{tvCss}</style>
      {lanes.length === 0 ? (
        <div className="tv-empty">
          <b>No lanes yet</b>
          <span>Pair an erg on the monitors page and it appears here as a lane</span>
        </div>
      ) : look === "a" ? (
        <Scoreboard lanes={lanes} clockS={clockS} />
      ) : look === "b" ? (
        <Lanes lanes={lanes} clockS={clockS} />
      ) : (
        <Broadcast lanes={lanes} clockS={clockS} />
      )}

      <div className="eg-tv-ctl">
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onExit}>
          Back
        </button>
        <span className="k">Look</span>
        {TV_LOOKS.map((o, i) => (
          <button
            type="button"
            key={o.key}
            className={o.key === look ? "eg-btn on" : "eg-btn eg-btn-quiet"}
            onClick={() => onLook(o.key)}
            title={`${i + 1} · ${o.note}`}
            aria-pressed={o.key === look}
          >
            {i + 1} {o.label}
          </button>
        ))}
        <button type="button" className="eg-btn eg-btn-quiet" onClick={fullScreen}>
          Full screen
        </button>
      </div>
    </div>
  );
}

/* Fullscreen is a request the browser may refuse (not a user gesture, an
 * iframe, a television browser without it) — refused is fine, the overlay
 * already fills the window. */
function fullScreen() {
  try {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen();
  } catch {
    /* no fullscreen here */
  }
}

/* ---- LOOK A — THE SCOREBOARD -------------------------------------------- */

function Scoreboard({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-a">
      <header className="tv-a-head">
        <span className="tv-a-title">Race board</span>
        <span className="tv-a-meta">
          {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · {GOAL_WORD} · LIVE
        </span>
        <span className="tv-a-clock">{clockWord(clockS)}</span>
      </header>
      <div className="tv-a-cols" aria-hidden="true">
        <span />
        <span>Lane</span>
        <span>Metres</span>
        <span>/500m</span>
        <span>Finish</span>
        <span>Behind</span>
      </div>
      <ol className="tv-a-rows">
        {lanes.map((l) => (
          <li key={l.id} className={l.rank === 0 ? "lead" : ""}>
            <span className="p">{l.rank + 1}</span>
            <span className="who">
              <span className="nm">{l.name}</span>
              <span className="tv-a-bar" aria-hidden="true">
                <span style={{ width: `${l.pct}%` }} />
              </span>
            </span>
            <span className="v">
              {metresWord(l)}
              <span className="s">of {GOAL_WORD}</span>
            </span>
            <span className="v">
              {paceWord(l)}
              <span className="s">{l.avgPace ? `avg ${fmtPace(l.avgPace)}` : ""}</span>
            </span>
            <span className="v">
              {l.fin.value}
              <span className="s">{l.done ? "finish" : "expected"}</span>
            </span>
            <span className="v gap">
              {gapWord(l)}
              <span className="s">{l.rank === 0 || l.done ? "" : `${Math.round(l.behindM)} m`}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- LOOK B — THE LANES --------------------------------------------------- */

const KM_MARKS = [0, 1000, 2000, 3000, 4000];

function Lanes({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-b">
      <header className="tv-b-head">
        <span className="t">{GOAL_WORD}</span>
        <span className="m">
          {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · IN RACE ORDER · LIVE
        </span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <div className="tv-b-track">
        <div className="tv-b-grid" aria-hidden="true">
          {KM_MARKS.map((d) => (
            <span key={d} className={d === 0 ? "zero" : ""} style={{ left: `${(d / GOAL) * 100}%` }}>
              <b>{d === 0 ? "START" : `${d / 1000}K`}</b>
            </span>
          ))}
          <span className="fin" style={{ left: "100%" }}>
            <b>{GOAL.toLocaleString("en-US")}</b>
          </span>
        </div>
        {lanes.map((l) => {
          /* Past four fifths the number crosses inside the fill, so it
           * never runs under the finish line or into the column beyond. */
          const inside = l.pct > 80;
          return (
            <div key={l.id} className={`tv-b-lane${l.rank === 0 ? " lead" : ""}${l.done ? " done" : ""}`}>
              <span className="tv-b-who">
                <b>{l.rank + 1}</b>
                <span>{l.name}</span>
              </span>
              <span className="tv-b-run">
                <span className="tv-b-fill" style={{ width: `${l.pct}%` }} />
                <span className={inside ? "tv-b-m in" : "tv-b-m"} style={{ left: `${l.pct}%` }}>
                  {metresWord(l)}
                </span>
              </span>
              <span className="tv-b-nums">
                <b>{paceWord(l)}</b>
                <i>
                  {l.done ? "fin" : "exp"} {l.fin.value}
                  {l.rank === 0 || l.done ? "" : ` · ${gapWord(l)} s`}
                </i>
              </span>
            </div>
          );
        })}
      </div>
      <div className="tv-b-foot" aria-hidden="true">
        <span>Lane</span>
        <span>The fill is where they are · the number rides the bow</span>
        <span>/500m · expected</span>
      </div>
    </div>
  );
}

/* ---- LOOK C — THE BROADCAST ---------------------------------------------- */

function Broadcast({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const lead = lanes[0];
  return (
    <div className="tv-c">
      <section className="tv-c-hero">
        <span className="tv-c-eyebrow">
          {lead.done ? "Finished" : "Leading"} · lane {lead.rank + 1} · {GOAL_WORD}
        </span>
        <h2>{lead.name}</h2>
        <div className="tv-c-big">
          <b>{metresWord(lead)}</b>
          <span>of {GOAL_WORD}</span>
        </div>
        <div className="tv-c-bar" aria-hidden="true">
          <span style={{ width: `${lead.pct}%` }} />
        </div>
        <div className="tv-c-kv">
          <div>
            <span>Pace /500m</span>
            <b>{paceWord(lead)}</b>
          </div>
          <div>
            <span>{lead.done ? "Finish" : "Expected"}</span>
            <b>{lead.fin.value}</b>
          </div>
          <div>
            <span>Rate · spm</span>
            <b>{lead.spm ? String(lead.spm) : "—"}</b>
          </div>
        </div>
      </section>
      <aside className="tv-c-list">
        <div className="tv-c-lh">
          <span>Standings · live</span>
          <b>{clockWord(clockS)}</b>
        </div>
        <ol>
          {lanes.map((l) => (
            <li key={l.id} className={l.rank === 0 ? "lead" : ""}>
              <b className="p">{l.rank + 1}</b>
              <span className="nm">{l.name}</span>
              <span className="g">
                {l.rank === 0 ? metresWord(l) : gapWord(l)}
                <i>{l.rank === 0 ? "metres" : l.done ? l.fin.value : `${metresWord(l)} m · ${paceWord(l)}`}</i>
              </span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${l.pct}%` }} />
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
