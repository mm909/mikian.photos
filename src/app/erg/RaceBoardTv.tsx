"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { fmtPace } from "@/lib/pm5/pm5";
import { lockBody, unlockBody } from "./charts";
import { DEFAULT_GOAL_M, type Erg } from "./hub";
import { gapWord, laneRows, type Lane } from "./RaceBoard";
import { tvCss } from "./tvCss";

/* THE RACE BOARD ON THE TELEVISION (owner, 2026-09-21: "race board looks
 * good but this will be on a full screen monitor, give me a view that would
 * go on a TV"; 2026-09-22, after a night with it in the gym: "we will
 * likely have up to 12 racers at the same time — make sure the board is
 * still readable and not crowded with 12"; "make the race day screens
 * change every so often like a screen saver"; "give me 5 total looks").
 *
 * THE SAME LANES AS THE DESK BOARD — laneRows() in RaceBoard.tsx — so the
 * wall and the laptop can never disagree. Everything else is different: it
 * fills the screen (a fixed overlay, so the site bar and the footer never
 * enter the picture and nothing under it remounts), it sizes every letter
 * against the screen, and nothing on it is a button to press with a mouse,
 * because a wall has no mouse. The controls — back, the looks, auto, full
 * screen — sit in a strip that shows under the pointer only.
 *
 * IT FITS TWELVE. Every look sets --n to the lane count and --rowh to the
 * height one lane may take, and the type in a row is the smaller of its
 * wall size and a share of that row (tvCss.ts), so eight lanes get eight
 * big rows and twelve get twelve that still read from the back of the
 * room. Past eight lanes the sheet is DENSE: the small second lines under
 * the numbers come off, because at that pitch they were the crowding.
 *
 * FIVE LOOKS, one root class each, the keys 1 to 5 or ?board=tv&look=a..e:
 *
 *   A  THE SCOREBOARD — a stadium board. One row per lane, the four
 *      numbers in columns under a header row, the leader inverted white.
 *   B  THE LANES — a regatta. Each lane is a track from 0 to the 5,000 m
 *      line with a kilometre grid behind it; the fill is where they are.
 *   C  THE BROADCAST — TV graphics. The leader is the picture, the field
 *      is the standings list beside it.
 *   D  THE TOWER — a rally timing tower. Place, name, and the gap to the
 *      leader as the one big number on every row; the leader's number is
 *      their metres, or their time once they are in.
 *   E  THE SPLITS — the whole race as a table of 500 m splits, a row per
 *      lane and a column per five hundred, the latest one bright. What a
 *      coach reads after the race, live.
 *
 * THE SCREEN SAVER. AUTO is on by default and turns the looks over every
 * twenty seconds in the owner's order of preference (A, B, then the rest).
 * Picking a look by key or chip stops the turning on that look; A or the
 * AUTO chip starts it again. Escape leaves, F fills the screen.
 *
 * THE CLOCK is the longest elapsed on any lane. Every lane is read against
 * DEFAULT_GOAL_M, as on the desk board. */

export type TvLook = "a" | "b" | "c" | "d" | "e";

export const TV_LOOKS: { key: TvLook; label: string; note: string }[] = [
  { key: "a", label: "Scoreboard", note: "Stadium board: one row per lane, every number in a column, the leader inverted." },
  { key: "b", label: "Lanes", note: "A regatta: each lane is a track to the 5,000 m line, the fill is where they are." },
  { key: "c", label: "Broadcast", note: "TV graphics: the leader as the picture, the field as the standings beside them." },
  { key: "d", label: "Tower", note: "A timing tower: place, name, and the gap to the leader as the big number." },
  { key: "e", label: "Splits", note: "The race as 500 m splits: a row per lane, a column per five hundred." },
];

/* The order the screen saver turns through — the owner's preference first. */
const AUTO_ORDER: TvLook[] = ["a", "b", "c", "d", "e"];
const AUTO_EVERY_MS = 20_000;

export function parseTvLook(v: string | null | undefined): TvLook | null {
  return v === "a" || v === "b" || v === "c" || v === "d" || v === "e" ? v : null;
}

const GOAL = DEFAULT_GOAL_M;
const GOAL_WORD = `${GOAL.toLocaleString("en-US")} M`;
const DENSE_FROM = 9;

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

export function RaceBoardTv({ ergs, look, onLook, onExit }: { ergs: Erg[]; look: TvLook; onLook: (l: TvLook) => void; onExit: () => void }) {
  const lanes = laneRows(ergs, GOAL);
  const clockS = lanes.reduce((best, l) => Math.max(best, l.elapsedS), 0);
  const [auto, setAuto] = useState(true);

  /* The page under the overlay must not scroll under a wheel on the wall,
   * and the keys are the whole remote: Escape leaves, 1 to 5 pick a look
   * (and stop the turning), A turns it again, F fills the screen. */
  useEffect(() => {
    lockBody();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onExit();
      } else if (/^[1-5]$/.test(ev.key)) {
        setAuto(false);
        onLook(AUTO_ORDER[Number(ev.key) - 1]);
      } else if (ev.key === "a" || ev.key === "A") {
        setAuto((v) => !v);
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

  /* THE SCREEN SAVER: every AUTO_EVERY_MS the next look in the order. The
   * timer restarts on every change of look, so a manual pick that leaves
   * auto on still gets its full twenty seconds. */
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => {
      const i = AUTO_ORDER.indexOf(look);
      onLook(AUTO_ORDER[(i + 1) % AUTO_ORDER.length]);
    }, AUTO_EVERY_MS);
    return () => window.clearTimeout(id);
  }, [auto, look, onLook]);

  const dense = lanes.length >= DENSE_FROM;
  const style = { ["--n" as string]: String(Math.max(1, lanes.length)) } as CSSProperties;

  return (
    <div className={`eg-tv eg-tv-${look}${dense ? " dense" : ""}`} style={style} role="dialog" aria-modal="true" aria-label="Race board on the TV">
      <style>{tvCss}</style>
      {lanes.length === 0 ? (
        <div className="tv-empty">
          <b>No lanes yet</b>
          <span>Pair an erg on the monitors page and it appears here as a lane</span>
        </div>
      ) : look === "a" ? (
        <Scoreboard lanes={lanes} clockS={clockS} dense={dense} />
      ) : look === "b" ? (
        <Lanes lanes={lanes} clockS={clockS} />
      ) : look === "c" ? (
        <Broadcast lanes={lanes} clockS={clockS} />
      ) : look === "d" ? (
        <Tower lanes={lanes} clockS={clockS} />
      ) : (
        <Splits lanes={lanes} clockS={clockS} />
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
            onClick={() => {
              setAuto(false);
              onLook(o.key);
            }}
            title={`${i + 1} · ${o.note}`}
            aria-pressed={o.key === look}
          >
            {i + 1} {o.label}
          </button>
        ))}
        <button type="button" className={auto ? "eg-btn on" : "eg-btn eg-btn-quiet"} onClick={() => setAuto((v) => !v)} aria-pressed={auto} title="A · turn the looks over every twenty seconds">
          Auto
        </button>
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

function Scoreboard({ lanes, clockS, dense }: { lanes: Lane[]; clockS: number; dense: boolean }) {
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
          <li key={l.id} className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}`}>
            <span className="p">{l.rank + 1}</span>
            <span className="who">
              <span className="nm">{l.name}</span>
              <span className="tv-a-bar" aria-hidden="true">
                <span style={{ width: `${l.pct}%` }} />
              </span>
            </span>
            <span className="v">
              {metresWord(l)}
              {!dense && <span className="s">of {GOAL_WORD}</span>}
            </span>
            <span className="v">
              {paceWord(l)}
              {!dense && <span className="s">{l.avgPace ? `avg ${fmtPace(l.avgPace)}` : ""}</span>}
            </span>
            <span className="v">
              {l.fin.value}
              {!dense && <span className="s">{l.done ? "finish" : "expected"}</span>}
            </span>
            <span className="v gap">
              {gapWord(l)}
              {!dense && <span className="s">{l.rank === 0 ? "" : l.done ? "on the winner" : `${Math.round(l.behindM)} m`}</span>}
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
                  {l.done ? l.fin.value : metresWord(l)}
                </span>
              </span>
              <span className="tv-b-nums">
                <b>{l.done ? gapWord(l) : paceWord(l)}</b>
                <i>{l.done ? (l.rank === 0 ? "finished" : "on the winner") : `exp ${l.fin.value}${l.rank === 0 ? "" : ` · ${gapWord(l)} s`}`}</i>
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
          {lead.done ? "Winner" : "Leading"} · lane {lead.rank + 1} · {GOAL_WORD}
        </span>
        <h2>{lead.name}</h2>
        <div className="tv-c-big">
          <b>{lead.done ? lead.fin.value : metresWord(lead)}</b>
          <span>{lead.done ? "finish" : `of ${GOAL_WORD}`}</span>
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
            <span>{lead.done ? "Average" : "Expected"}</span>
            <b>{lead.done ? (lead.avgPace ? fmtPace(lead.avgPace) : "—") : lead.fin.value}</b>
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
            <li key={l.id} className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}`}>
              <b className="p">{l.rank + 1}</b>
              <span className="nm">{l.name}</span>
              <span className="g">
                {l.rank === 0 ? (l.done ? l.fin.value : metresWord(l)) : gapWord(l)}
                <i>{l.rank === 0 ? (l.done ? "finish" : "metres") : l.done ? l.fin.value : `${metresWord(l)} m · ${paceWord(l)}`}</i>
              </span>
              <span className="tv-c-lbar" aria-hidden="true">
                <span style={{ width: `${l.pct}%` }} />
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

/* ---- LOOK D — THE TOWER ---------------------------------------------------- */

function Tower({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-d">
      <header className="tv-d-head">
        <span className="t">Race board</span>
        <span className="m">
          {GOAL_WORD} · {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · GAP TO THE LEADER
        </span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <ol className="tv-d-rows">
        {lanes.map((l) => (
          <li key={l.id} className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}`}>
            <span className="p">{l.rank + 1}</span>
            <span className="nm">{l.name}</span>
            <span className="pc">{paceWord(l)}</span>
            <span className="gap">{l.rank === 0 ? (l.done ? l.fin.value : metresWord(l)) : gapWord(l)}</span>
            <span className="u">{l.rank === 0 ? (l.done ? "finish" : "metres") : l.done ? "on the winner" : "seconds"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- LOOK E — THE SPLITS --------------------------------------------------- */

const SPLIT_COLS = Math.round(GOAL / 500);

function Splits({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-e">
      <header className="tv-e-head">
        <span className="t">Splits</span>
        <span className="m">/500M · EVERY FIVE HUNDRED · THE LATEST BRIGHT</span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <div className="tv-e-grid" style={{ ["--cols" as string]: String(SPLIT_COLS) } as CSSProperties}>
        <div className="tv-e-row tv-e-cols" aria-hidden="true">
          <span className="p" />
          <span className="nm">Lane</span>
          {Array.from({ length: SPLIT_COLS }, (_, i) => (
            <span key={i} className="cell">
              {((i + 1) * 500).toLocaleString("en-US")}
            </span>
          ))}
        </div>
        {lanes.map((l) => {
          const done = l.blocks.filter((b) => b.meters > 0 && b.seconds > 0);
          return (
            <div key={l.id} className={`tv-e-row${l.rank === 0 ? " lead" : ""}`}>
              <span className="p">{l.rank + 1}</span>
              <span className="nm">{l.name}</span>
              {Array.from({ length: SPLIT_COLS }, (_, i) => {
                const b = done[i];
                const latest = b !== undefined && i === done.length - 1;
                const live = b === undefined && i === done.length && !l.done && l.pace !== null;
                return (
                  <span key={i} className={`cell${latest ? " now" : ""}${live ? " live" : ""}`}>
                    {b ? fmtPace((b.seconds * 500) / b.meters) : live ? paceWord(l) : ""}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
