"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fmtPace } from "@/lib/pm5/pm5";
import type { XY } from "./chartGeom";
import { lockBody, unlockBody } from "./charts";
import { DEFAULT_GOAL_M, type Erg } from "./hub";
import { gapWord, laneRows, type Lane } from "./RaceBoard";
import { tvCss } from "./tvCss";

/* THE RACE BOARD ON THE TELEVISION (owner, 2026-09-21: "this will be on a
 * full screen monitor, give me a view that would go on a TV"; 2026-09-22,
 * three rounds in the gym: twelve racers, a screen saver, finish order;
 * then charts on the broadcast; then "charts should be on a rolling
 * window. On the broadcast chart let us just keep the pace chart and
 * cycle through the racers and highlight which one we are showing at a
 * time … pick the top 3 and show their lines at the same time. Also show a
 * different stat every time: pace, watts, length … sometimes show a single
 * rower and other times the top 3. Let us just keep broadcast and tower.
 * The lines should have a legend").
 *
 * THE SAME LANES AS THE DESK BOARD — laneRows() in RaceBoard.tsx — so the
 * wall and the laptop can never disagree. It fills the screen (a fixed
 * overlay, so the site bar and the footer never enter the picture and
 * nothing under it remounts), sizes every letter against the screen, and
 * nothing on it is a button to press with a mouse.
 *
 * IT FITS TWELVE. Every look sets --n to the lane count and --rowh to the
 * height one lane may take (tvCss.ts). Past eight lanes the sheet is
 * DENSE: the small second lines come off.
 *
 * TWO LOOKS, the keys 1 and 2 or ?board=tv&look=a|b:
 *
 *   A  THE BROADCAST — the chart on the left, the standings on the right.
 *      The chart is a ROLLING WINDOW, the last two minutes of the race,
 *      and it plays SCENES: every eight seconds it turns over — the top
 *      three together, then one rower on their own, then the top three
 *      on the next stat, then the next rower … through pace, watts and
 *      drive length in turn. The rest of the field is faint behind the
 *      lines it is showing; a legend under the chart says whose line is
 *      whose; the standings mark the lanes on the chart.
 *   B  THE TOWER — a rally timing tower. Place, name, the pace over the
 *      last 500 m, and the gap to the leader as the one big number.
 *
 * THE SCREEN SAVER. AUTO is on by default and turns the two looks over
 * every twenty seconds; a key or a chip stops it on one look; A starts it
 * again. THE CONTROLS HIDE three seconds after the pointer last moved or
 * a key was pressed; H hides them at once. Escape leaves, F fills the
 * screen. */

export type TvLook = "a" | "b";

export const TV_LOOKS: { key: TvLook; label: string; note: string }[] = [
  { key: "a", label: "Broadcast", note: "The rolling chart, cycling through the field and the stats; the standings beside." },
  { key: "b", label: "Tower", note: "A timing tower: place, name, last-500 pace, and the gap as the big number." },
];

const AUTO_ORDER: TvLook[] = ["a", "b"];
const AUTO_EVERY_MS = 20_000;
const CTL_HIDE_MS = 3_000;
/* How long a scene on the broadcast chart holds, and how far back it looks. */
const SCENE_MS = 8_000;
const WINDOW_S = 120;

export function parseTvLook(v: string | null | undefined): TvLook | null {
  return v === "a" || v === "b" ? v : null;
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

/* The last-500 pace, falling back to the monitor's pace before half a
 * block is behind them. */
function pace500Word(l: Lane): string {
  return l.pace500 ? fmtPace(l.pace500) : paceWord(l);
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
  const [ctl, setCtl] = useState(true);
  const hideAt = useRef<number | null>(null);

  /* THE STRIP: shown by any pointer movement or key, hidden again after
   * three seconds of nothing. One timer, restarted on every wake. */
  const wake = useCallback(() => {
    setCtl(true);
    if (hideAt.current !== null) window.clearTimeout(hideAt.current);
    hideAt.current = window.setTimeout(() => setCtl(false), CTL_HIDE_MS);
  }, []);

  useEffect(() => {
    lockBody();
    wake();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onExit();
        return;
      }
      if (ev.key === "1" || ev.key === "2") {
        setAuto(false);
        onLook(ev.key === "1" ? "a" : "b");
      } else if (ev.key === "a" || ev.key === "A") {
        setAuto((v) => !v);
      } else if (ev.key === "f" || ev.key === "F") {
        fullScreen();
      } else if (ev.key === "h" || ev.key === "H") {
        if (hideAt.current !== null) window.clearTimeout(hideAt.current);
        setCtl(false);
        return;
      }
      wake();
    };
    const onMove = () => wake();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      if (hideAt.current !== null) window.clearTimeout(hideAt.current);
      unlockBody();
    };
  }, [onExit, onLook, wake]);

  /* THE SCREEN SAVER: every AUTO_EVERY_MS the other look. */
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
  const cls = `eg-tv eg-tv-${look}${dense ? " dense" : ""}${ctl ? " ctl" : ""}`;

  return (
    <div className={cls} style={style} role="dialog" aria-modal="true" aria-label="Race board on the TV">
      <style>{tvCss}</style>
      {lanes.length === 0 ? (
        <div className="tv-empty">
          <b>No lanes yet</b>
          <span>Pair an erg on the monitors page and it appears here as a lane</span>
        </div>
      ) : look === "a" ? (
        <Broadcast lanes={lanes} clockS={clockS} />
      ) : (
        <Tower lanes={lanes} clockS={clockS} />
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
        <button type="button" className="eg-btn eg-btn-quiet" onClick={fullScreen} title="F">
          Full screen
        </button>
        <button
          type="button"
          className="eg-btn eg-btn-quiet"
          title="H · hides this strip; move the mouse or press a key to bring it back"
          onClick={() => {
            if (hideAt.current !== null) window.clearTimeout(hideAt.current);
            setCtl(false);
          }}
        >
          Hide
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

/* ---- THE STATS THE CHART CYCLES ------------------------------------------ */

type StatKey = "pace" | "watts" | "length";

const STATS: { key: StatKey; label: string; unit: string; invert: boolean; fmt: (v: number) => string; of: (l: Lane) => XY[] }[] = [
  { key: "pace", label: "Pace", unit: "/500m · faster is higher", invert: true, fmt: (v) => fmtPace(v), of: (l) => l.series.pace },
  { key: "watts", label: "Watts", unit: "W", invert: false, fmt: (v) => String(Math.round(v)), of: (l) => l.series.watts },
  { key: "length", label: "Drive length", unit: "m per stroke", invert: false, fmt: (v) => `${v.toFixed(2)}`, of: (l) => l.series.length },
];

/* Three line styles for three lines, so a monochrome legend can still
 * tell them apart. */
const STYLES = ["s1", "s2", "s3"];

/* ---- THE CHART ------------------------------------------------------------- */

const CW = 1000;
const CH = 520;

/* THE ROLLING CHART: the shown lanes bright in their own line styles, the
 * rest of the field faint behind them, on the last WINDOW_S seconds of
 * the race. The y domain is the 5th to 95th percentile of the SHOWN
 * lanes' points in the window, so one blown stroke cannot flatten the
 * picture; pace is drawn faster-higher. */
function RollingChart({ lanes, shown, stat, clockS }: { lanes: Lane[]; shown: Lane[]; stat: (typeof STATS)[number]; clockS: number }) {
  const padL = 64;
  const padR = 18;
  const padT = 16;
  const padB = 32;
  const t1 = Math.max(WINDOW_S, clockS);
  const t0 = t1 - WINDOW_S;
  const inWin = (pts: XY[]) => pts.filter((p) => p.x >= t0 && p.x <= t1);
  const ys: number[] = [];
  for (const l of shown) for (const p of inWin(stat.of(l))) ys.push(p.y);
  ys.sort((a, b) => a - b);
  const q = (f: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(f * (ys.length - 1))))];
  let lo = ys.length ? q(0.05) : 0;
  let hi = ys.length ? q(0.95) : 1;
  const floor = stat.key === "pace" ? 6 : stat.key === "watts" ? 30 : 0.1;
  if (hi - lo < floor) {
    const mid = (hi + lo) / 2;
    lo = mid - floor / 2;
    hi = mid + floor / 2;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const x = (t: number) => padL + ((t - t0) / WINDOW_S) * (CW - padL - padR);
  const yOf = (v: number) => {
    const f = (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo);
    const g = stat.invert ? f : 1 - f;
    return padT + g * (CH - padT - padB);
  };
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xMarks = [t0, t0 + WINDOW_S / 4, t0 + WINDOW_S / 2, t0 + (3 * WINDOW_S) / 4, t1];
  const path = (l: Lane) => {
    const pts = inWin(stat.of(l));
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ");
  };
  const shownIds = new Set(shown.map((l) => l.id));
  return (
    <svg className="tv-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" aria-hidden="true">
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="gr" x1={padL} x2={CW - padR} y1={yOf(t)} y2={yOf(t)} />
          <text className="lbl" x={padL - 8} y={yOf(t) + 4} textAnchor="end">
            {stat.fmt(t)}
          </text>
        </g>
      ))}
      {xMarks.map((t, i) => (
        <g key={i}>
          <line className="gr" x1={x(t)} x2={x(t)} y1={padT} y2={CH - padB} />
          <text className="lbl" x={x(t)} y={CH - 10} textAnchor={i === 0 ? "start" : i === xMarks.length - 1 ? "end" : "middle"}>
            {i === xMarks.length - 1 ? "NOW" : `-${Math.round(t1 - t)} S`}
          </text>
        </g>
      ))}
      <line className="ax" x1={padL} x2={CW - padR} y1={CH - padB} y2={CH - padB} />
      {lanes
        .filter((l) => !shownIds.has(l.id))
        .map((l) => (
          <path key={l.id} className="ln faint" d={path(l)} />
        ))}
      {shown.map((l, i) => {
        const pts = inWin(stat.of(l));
        const last = pts[pts.length - 1];
        return (
          <g key={l.id}>
            <path className={`ln ${STYLES[i % STYLES.length]}`} d={path(l)} />
            {last && <circle className="dot" cx={x(last.x)} cy={yOf(last.y)} r={5} />}
          </g>
        );
      })}
    </svg>
  );
}

/* ---- LOOK A — THE BROADCAST ---------------------------------------------- */

/* THE SCENES: 0 the top three on pace, 1 the first rower on pace, 2 the
 * top three on watts, 3 the second rower on watts, 4 the top three on
 * drive length, 5 the third rower on drive length, 6 the top three on
 * pace again, 7 the fourth rower … so every rower gets a turn and every
 * stat comes round. */
function sceneOf(k: number, lanes: Lane[]): { mode: "top3" | "single"; shown: Lane[]; stat: (typeof STATS)[number]; focus: Lane } {
  const pair = Math.floor(k / 2);
  const stat = STATS[pair % STATS.length];
  if (k % 2 === 0 || lanes.length === 1) {
    const shown = lanes.slice(0, 3);
    return { mode: "top3", shown, stat, focus: lanes[0] };
  }
  const one = lanes[pair % lanes.length];
  return { mode: "single", shown: [one], stat, focus: one };
}

function Broadcast({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const [k, setK] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setK((v) => v + 1), SCENE_MS);
    return () => window.clearInterval(id);
  }, []);
  const { mode, shown, stat, focus } = sceneOf(k, lanes);
  const shownIds = new Set(shown.map((l) => l.id));
  const statNow = (l: Lane): string => {
    const pts = stat.of(l);
    const last = pts[pts.length - 1];
    return last ? stat.fmt(last.y) : "—";
  };
  return (
    <div className="tv-c">
      <section className="tv-c-hero">
        <span className="tv-c-eyebrow">
          {mode === "single" ? `Lane ${focus.rank + 1} · ${focus.done ? "finished" : "rowing"}` : "The top three"} · {stat.label} · last two minutes
        </span>
        <h2>{mode === "single" ? focus.name : "Head to head"}</h2>
        <figure className="tv-c-fig">
          <RollingChart lanes={lanes} shown={shown} stat={stat} clockS={clockS} />
          <figcaption className="tv-legend">
            {shown.map((l, i) => (
              <span key={l.id} className={`tv-key ${STYLES[i % STYLES.length]}`}>
                <i />
                <b>{l.rank + 1}</b> {l.name} <em>{statNow(l)}</em>
              </span>
            ))}
            <span className="tv-key faint">
              <i />
              the field
            </span>
            <span className="tv-unit">{stat.unit}</span>
          </figcaption>
        </figure>
        <div className="tv-c-kv">
          <div>
            <span>{mode === "single" ? "Metres" : "Leader · metres"}</span>
            <b>{focus.done ? focus.fin.value : metresWord(focus)}</b>
          </div>
          <div>
            <span>Last 500 m</span>
            <b>{focus.done ? (focus.avgPace ? fmtPace(focus.avgPace) : "—") : pace500Word(focus)}</b>
          </div>
          <div>
            <span>{focus.done ? "Finish" : "Expected"}</span>
            <b>{focus.fin.value}</b>
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
            <li key={l.id} className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}${shownIds.has(l.id) ? " show" : ""}`}>
              <b className="p">{l.rank + 1}</b>
              <span className="nm">{l.name}</span>
              <span className="g">
                {l.done ? l.fin.value : l.rank === 0 ? metresWord(l) : gapWord(l)}
                <i>{l.done ? (l.rank === 0 ? "winner" : `${gapWord(l)} on the winner`) : l.rank === 0 ? "metres" : `${metresWord(l)} m · ${paceWord(l)}`}</i>
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

/* ---- LOOK B — THE TOWER ---------------------------------------------------- */

function Tower({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-d">
      <header className="tv-head">
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
            <span className="pc">
              {l.done ? (l.avgPace ? fmtPace(l.avgPace) : "—") : pace500Word(l)}
              <i>{l.done ? "average /500m" : "last 500 m"}</i>
            </span>
            {/* A FINISHED LANE SHOWS ITS TIME in the big letters and the
              * gap under it (owner, 2026-09-22: "when they finish show their
              * time in the big white letters"). */}
            <span className="gap">{l.done ? l.fin.value : l.rank === 0 ? metresWord(l) : gapWord(l)}</span>
            <span className="u">{l.done ? (l.rank === 0 ? "winner" : `${gapWord(l)} on the winner`) : l.rank === 0 ? "metres" : "seconds"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
