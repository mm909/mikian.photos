"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fmtPace } from "@/lib/pm5/pm5";
import { lockBody, unlockBody } from "./charts";
import { DEFAULT_GOAL_M, type Erg } from "./hub";
import { gapWord, laneRows, type Lane } from "./RaceBoard";
import { tvCss } from "./tvCss";

/* THE RACE BOARD ON THE TELEVISION (owner, 2026-09-21: "this will be on a
 * full screen monitor, give me a view that would go on a TV"; 2026-09-22
 * morning, after a night with it in the gym: twelve racers, a screen
 * saver, finish order; 2026-09-22 later: "keep the tower look and the
 * broadcast look. On the broadcast look show the pace chart on the left
 * side — use that empty space to show some live updating charts. Reduce
 * to just those 2 views, then build 3 more new ones. Make sure the bar at
 * the bottom can be hidden or hides when inactive. On the tower view I
 * want the pace to be avg pace over the last 500 meters").
 *
 * THE SAME LANES AS THE DESK BOARD — laneRows() in RaceBoard.tsx — so the
 * wall and the laptop can never disagree. Everything else is different: it
 * fills the screen (a fixed overlay, so the site bar and the footer never
 * enter the picture and nothing under it remounts), it sizes every letter
 * against the screen, and nothing on it is a button to press with a mouse,
 * because a wall has no mouse.
 *
 * IT FITS TWELVE. Every look sets --n to the lane count and --rowh to the
 * height one lane may take, and the type in a row is the smaller of its
 * wall size and a share of that row (tvCss.ts). Past eight lanes the sheet
 * is DENSE: the small second lines come off.
 *
 * FIVE LOOKS, one root class each, the keys 1 to 5 or ?board=tv&look=a..e:
 *
 *   A  THE BROADCAST — the leader as the picture on the left with two
 *      live charts under the name: the whole field on pace over metres
 *      (the leader bright) and the leader's 500 m splits as bars; the
 *      standings list on the right.
 *   B  THE TOWER — a rally timing tower. Place, name, the pace over the
 *      last 500 m, and the gap to the leader as the one big number.
 *   C  THE CHART — the pace chart as the whole picture, every lane a
 *      line, with the running order as its key on the right.
 *   D  THE PODIUM — first, second and third as three steps, the winner
 *      inverted, and the rest of the field in two columns under them.
 *   E  THE GAPS — a bar per lane, the leader full and every other lane
 *      as far along as they are, with the gap as the number at the end.
 *
 * THE SCREEN SAVER. AUTO is on by default and turns the looks over every
 * twenty seconds. Picking a look by key or chip stops the turning on that
 * look; A or the AUTO chip starts it again.
 *
 * THE CONTROLS HIDE. The strip at the foot shows when the pointer moves
 * or a key is pressed and goes again after three seconds still (owner:
 * "make sure the bar at the bottom can be hidden or hides when
 * inactive"). Escape leaves, F fills the screen, H hides the strip at
 * once.
 *
 * THE CLOCK is the longest elapsed on any lane. Every lane is read against
 * DEFAULT_GOAL_M, as on the desk board. */

export type TvLook = "a" | "b" | "c" | "d" | "e";

export const TV_LOOKS: { key: TvLook; label: string; note: string }[] = [
  { key: "a", label: "Broadcast", note: "The leader as the picture with live charts; the standings beside." },
  { key: "b", label: "Tower", note: "A timing tower: place, name, last-500 pace, and the gap as the big number." },
  { key: "c", label: "Chart", note: "The pace chart as the whole picture, the running order as its key." },
  { key: "d", label: "Podium", note: "First, second and third as steps; the rest of the field under them." },
  { key: "e", label: "Gaps", note: "A bar per lane, the leader full; the gap at the end of each." },
];

const AUTO_ORDER: TvLook[] = ["a", "b", "c", "d", "e"];
const AUTO_EVERY_MS = 20_000;
const CTL_HIDE_MS = 3_000;

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
      if (/^[1-5]$/.test(ev.key)) {
        setAuto(false);
        onLook(AUTO_ORDER[Number(ev.key) - 1]);
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

  /* THE SCREEN SAVER: every AUTO_EVERY_MS the next look in the order. The
   * timer restarts on every change of look. */
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
      ) : look === "b" ? (
        <Tower lanes={lanes} clockS={clockS} />
      ) : look === "c" ? (
        <ChartLook lanes={lanes} clockS={clockS} />
      ) : look === "d" ? (
        <Podium lanes={lanes} clockS={clockS} />
      ) : (
        <Gaps lanes={lanes} clockS={clockS} />
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

/* ---- THE CHARTS --------------------------------------------------------- */

/* A viewBox of fixed units so the type inside is sized like everything
 * else on the wall; the SVG stretches to its box and the strokes stay one
 * width (vector-effect). */
const CW = 1000;
const CH = 420;

/* THE PACE CHART: every lane on pace over metres, faster HIGHER (the axis
 * is inverted, as on the console), the leader bright. The y domain is
 * the 5th to 95th percentile of every point so one blown stroke cannot
 * flatten the field; the x axis is the whole 5,000. */
function PaceChart({ lanes, tall }: { lanes: Lane[]; tall?: boolean }) {
  const H = tall ? 560 : CH;
  const padL = 62;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const ys: number[] = [];
  for (const l of lanes) for (const p of l.trace) ys.push(p.y);
  ys.sort((a, b) => a - b);
  const q = (f: number) => (ys.length ? ys[Math.min(ys.length - 1, Math.max(0, Math.floor(f * (ys.length - 1))))] : 0);
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
  const x = (m: number) => padL + (Math.min(GOAL, Math.max(0, m)) / GOAL) * (CW - padL - padR);
  const y = (p: number) => padT + ((Math.min(hi, Math.max(lo, p)) - lo) / (hi - lo)) * (H - padT - padB);
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => lo + ((hi - lo) * i) / yTicks);
  const xMarks = [1000, 2000, 3000, 4000];
  const path = (l: Lane) => {
    if (l.trace.length < 2) return "";
    return l.trace.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  };
  return (
    <svg className="tv-chart" viewBox={`0 0 ${CW} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line className="gr" x1={padL} x2={CW - padR} y1={y(t)} y2={y(t)} />
          <text className="lbl" x={padL - 8} y={y(t) + 4} textAnchor="end">
            {fmtPace(t)}
          </text>
        </g>
      ))}
      {xMarks.map((m) => (
        <g key={m}>
          <line className="gr" x1={x(m)} x2={x(m)} y1={padT} y2={H - padB} />
          <text className="lbl" x={x(m)} y={H - 10} textAnchor="middle">
            {m / 1000}K
          </text>
        </g>
      ))}
      <line className="ax" x1={padL} x2={CW - padR} y1={H - padB} y2={H - padB} />
      {lanes
        .filter((l) => l.rank !== 0)
        .map((l) => (
          <path key={l.id} className="ln" d={path(l)} />
        ))}
      {lanes
        .filter((l) => l.rank === 0)
        .map((l) => (
          <g key={l.id}>
            <path className="ln lead" d={path(l)} />
            {l.trace.length > 0 && <circle className="dot" cx={x(l.trace[l.trace.length - 1].x)} cy={y(l.trace[l.trace.length - 1].y)} r={5} />}
          </g>
        ))}
    </svg>
  );
}

/* THE SPLITS: one lane's 500 m blocks as bars, faster TALLER, the latest
 * bright, the pace printed over each. */
function SplitBars({ lane }: { lane: Lane }) {
  const H = 260;
  const padL = 12;
  const padB = 26;
  const padT = 26;
  const cols = Math.round(GOAL / 500);
  const paces = lane.blocks.filter((b) => b.meters > 0 && b.seconds > 0).map((b) => (b.seconds * 500) / b.meters);
  const all = paces.length ? paces : [];
  let lo = all.length ? Math.min(...all) : 100;
  let hi = all.length ? Math.max(...all) : 140;
  if (hi - lo < 6) {
    const mid = (hi + lo) / 2;
    lo = mid - 3;
    hi = mid + 3;
  }
  const span = hi - lo;
  lo -= span * 0.5;
  hi += span * 0.15;
  const slot = (CW - padL * 2) / cols;
  const bw = slot * 0.66;
  const top = (p: number) => padT + ((p - lo) / (hi - lo)) * (H - padT - padB);
  return (
    <svg className="tv-chart" viewBox={`0 0 ${CW} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line className="ax" x1={padL} x2={CW - padL} y1={H - padB} y2={H - padB} />
      {Array.from({ length: cols }, (_, i) => {
        const cx = padL + slot * i + slot / 2;
        const p = paces[i];
        return (
          <g key={i}>
            <text className="lbl" x={cx} y={H - 8} textAnchor="middle">
              {((i + 1) * 500) / 1000}K
            </text>
            {p !== undefined && (
              <>
                <rect className={i === paces.length - 1 ? "bar now" : "bar"} x={cx - bw / 2} y={top(p)} width={bw} height={H - padB - top(p)} />
                <text className="bv" x={cx} y={top(p) - 6}>
                  {fmtPace(p)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---- LOOK A — THE BROADCAST ---------------------------------------------- */

function Broadcast({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const lead = lanes[0];
  return (
    <div className="tv-c">
      <section className="tv-c-hero">
        <span className="tv-c-eyebrow">
          {lead.done ? "Winner" : "Leading"} · lane {lead.rank + 1} · {GOAL_WORD}
        </span>
        <h2>{lead.name}</h2>
        <div className="tv-c-charts">
          <figure>
            <figcaption>
              <span>Pace /500m · the field</span>
              <span>Faster is higher</span>
            </figcaption>
            <PaceChart lanes={lanes} />
          </figure>
          <figure>
            <figcaption>
              <span>Splits · {lead.name}</span>
              <span>Every 500 m</span>
            </figcaption>
            <SplitBars lane={lead} />
          </figure>
        </div>
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
            <span className="gap">{l.rank === 0 ? (l.done ? l.fin.value : metresWord(l)) : gapWord(l)}</span>
            <span className="u">{l.rank === 0 ? (l.done ? "finish" : "metres") : l.done ? "on the winner" : "seconds"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---- LOOK C — THE CHART ----------------------------------------------------- */

function ChartLook({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  return (
    <div className="tv-f">
      <header className="tv-head">
        <span className="t">Pace</span>
        <span className="m">/500M OVER THE {GOAL_WORD} · EVERY LANE · THE LEADER BRIGHT</span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <div className="tv-f-body">
        <figure className="tv-f-plot">
          <figcaption>
            <span>Faster is higher</span>
            <span>{lanes.length} {lanes.length === 1 ? "LANE" : "LANES"}</span>
          </figcaption>
          <PaceChart lanes={lanes} tall />
        </figure>
        <ol className="tv-f-key">
          {lanes.map((l) => (
            <li key={l.id} className={l.rank === 0 ? "lead" : ""}>
              <span className="p">{l.rank + 1}</span>
              <span className="nm">{l.name}</span>
              <span className="v">{l.done ? l.fin.value : pace500Word(l)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ---- LOOK D — THE PODIUM ---------------------------------------------------- */

function Podium({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const steps = lanes.slice(0, 3);
  const rest = lanes.slice(3);
  const order = steps.length === 3 ? [steps[1], steps[0], steps[2]] : steps;
  return (
    <div className="tv-g">
      <header className="tv-head">
        <span className="t">Race board</span>
        <span className="m">
          {GOAL_WORD} · {lanes.length} {lanes.length === 1 ? "LANE" : "LANES"} · LIVE
        </span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <div className="tv-g-steps">
        {order.map((l) => (
          <div key={l.id} className={l.rank === 0 ? "tv-g-step first" : "tv-g-step"}>
            <span className="tv-eye">{l.done ? (l.rank === 0 ? "Winner" : "Finished") : l.rank === 0 ? "Leading" : `${gapWord(l)} s behind`}</span>
            <span className="p">{l.rank + 1}</span>
            <span className="nm">{l.name}</span>
            <span className="big">{l.done ? l.fin.value : metresWord(l)}</span>
            <div className="kv">
              <div>
                <b>{l.done ? (l.avgPace ? fmtPace(l.avgPace) : "—") : pace500Word(l)}</b>
                <span className="k">{l.done ? "avg /500m" : "last 500 m"}</span>
              </div>
              <div>
                <b>{l.done ? gapWord(l) : l.fin.value}</b>
                <span className="k">{l.done ? "on the winner" : "expected"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="tv-g-rest">
          {rest.map((l) => (
            <li key={l.id}>
              <span className="p">{l.rank + 1}</span>
              <span className="nm">{l.name}</span>
              <span className="v">{l.done ? l.fin.value : gapWord(l)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---- LOOK E — THE GAPS ------------------------------------------------------ */

function Gaps({ lanes, clockS }: { lanes: Lane[]; clockS: number }) {
  const leadM = lanes.reduce((best, l) => Math.max(best, l.m), 0) || 1;
  return (
    <div className="tv-h">
      <header className="tv-head">
        <span className="t">Gaps</span>
        <span className="m">
          {GOAL_WORD} · THE LEADER FULL · EVERY LANE AS FAR AS THEY ARE
        </span>
        <span className="c">{clockWord(clockS)}</span>
      </header>
      <ol className="tv-h-rows">
        {lanes.map((l) => (
          <li key={l.id} className={l.rank === 0 ? "lead" : ""}>
            <span className="p">{l.rank + 1}</span>
            <span className="nm">{l.name}</span>
            <span className="trk" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (l.m / leadM) * 100)}%` }} />
            </span>
            <span className="g">
              {l.rank === 0 ? (l.done ? l.fin.value : metresWord(l)) : gapWord(l)}
              <i>{l.rank === 0 ? (l.done ? "finish" : "metres") : l.done ? "on the winner" : `${Math.round(l.behindM)} m back`}</i>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
