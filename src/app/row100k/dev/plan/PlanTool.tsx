"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import { fmtMeters } from "@/lib/row100k";
import {
  autoDays,
  autoDistribute,
  clock,
  dayKey,
  fmtK,
  freshPlan,
  needOf,
  parseMetersText,
  parseSplit,
  releaseDay,
  remainingDays,
  requiredSplit,
  revivePlan,
  runningAverage,
  setDay,
  setTarget,
  toggleOff,
  unallocated,
  type Plan,
} from "./planMath";
import { PlanPace } from "./PlanPace";

/* THE PLAN (owner, 2026-09-24, condensed): "Make the plan more user
 * friendly. Default the target to 100,000 meters and REMEMBER whatever
 * the user puts in. Do not prefill the average pace. By default show how
 * many meters are needed and how many days are left. Show a CALENDAR of
 * the remaining days with the meters split among them. Let me change the
 * number for each day, click a day to turn it off, set a day to 5K
 * instead of 10K — but do NOT redistribute the removed meters
 * automatically: note that 3K is unallocated and needs a home, and give
 * me an AUTO DISTRIBUTE button. If I enter a pace goal, show the chart of
 * where my average pace is now and where it needs to go. Remember the
 * plan when I come back."
 *
 * The arithmetic is planMath.ts. This is the calendar and the fields.
 *
 * REMEMBERED in this browser, per rower (localStorage, keyed by the
 * namespace and rower number): the target, the pace goal, and every day
 * of the month's plan. Server-side persistence needs a column on
 * RowParticipant later (no schema change in this pass); until then a plan
 * lives in the browser it was made in. The first paint is the untouched
 * plan (the server cannot see the browser); the saved one lands on mount. */

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

  const [plan, setPlan] = useState<Plan>(() =>
    freshPlan({ monthKey: month.key, monthDays: month.days, today, target: 100_000, rowed }),
  );
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
    const revived = revivePlan(raw, { monthKey: month.key, monthDays: month.days, today, rowed });
    setPlan(revived);
    setTargetText(String(revived.target));
    setLoaded(true);
  }, [key, month.key, month.days, today, rowed]);

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
  const un = unallocated(plan, remaining, need);
  const free = autoDays(plan, remaining);
  const openDays = remaining.filter((d) => !plan.days[d]?.off).length;
  const daysLeft = remaining.length;

  const commitTarget = () => {
    const n = parseMetersText(targetText);
    if (n === null || n <= 0) {
      setTargetText(String(plan.target));
      return;
    }
    if (n !== plan.target) setPlan((p) => setTarget(p, n, remaining, rowed));
    setTargetText(String(n));
  };

  /* ---- the pace goal (blank until the rower types one) */
  const goal = parseSplit(plan.pace);
  const rowedSeconds = rows.reduce((s, r) => s + (r.meters > 0 && r.seconds > 0 ? r.seconds : 0), 0);
  const timedMeters = rows.reduce((s, r) => s + (r.meters > 0 && r.seconds > 0 ? r.meters : 0), 0);
  const needSplit = goal !== null ? requiredSplit(plan.target, goal, timedMeters, rowedSeconds) : null;
  const avgPts = useMemo(() => runningAverage(rows), [rows]);

  /* ---- editing a day in place */
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  /* Set on a mousedown on one of the words inside the editing cell, so the
   * field keeps focus (no blur commit) while the word does its thing. */
  const holding = useRef(false);

  const beginEdit = (day: string) => {
    setEditing(day);
    setEditText(String(plan.days[day]?.m ?? 0));
  };
  const commitEdit = () => {
    if (editing === null) return;
    const n = parseMetersText(editText);
    if (n !== null) setPlan((p) => setDay(p, editing, n));
    setEditing(null);
  };
  const onEditKey = (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  };
  const hold = (e: React.MouseEvent) => {
    e.preventDefault();
    holding.current = true;
  };
  const onEditBlur = () => {
    if (holding.current) {
      holding.current = false;
      return;
    }
    commitEdit();
  };

  /* ---- the calendar cells */
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < month.firstDow; i++) cells.push(<div key={`blank${i}`} />);
  for (let n = 1; n <= month.days; n++) {
    const day = dayKey(month.key, n);
    const label = `${month.short} ${n}`;
    if (n < today) {
      const m = byDay[day] ?? 0;
      cells.push(
        <div key={day} className={`pl-day past${m > 0 ? " rowed" : ""}`} title={`${label} — ${fmtMeters(m)} rowed`}>
          <div className="d">{n}</div>
          <div className="m">{m > 0 ? fmtK(m) : "—"}</div>
        </div>,
      );
      continue;
    }
    const c = plan.days[day] ?? { m: 0, pinned: false, off: false };
    const isToday = n === today;
    const rowedToday = isToday ? (byDay[day] ?? 0) : 0;
    if (editing === day) {
      cells.push(
        <div key={day} className={`pl-day edit${isToday ? " today" : ""}`}>
          <div className="d">{n}</div>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Meters planned for ${label}`}
            value={editText}
            autoFocus
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={onEditKey}
            onBlur={onEditBlur}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="acts">
            <button
              type="button"
              className="tm-btn"
              onMouseDown={hold}
              onClick={() => {
                holding.current = false;
                setPlan((p) => toggleOff(p, day));
                setEditing(null);
              }}
            >
              {c.off ? "On" : "Off"}
            </button>
            {c.pinned && (
              <button
                type="button"
                className="tm-btn"
                title="Hand this day back to auto distribute"
                onMouseDown={hold}
                onClick={() => {
                  holding.current = false;
                  setPlan((p) => releaseDay(p, day));
                  setEditing(null);
                }}
              >
                Auto
              </button>
            )}
          </div>
        </div>,
      );
      continue;
    }
    cells.push(
      <button
        key={day}
        type="button"
        className={`pl-day${c.off ? " off" : ""}${c.pinned ? " set" : ""}${isToday ? " today" : ""}`}
        title={c.off ? `${label} — off` : `${label} — ${fmtMeters(c.m)} planned`}
        aria-label={c.off ? `${label}, off. Tap to edit.` : `${label}, ${fmtMeters(c.m)} planned. Tap to edit.`}
        onClick={() => beginEdit(day)}
      >
        <div className="d">{n}</div>
        <div className="m">{c.off ? "OFF" : fmtK(c.m)}</div>
        {rowedToday > 0 && <div className="s">{fmtK(rowedToday)} rowed</div>}
      </button>,
    );
  }

  const statusClass = `pl-status${un === 0 || need === 0 ? " ok" : ""}`;

  return (
    <>
      <form className="panel" onSubmit={(e) => e.preventDefault()}>
        <div className="p-head">
          <h3>The target</h3>
          <span className="mono">METERS THIS MONTH · A PACE GOAL IF YOU WANT ONE</span>
        </div>
        <div className="pl-fields">
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
            <div className="hint">Remembered. 100,000 unless you say otherwise.</div>
          </div>
          <div>
            <label className="fl" htmlFor="pl-pace">
              Pace goal, per 500 m
            </label>
            <input
              id="pl-pace"
              type="text"
              inputMode="decimal"
              value={plan.pace}
              onChange={(e) => setPlan((p) => ({ ...p, pace: e.target.value }))}
              placeholder="1:59.9 (optional)"
            />
            <div className="hint">{plan.pace.trim() === "" ? "Optional. The average split for the whole month." : goal === null ? "A split like 1:59.9 or 2:05" : `Averaging ${clock(goal)} over ${fmtMeters(plan.target)}`}</div>
          </div>
        </div>
      </form>

      <div className="st-tiles" style={{ marginTop: 28 }}>
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
          <div className="n">{openDays > 0 ? fmtMeters(Math.ceil(need / openDays)) : "—"}</div>
          <div className="l mono">
            {openDays > 0 ? `SPREAD OVER ${openDays} OPEN ${openDays === 1 ? "DAY" : "DAYS"}` : "EVERY DAY LEFT IS OFF"}
          </div>
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
                    : avgPts.length
                      ? `NOW AVERAGING ${clock(avgPts[avgPts.length - 1].s)}`
                      : "NO TIMED ROWS YET"}
            </div>
          </div>
        )}
      </div>

      <div className="sec-head" style={{ marginTop: 40 }}>
        <h2>The calendar</h2>
        <span className="mono">{month.label.toUpperCase()} · TAP A DAY TO CHANGE IT</span>
      </div>

      <div className={statusClass} role="status">
        {need === 0 ? (
          <span>
            <span className="n">TARGET REACHED</span> — NOTHING LEFT TO PLAN
          </span>
        ) : un > 0 ? (
          <span>
            <span className="n">{fmtMeters(un).toUpperCase()} UNALLOCATED</span> — NEEDS A HOME
          </span>
        ) : un < 0 ? (
          <span>
            <span className="n">{fmtMeters(-un).toUpperCase()} OVER</span> THE TARGET
          </span>
        ) : (
          <span>
            <span className="n">EVERY METER HAS A DAY</span>
          </span>
        )}
        {need > 0 && un !== 0 && (
          <button
            type="button"
            className="tm-btn"
            disabled={free.length === 0}
            title={free.length === 0 ? "Every open day is set by hand — open one with AUTO, or change a number" : undefined}
            onClick={() => setPlan((p) => autoDistribute(p, remaining, need))}
          >
            Auto distribute
          </button>
        )}
        {need > 0 && un !== 0 && free.length === 0 && <span>EVERY OPEN DAY IS SET BY HAND</span>}
        <button
          type="button"
          className="tm-btn"
          onClick={() => setPlan((p) => freshPlan({ monthKey: month.key, monthDays: month.days, today, target: p.target, rowed, pace: p.pace }))}
        >
          Start over
        </button>
      </div>

      <div className="pl-cal" role="grid" aria-label={`Planned meters per day, ${month.label}`}>
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`}>
            {d}
          </div>
        ))}
        {cells}
      </div>
      <div className="pl-legend">
        <span>
          <i /> Auto
        </span>
        <span>
          <i className="set" /> Set by you
        </span>
        <span>
          <i className="today" /> Today
        </span>
        <span>
          <i className="past" /> Rowed
        </span>
      </div>

      {goal !== null && need > 0 && (
        <PlanPace pts={avgPts} target={plan.target} goal={goal} need={needSplit !== null && needSplit >= 60 ? needSplit : null} />
      )}
    </>
  );
}
