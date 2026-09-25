"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Week } from "@/lib/rowPeriod";

/* THE CALENDAR PICKER under the day word (owner, 2026-09-25: "the by-day
 * picker must be a CALENDAR picker"): the month as a grid in the house
 * heatmap idiom — weekday letters over dashed cells — with the month's
 * word between two arrows at its head. A day that has happened is a cell
 * that can be picked; the days still to come are there but dim. The pick
 * swaps the board in place and closes the panel. The arrows step to the
 * month either side, which is a change of period the page fetches in
 * place (nothing loads, nothing scrolls); the panel stays open so the
 * next month can be read the moment it lands.
 *
 * THE SAME CALENDAR PICKS A WEEK (owner, 2026-09-25: "when BY WEEK is
 * selected the same calendar opens and hovering a week highlights days 1
 * to 7, 8 to 14 and so on, and a tap picks that week"): in week mode the
 * cells are the same, but a hover — or the keyboard focus — lights every
 * cell of that cell's week (rowPeriod.ts weeksOf: sevens from the 1st),
 * the picked week is the block filled ink, and a tap on any cell of a
 * week that has started picks the week. A week that has not started is
 * dim like a day that has not come.
 *
 * Every cell and arrow is a real link to the same board — a middle click
 * or a long press opens the page — and a plain tap is handed up instead
 * (data-inplace keeps the tap line off it, NavProgress.tsx). The only
 * state in here is which week the pointer is over; the pick is the
 * shell's. */

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export type CalendarStep = { label: string; href: string; onStep: () => void };

export type CalendarMode = "day" | "week";

/* A plain left click is the pick; a modified one keeps the browser's own
 * meaning for the link. */
const soft = (fn: () => void) => (ev: ReactMouseEvent<HTMLAnchorElement>) => {
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  ev.preventDefault();
  fn();
};

export function DayCalendar({
  mode = "day",
  month,
  weeks = [],
  maxDay,
  value,
  today,
  hrefFor,
  onPick,
  prev,
  next,
  close,
}: {
  /* What a tap picks: a day (the default) or the week the day is in. */
  mode?: CalendarMode;
  month: { key: string; label: string; firstDow: number; days: number };
  /* The month's weeks (rowPeriod.ts weeksOf), for week mode. */
  weeks?: Week[];
  /* Index of the last day that can be picked (the last that happened). */
  maxDay: number;
  /* Index of the day on the board — of the WEEK, in week mode. */
  value: number;
  /* Index of today, when the month is the live one. */
  today: number | null;
  /* The board for a day index — for a week index, in week mode. */
  hrefFor: (i: number) => string;
  onPick: (i: number) => void;
  prev?: CalendarStep;
  next?: CalendarStep;
  close: () => void;
}) {
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const weekMode = mode === "week";
  const dayKey = (i: number) => `${month.key}-${String(i + 1).padStart(2, "0")}`;
  const weekOf = (i: number): number => {
    const k = dayKey(i);
    return weeks.findIndex((w) => k >= w.first && k <= w.last);
  };
  /* A week can be picked once its first day has happened. */
  const maxWeek = weeks.length > 0 ? Math.max(0, weekOf(Math.max(0, Math.min(maxDay, month.days - 1)))) : -1;
  const weekLabel = (wi: number): string => {
    const w = weeks[wi];
    if (!w) return `Week ${wi + 1}`;
    return `${w.label}, ${Number(w.first.slice(8, 10))} to ${Number(w.last.slice(8, 10))}`;
  };

  return (
    <div className={weekMode ? "st-cal st-cal-weeks" : "st-cal"}>
      <div className="st-cal-head">
        {prev ? (
          <a className="st-cal-arrow" href={prev.href} aria-label={prev.label} data-inplace="" onClick={soft(prev.onStep)}>
            ‹
          </a>
        ) : (
          <span className="st-cal-arrow off" aria-hidden="true">
            ‹
          </span>
        )}
        <span className="st-cal-month">{month.label}</span>
        {next ? (
          <a className="st-cal-arrow" href={next.href} aria-label={next.label} data-inplace="" onClick={soft(next.onStep)}>
            ›
          </a>
        ) : (
          <span className="st-cal-arrow off" aria-hidden="true">
            ›
          </span>
        )}
      </div>
      <div
        className="st-cal-grid"
        role="grid"
        aria-label={weekMode ? `Weeks of ${month.label}` : `Days of ${month.label}`}
        onMouseLeave={weekMode ? () => setHoverWeek(null) : undefined}
      >
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`} aria-hidden="true">
            {d}
          </div>
        ))}
        {Array.from({ length: month.firstDow }, (_, i) => (
          <div key={`blank${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: month.days }, (_, i) => {
          const isToday = today === i;
          const wi = weekMode ? weekOf(i) : -1;
          /* In week mode the cell stands for its week: on when the week
           * is the one on the board, lit while the pointer is over any
           * cell of it, off when the week has not started. */
          const on = weekMode ? wi === value : i === value;
          const lit = weekMode && hoverWeek != null && wi === hoverWeek;
          const off = weekMode ? wi < 0 || wi > maxWeek : i > maxDay;
          if (off) {
            return (
              <span key={i} className="st-cal-cell off" aria-disabled="true">
                {i + 1}
              </span>
            );
          }
          const cls = `st-cal-cell${on ? " on" : ""}${lit ? " lit" : ""}${isToday ? " today" : ""}`;
          const pick = weekMode ? wi : i;
          const label = weekMode ? weekLabel(wi) : `Day ${i + 1}${isToday ? ", today" : ""}`;
          return (
            <a
              key={i}
              className={cls}
              href={hrefFor(pick)}
              data-inplace=""
              data-week={weekMode ? wi + 1 : undefined}
              aria-current={on ? (weekMode ? "true" : "date") : undefined}
              aria-label={label}
              onMouseEnter={weekMode ? () => setHoverWeek(wi) : undefined}
              onFocus={weekMode ? () => setHoverWeek(wi) : undefined}
              onBlur={weekMode ? () => setHoverWeek((h) => (h === wi ? null : h)) : undefined}
              onClick={soft(() => {
                onPick(pick);
                close();
              })}
            >
              {i + 1}
            </a>
          );
        })}
      </div>
    </div>
  );
}
