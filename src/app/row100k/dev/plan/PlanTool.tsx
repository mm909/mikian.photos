"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtMeters } from "@/lib/row100k";
import {
  clock,
  dayKey,
  fmtK,
  freshPlan,
  isOff,
  needOf,
  onDays,
  parseMetersText,
  parseSplit,
  planned,
  remainingDays,
  requiredSplit,
  revivePlan,
  runningAverage,
  setPace,
  setTarget,
  toggleOff,
  type Plan,
} from "./planMath";
import { PlanPace } from "./PlanPace";

/* THE PLAN (owner, 2026-09-25): "Fill the pace goal in with their current
 * average pace (still optional). I don't like the separation between the
 * plan and the calendar: it's just THE PLAN, and the calendar gets a date
 * like December 2026. Simplify the calendar: days are ON or OFF, plus what
 * was actually done. Past days show what I rowed (7K on the first, nothing
 * on the second). Going forward, clicking a day turns it off, clicking
 * again turns it on, and the remaining meters are redistributed
 * automatically across the on days. That's it."
 *
 * So: two fields (the target, the pace goal), three tiles, one calendar.
 * Nothing is typed into a day any more; a day is on or off, and what it
 * holds is the need over the on days (planMath.ts). No status line, no
 * AUTO DISTRIBUTE, no START OVER, no legend — the 2026-09-24 tool had all
 * of them and the owner asked for less.
 *
 * REMEMBERED in this browser, per rower (localStorage, keyed by the
 * namespace and rower number): the target, the pace goal, and the off
 * days. Server-side persistence needs a column on RowParticipant later
 * (no schema change in this pass). The first paint is the untouched plan
 * (the server cannot see the browser); the saved one lands on mount. */

type Row = { day: string; meters: number; seconds: number };
type MonthInfo = { key: string; days: number; firstDow: number; label: string; short: string };

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const STORAGE_PREFIX = "row100k.plan.";

export function PlanTool({
  storageKey,
  month,
  today,
  rows,
}: {
  /* namespace + rower number — one plan per rower per browser */
  storageKey: string;
  month: MonthInfo;
  /* day number the clock is on, 1..days */
  today: number;
  /* the rower's rows this month, in the order they were done */
  rows: Row[];
}) {
  const rowed = useMemo(() => rows.reduce((s, r) => s + r.meters, 0), [rows]);
  const byDay = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.day] = (out[r.day] ?? 0) + r.meters;
    return out;
  }, [rows]);
  const remaining = useMemo(() => remainingDays(month.key, month.days, today), [month.key, month.days, today]);
  const key = STORAGE_PREFIX + storageKey;

  const [plan, setPlan] = useState<Plan>(() => freshPlan({ monthKey: month.key }));
  const [loaded, setLoaded] = useState(false);
  const [targetText, setTargetText] = useState(String(plan.target));

  /* The saved plan, once the browser is here to ask. */
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    const revived = revivePlan(raw, { monthKey: month.key, monthDays: month.days, today });
    setPlan(revived);
    setTargetText(String(revived.target));
    setLoaded(true);
  }, [key, month.key, month.days, today]);

  /* Every change is remembered as it happens — nothing to save. */
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(plan));
    } catch {
      /* private mode, full storage: the plan still works for the visit */
    }
  }, [plan, loaded, key]);

  const need = needOf(plan.target, rowed);
  const on = onDays(plan, remaining);
  const split = planned(plan, remaining, need);
  const daysLeft = remaining.length;

  const commitTarget = () => {
    const n = parseMetersText(targetText);
    if (n === null || n <= 0) {
      setTargetText(String(plan.target));
      return;
    }
    if (n !== plan.target) setPlan((p) => setTarget(p, n));
    setTargetText(String(n));
  };

  /* ---- the pace goal: the month's average split until the rower types
   * (or clears) one. */
  const avgPts = useMemo(() => runningAverage(rows), [rows]);
  const avgNow = avgPts.length ? avgPts[avgPts.length - 1].s : null;
  const paceText = plan.pace ?? (avgNow !== null ? clock(avgNow) : "");
  const goal = parseSplit(paceText);
  const rowedSeconds = rows.reduce((s, r) => s + (r.meters > 0 && r.seconds > 0 ? r.seconds : 0), 0);
  const timedMeters = rows.reduce((s, r) => s + (r.meters > 0 && r.seconds > 0 ? r.meters : 0), 0);
  const needSplit = goal !== null ? requiredSplit(plan.target, goal, timedMeters, rowedSeconds) : null;

  /* ---- the calendar cells */
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < month.firstDow; i++) cells.push(<div key={`blank${i}`} />);
  for (let n = 1; n <= month.days; n++) {
    const day = dayKey(month.key, n);
    const label = `${month.short} ${n}`;
    if (n < today) {
      /* What was actually done, in grey. */
      const m = byDay[day] ?? 0;
      cells.push(
        <div key={day} className={`pl-day past${m > 0 ? " rowed" : ""}`} title={`${label} — ${fmtMeters(m)} rowed`}>
          <div className="d">{n}</div>
          <div className="m">{m > 0 ? fmtK(m) : "—"}</div>
        </div>,
      );
      continue;
    }
    const off = isOff(plan, day);
    const isToday = n === today;
    const rowedToday = isToday ? (byDay[day] ?? 0) : 0;
    const m = split[day] ?? 0;
    cells.push(
      <button
        key={day}
        type="button"
        className={`pl-day${off ? " off" : ""}${isToday ? " today" : ""}`}
        aria-pressed={!off}
        aria-label={off ? `${label}, off. Tap to turn on.` : `${label}, ${fmtMeters(m)}. Tap to turn off.`}
        onClick={() => setPlan((p) => toggleOff(p, day))}
      >
        <div className="d">{n}</div>
        <div className="m">{off ? "" : fmtK(m)}</div>
        {rowedToday > 0 && <div className="s">{fmtK(rowedToday)} rowed</div>}
      </button>,
    );
  }

  return (
    <>
      <form className="pl-fields" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="fl" htmlFor="pl-target">
            Meters to reach
          </label>
          <input
            id="pl-target"
            type="text"
            inputMode="numeric"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTarget();
              }
            }}
            placeholder="100000"
          />
        </div>
        <div>
          <label className="fl" htmlFor="pl-pace">
            Pace goal, per 500 m
          </label>
          <input
            id="pl-pace"
            type="text"
            inputMode="decimal"
            value={paceText}
            onChange={(e) => setPlan((p) => setPace(p, e.target.value))}
            placeholder="1:59.9"
          />
        </div>
      </form>

      <div className="st-tiles pl-tiles">
        <div className="st-tile you">
          <div className="k mono">Still to row</div>
          <div className="n">{fmtMeters(need)}</div>
          <div className="l mono">
            {fmtMeters(rowed).toUpperCase()} ROWED OF {fmtMeters(plan.target).toUpperCase()}
          </div>
        </div>
        <div className="st-tile you">
          <div className="k mono">Days left</div>
          <div className="n">{daysLeft}</div>
          <div className="l mono">
            TODAY INCLUDED · THROUGH {month.short} {month.days}
          </div>
        </div>
        <div className="st-tile">
          <div className="k mono">A day</div>
          <div className="n">{on.length > 0 ? fmtMeters(Math.ceil(need / on.length)) : "—"}</div>
          <div className="l mono">{on.length > 0 ? `${on.length} ${on.length === 1 ? "DAY" : "DAYS"} ON` : "EVERY DAY LEFT IS OFF"}</div>
        </div>
        {goal !== null && (
          <div className="st-tile">
            <div className="k mono">Split from here</div>
            <div className="n">
              {needSplit !== null && needSplit >= 60 ? (
                <>
                  {clock(needSplit)} <span className="u">/500m</span>
                </>
              ) : (
                "—"
              )}
            </div>
            <div className="l mono">
              {needSplit === null || need === 0
                ? "THE TARGET IS BEHIND YOU"
                : needSplit <= 0
                  ? `THE TIME ROWED ALREADY AVERAGES UNDER ${clock(goal)}`
                  : needSplit < 60
                    ? `NOT REALISTIC — ${clock(needSplit)} PER 500 M FOR THE REST`
                    : avgNow !== null
                      ? `NOW AVERAGING ${clock(avgNow)}`
                      : "NO TIMED ROWS YET"}
            </div>
          </div>
        )}
      </div>

      <div className="pl-cal" role="grid" aria-label={`The plan, ${month.label}`}>
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`}>
            {d}
          </div>
        ))}
        {cells}
      </div>

      {goal !== null && need > 0 && (
        <PlanPace pts={avgPts} target={plan.target} goal={goal} need={needSplit !== null && needSplit >= 60 ? needSplit : null} />
      )}
    </>
  );
}
