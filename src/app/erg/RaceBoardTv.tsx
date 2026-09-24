"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { lockBody, unlockBody } from "./charts";
import { boardHideCss } from "./boardHideCss";
import { DEFAULT_GOAL_M, type Erg, boardRowersOnly, setBoardRowersOnly, setErgHidden } from "./hub";
import { fmtPaceWhole, gapLine, laneName, laneRows, type Lane } from "./RaceBoard";
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
 *      ONE ROWER AT A TIME, their pace over THEIR LAST 500 METRES (owner,
 *      2026-09-22, third pass: "just be pace, remove the view that shows
 *      3 at a time, one rower at a time, a rolling 500 metre window");
 *      every eight seconds the next rower in the running order. The
 *      legend names them; the standings mark the lane on the chart.
 *   B  THE TOWER — a rally timing tower. Place, name, metres, the pace
 *      over the last 500 m, and the EXPECTED FINISH to the second as the
 *      one big number (the rowed time once in), with the seconds behind
 *      the first under it — the field is in that order, so the column
 *      reads down.
 *
 * THE SCREEN SAVER. AUTO is on by default and turns the two looks over
 * every twenty seconds; a key or a chip stops it on one look; A starts it
 * again. THE CONTROLS are hidden unless the pointer is at the foot of the
 * screen (owner: "default hidden unless my mouse is down there"); H
 * hides them at once. Escape leaves, F fills the screen.
 *
 * A LANE CAN BE HIDDEN FROM THE WALL (owner, 2026-09-24: "give me the
 * ability to hide ergs live on the race board if they are not being
 * used"): an x that shows only while a row is under the pointer, its own
 * button beside the row so a click-to-swap on the standings is never
 * mistaken for it. The strip counts the hidden and brings any one, or all,
 * back. It is the hub flag the desk board and the monitors page read, so
 * the three never disagree. */

export type TvLook = "a" | "b";

export const TV_LOOKS: { key: TvLook; label: string; note: string }[] = [
  { key: "a", label: "Broadcast", note: "One rower at a time, their pace over the last 500 metres; the standings beside." },
  { key: "b", label: "Tower", note: "A timing tower: place, name, last-500 pace, and the gap as the big number." },
];

const AUTO_ORDER: TvLook[] = ["a", "b"];
const AUTO_EVERY_MS = 20_000;
/* The strip lives in the bottom slice of the screen: the pointer there
 * shows it, anywhere else hides it. */
const CTL_ZONE = 0.14;
/* How long the chart holds one rower, and how far back it looks. */
const SCENE_MS = 8_000;
const WINDOW_M = 500;
/* How long a clicked rower holds the chart before the turning resumes. */
const PICK_HOLD_MS = 45_000;

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
  return l.pace ? fmtPaceWhole(l.pace) : "—";
}

/* The last-500 pace, falling back to the monitor's pace before half a
 * block is behind them. */
function pace500Word(l: Lane): string {
  return l.pace500 ? fmtPaceWhole(l.pace500) : paceWord(l);
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
  const hidden = ergs.filter((e) => e.hidden);
  const clockS = lanes.reduce((best, l) => Math.max(best, l.elapsedS), 0);
  const [auto, setAuto] = useState(true);
  const [ctl, setCtl] = useState(false);
  const ctlRef = useRef(false);

  /* THE STRIP: shown while the pointer is in the bottom slice of the
   * screen and hidden the moment it leaves. */
  const place = useCallback((y: number) => {
    const on = y >= window.innerHeight * (1 - CTL_ZONE);
    if (on !== ctlRef.current) {
      ctlRef.current = on;
      setCtl(on);
    }
  }, []);

  useEffect(() => {
    lockBody();
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
      } else if (ev.key === "r" || ev.key === "R") {
        setBoardRowersOnly(!boardRowersOnly());
      } else if (ev.key === "f" || ev.key === "F") {
        fullScreen();
      } else if (ev.key === "h" || ev.key === "H") {
        ctlRef.current = false;
        setCtl(false);
      }
    };
    const onMove = (ev: PointerEvent) => place(ev.clientY);
    const onLeave = () => place(0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      unlockBody();
    };
  }, [onExit, onLook, place]);

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
      <style>{boardHideCss}</style>
      {lanes.length === 0 ? (
        <div className="tv-empty">
          <b>No lanes yet</b>
          <span>{hidden.length > 0 ? "Every lane is hidden — the strip at the foot of the screen brings one back" : "Pair an erg on the monitors page and it appears here as a lane"}</span>
        </div>
      ) : look === "a" ? (
        <Broadcast lanes={lanes} clockS={clockS} />
      ) : (
        <Tower lanes={lanes} clockS={clockS} />
      )}

      <div className="eg-tv-ctl">
        {/* THE HIDDEN LINE: the count, a SHOW word per hidden erg, SHOW ALL.
          * It rides inside the strip so the pointer stays in the bottom
          * slice that keeps the strip open. */}
        {hidden.length > 0 ? (
          <div className="eg-tv-ctl-hidden">
            <span className="k">
              {hidden.length} hidden
            </span>
            {hidden.map((e) => (
              <button type="button" className="eg-word" key={e.id} onClick={() => setErgHidden(e.id, false)} title="Back on the wall">
                <b>{laneName(e)}</b> show
              </button>
            ))}
            {hidden.length > 1 ? (
              <button type="button" className="eg-word" onClick={() => hidden.forEach((e) => setErgHidden(e.id, false))}>
                Show all
              </button>
            ) : null}
          </div>
        ) : null}
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onExit}>
          Back
        </button>
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
        <button type="button" className={boardRowersOnly() ? "eg-btn on" : "eg-btn eg-btn-quiet"} onClick={() => setBoardRowersOnly(!boardRowersOnly())} aria-pressed={boardRowersOnly()} title="R · only the ergs with a rower assigned">
          Rowers only
        </button>
        <button type="button" className="eg-btn eg-btn-quiet" onClick={fullScreen} title="F">
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

/* ---- THE CHART ------------------------------------------------------------- */

const CW = 1000;
const CH = 520;

/* THE ROLLING CHART: one rower's pace over their last WINDOW_M metres,
 * faster HIGHER. The y domain is the 5th to 95th percentile of the points
 * in the window, so one blown stroke cannot flatten the picture. */
function RollingChart({ lane }: { lane: Lane }) {
  const padL = 64;
  const padR = 18;
  const padT = 16;
  const padB = 32;
  const m1 = Math.max(WINDOW_M, lane.m);
  const m0 = m1 - WINDOW_M;
  const pts = lane.series.pace.filter((p) => p.x >= m0 && p.x <= m1);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const q = (f: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.floor(f * (ys.length - 1))))];
  let lo = ys.length ? q(0.05) : 100;
  let hi = ys.length ? q(0.95) : 140;
  if (hi - lo < 6) {
    const mid = (hi + lo) / 2;
    lo = mid - 3;
    hi = mid + 3;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const x = (m: number) => padL + ((m - m0) / WINDOW_M) * (CW - padL - padR);
  const yOf = (v: number) => padT + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (CH - padT - padB);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
  const xMarks = [0, 0.25, 0.5, 0.75, 1].map((f) => m0 + f * WINDOW_M);
  const d = pts.length < 2 ? "" : pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x).toFixed(1)},${yOf(p.y).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="tv-chart" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" aria-hidden="true">
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="gr" x1={padL} x2={CW - padR} y1={yOf(t)} y2={yOf(t)} />
          <text className="lbl" x={padL - 8} y={yOf(t) + 4} textAnchor="end">
            {fmtPaceWhole(t)}
          </text>
        </g>
      ))}
      {xMarks.map((m, i) => (
        <g key={i}>
          <line className="gr" x1={x(m)} x2={x(m)} y1={padT} y2={CH - padB} />
          <text className="lbl" x={x(m)} y={CH - 10} textAnchor={i === 0 ? "start" : i === xMarks.length - 1 ? "end" : "middle"}>
            {i === xMarks.length - 1 ? "NOW" : `-${Math.round(m1 - m)} M`}
          </text>
        </g>
      ))}
      <line className="ax" x1={padL} x2={CW - padR} y1={CH - padB} y2={CH - padB} />
      <path className="ln s1" d={d} />
      {last && <circle className="dot" cx={x(last.x)} cy={yOf(last.y)} r={5} />}
    </svg>
  );
}

/* THE x ON A ROW: hover-only, its own button, and it stops the click there
 * so the standings row under it does not also swap the chart. */
function HideX({ lane }: { lane: Lane }) {
  return (
    <button
      type="button"
      className="tv-hide"
      onClick={(ev) => {
        ev.stopPropagation();
        setErgHidden(lane.id, true);
      }}
      aria-label={`Hide ${lane.name} from the wall`}
      title="Hide from the wall"
    >
      ×
    </button>
  );
}

/* ---- LOOK A — THE BROADCAST ---------------------------------------------- */

function Broadcast({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const [k, setK] = useState(0);
  /* A CLICK ON A ROWER puts them on the chart (owner, 2026-09-23: "allow
   * me to click on the rowers and have the graph swap") and holds them
   * there for a while before the turning resumes. */
  const [pick, setPick] = useState<{ id: string; until: number } | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setK((v) => v + 1), SCENE_MS);
    return () => window.clearInterval(id);
  }, []);
  const picked = pick && pick.until > Date.now() ? lanes.find((l) => l.id === pick.id) ?? null : null;
  const focus = picked ?? lanes[k % lanes.length];
  const last = focus.series.pace[focus.series.pace.length - 1];
  return (
    <div className="tv-c">
      <section className="tv-c-hero">
        <span className="tv-c-eyebrow">
          Lane {focus.rank + 1} · {focus.done ? "finished" : "rowing"} · pace /500m · the last {WINDOW_M} metres
        </span>
        <h2>{focus.name}</h2>
        <figure className="tv-c-fig">
          <RollingChart lane={focus} />
          <figcaption className="tv-legend">
            <span className="tv-key s1">
              <i />
              <b>{focus.rank + 1}</b> {focus.name} <em>{last ? fmtPaceWhole(last.y) : "—"}</em>
            </span>
            <span className="tv-unit">Faster is higher</span>
          </figcaption>
        </figure>
        <div className="tv-c-kv">
          <div>
            <span>Metres</span>
            <b>{focus.done ? focus.fin.value : metresWord(focus)}</b>
          </div>
          <div>
            <span>Last 500 m</span>
            <b>{focus.done ? (focus.avgPace ? fmtPaceWhole(focus.avgPace) : "—") : pace500Word(focus)}</b>
          </div>
          <div>
            <span>{focus.done ? "Finish" : "Expected"}</span>
            <b>{focus.expWord}</b>
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
            <li
              key={l.id}
              className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}${l.id === focus.id ? " show" : ""}`}
              onClick={() => setPick({ id: l.id, until: Date.now() + PICK_HOLD_MS })}
            >
              <b className="p">{l.rank + 1}</b>
              <span className="nm">{l.name}</span>
              <span className="g">
                {l.expWord}
                <i>{l.done ? gapLine(l) : `${metresWord(l)} m · ${gapLine(l)}`}</i>
              </span>
              <span className="tv-c-lbar" aria-hidden="true">
                <span style={{ width: `${l.pct}%` }} />
              </span>
              <HideX lane={l} />
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
        <span className="t">Race day</span>
        <span className="m">
          {GOAL_WORD} · {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · FINISHED AND EXPECTED, IN ONE ORDER
        </span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <ol className="tv-d-rows">
        {lanes.map((l) => (
          <li key={l.id} className={`${l.rank === 0 ? "lead" : ""}${l.done ? " done" : ""}`}>
            <span className="p">{l.rank + 1}</span>
            <span className="nm">{l.name}</span>
            {/* THE METRES on every row (owner, 2026-09-23). */}
            <span className="mt">
              {metresWord(l)}
              <i>metres</i>
            </span>
            <span className="pc">
              {l.done ? (l.avgPace ? fmtPaceWhole(l.avgPace) : "—") : pace500Word(l)}
              <i>{l.done ? "average /500m" : "last 500 m"}</i>
            </span>
            {/* A FINISHED LANE SHOWS ITS TIME in the big letters and the
              * gap under it (owner, 2026-09-22: "when they finish show their
              * time in the big white letters"). */}
            <span className="gap">{l.expWord}</span>
            <span className="u">{gapLine(l)}</span>
            <HideX lane={l} />
          </li>
        ))}
      </ol>
    </div>
  );
}
