"use client";

import { useMemo, useState } from "react";
import { fmtMeters } from "@/lib/row100k";

/* THE PLAN (owner ask, 2026-09-08, dev for now): "a tool to input how many
 * meters a day and at what pace I need to hit a meter number and an
 * overall average pace. If I want to hit 500K at a 1:59 pace, what do I
 * need to average per day and at what pace?"
 *
 * Arithmetic, nothing else. Where you are (meters rowed, seconds rowed,
 * days left including today) is prefilled from your own rows and stays
 * editable so any what-if can be run. The answer is two numbers: the
 * meters a day that close the gap in the days left, and the split the rest
 * of the meters have to be rowed at for the whole month to average the
 * target — which can come out faster than any human split, in which case
 * the tool says so instead of printing it. */

const parseSplit = (v: string): number | null => {
  const m = /^\s*(\d{1,2}):(\d{2})(?:\.(\d))?\s*$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 10 : 0);
};
const clock = (s: number) => {
  const t = Math.round(s * 10);
  return `${Math.floor(t / 600)}:${String(Math.floor((t % 600) / 10)).padStart(2, "0")}.${t % 10}`;
};
const hms = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};

export function PlanTool({
  meters,
  seconds,
  daysLeft,
  goal,
}: {
  /* where the signed-in rower is right now; editable below */
  meters: number;
  seconds: number;
  /* days still to row, today included */
  daysLeft: number;
  /* the challenge goal, as the default target */
  goal: number;
}) {
  const [target, setTarget] = useState(String(Math.max(goal, Math.ceil(meters / 50_000) * 50_000 + 50_000)));
  const [pace, setPace] = useState("1:59");
  const [have, setHave] = useState(String(meters));
  const [spent, setSpent] = useState(String(seconds));
  const [days, setDays] = useState(String(daysLeft));

  const out = useMemo(() => {
    const T = Number(target);
    const P = parseSplit(pace);
    const M = Number(have);
    const S = Number(spent);
    const D = Number(days);
    if (!(T > 0) || P === null || !(M >= 0) || !(S >= 0) || !(D > 0)) return null;
    const left = T - M;
    if (left <= 0) return { done: true as const, T, M };
    const perDay = left / D;
    const targetSeconds = (T / 500) * P;
    const remainingSeconds = targetSeconds - S;
    const needSplit = remainingSeconds / (left / 500);
    const currentSplit = M > 0 && S > 0 ? S / (M / 500) : null;
    return { done: false as const, T, P, M, S, D, left, perDay, targetSeconds, remainingSeconds, needSplit, currentSplit };
  }, [target, pace, have, spent, days]);

  const field = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
    <>
      <label className="fl" htmlFor={id}>
        {label}
      </label>
      <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={hint} />
    </>
  );

  return (
    <>
      <form className="panel" onSubmit={(e) => e.preventDefault()}>
        <div className="p-head">
          <h3>The target</h3>
          <span className="mono">METERS · SPLIT</span>
        </div>
        {field("pl-target", "Meters to reach", target, setTarget, "500000")}
        {field("pl-pace", "Overall average split to hold, per 500 m", pace, setPace, "1:59")}

        <div className="p-head" style={{ marginTop: 26 }}>
          <h3>Where you are</h3>
          <span className="mono">PREFILLED FROM YOUR ROWS</span>
        </div>
        {field("pl-have", "Meters rowed so far", have, setHave)}
        {field("pl-spent", "Seconds rowed so far", spent, setSpent)}
        {field("pl-days", "Days left, today included", days, setDays)}
      </form>

      <div className="sec-head" style={{ marginTop: 40 }}>
        <h2>What it takes</h2>
        <span className="mono">{out ? (out.done ? "ALREADY THERE" : `${out.D} ${out.D === 1 ? "DAY" : "DAYS"}`) : "FILL IN THE TARGET"}</span>
      </div>

      {!out ? (
        <p className="board-empty">A TARGET IN METERS, A SPLIT LIKE 1:59, AND THE DAYS LEFT.</p>
      ) : out.done ? (
        <p className="board-empty">
          {fmtMeters(out.M)} ROWED — THE {fmtMeters(out.T).toUpperCase()} TARGET IS BEHIND YOU.
        </p>
      ) : (
        <div className="st-tiles">
          <div className="st-tile you">
            <div className="k mono">Meters a day</div>
            <div className="n">
              {fmtMeters(Math.ceil(out.perDay))}
            </div>
            <div className="l mono">
              {fmtMeters(out.left).toUpperCase()} TO GO · {out.D} {out.D === 1 ? "DAY" : "DAYS"}
            </div>
          </div>
          <div className="st-tile you">
            <div className="k mono">Split from here</div>
            <div className="n">
              {out.needSplit > 0 && out.needSplit >= 60 ? (
                <>
                  {clock(out.needSplit)} <span className="u">/500m</span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="l mono">
              {out.needSplit <= 0
                ? `NOT POSSIBLE — THE TIME ROWED ALREADY PASSES A ${pace} AVERAGE OVER ${fmtMeters(out.T).toUpperCase()}`
                : out.needSplit < 60
                  ? `NOT REALISTIC — ${clock(out.needSplit)} PER 500 M FOR THE REST`
                  : out.currentSplit !== null
                    ? `NOW AVERAGING ${clock(out.currentSplit)} · ${hms(Math.max(0, out.remainingSeconds)).toUpperCase()} MORE ON THE ERG`
                    : `${hms(Math.max(0, out.remainingSeconds)).toUpperCase()} ON THE ERG`}
            </div>
          </div>
          <div className="st-tile">
            <div className="k mono">Time a day</div>
            <div className="n">
              {out.needSplit > 0 ? hms(Math.max(0, out.remainingSeconds) / out.D) : "—"}
            </div>
            <div className="l mono">
              {out.needSplit > 0 ? `AT THAT SPLIT, ${fmtMeters(Math.ceil(out.perDay)).toUpperCase()} A DAY` : "NO SPLIT TO ROW AT"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
