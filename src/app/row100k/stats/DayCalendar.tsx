"use client";

import type { MouseEvent as ReactMouseEvent } from "react";

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
 * Every cell and arrow is a real link to the same board — a middle click
 * or a long press opens the page — and a plain tap is handed up instead
 * (data-inplace keeps the tap line off it, NavProgress.tsx). Pure markup;
 * the state is the shell's. */

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export type CalendarStep = { label: string; href: string; onStep: () => void };

/* A plain left click is the pick; a modified one keeps the browser's own
 * meaning for the link. */
const soft = (fn: () => void) => (ev: ReactMouseEvent<HTMLAnchorElement>) => {
  if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  ev.preventDefault();
  fn();
};

export function DayCalendar({
  month,
  maxDay,
  value,
  today,
  hrefFor,
  onPick,
  prev,
  next,
  close,
}: {
  month: { key: string; label: string; firstDow: number; days: number };
  /* Index of the last day that can be picked (the last that happened). */
  maxDay: number;
  /* Index of the day on the board. */
  value: number;
  /* Index of today, when the month is the live one. */
  today: number | null;
  hrefFor: (i: number) => string;
  onPick: (i: number) => void;
  prev?: CalendarStep;
  next?: CalendarStep;
  close: () => void;
}) {
  return (
    <div className="st-cal">
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
      <div className="st-cal-grid" role="grid" aria-label={`Days of ${month.label}`}>
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`} aria-hidden="true">
            {d}
          </div>
        ))}
        {Array.from({ length: month.firstDow }, (_, i) => (
          <div key={`blank${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: month.days }, (_, i) => {
          const on = i === value;
          const isToday = today === i;
          if (i > maxDay) {
            return (
              <span key={i} className="st-cal-cell off" aria-disabled="true">
                {i + 1}
              </span>
            );
          }
          const cls = `st-cal-cell${on ? " on" : ""}${isToday ? " today" : ""}`;
          return (
            <a
              key={i}
              className={cls}
              href={hrefFor(i)}
              data-inplace=""
              aria-current={on ? "date" : undefined}
              aria-label={`Day ${i + 1}${isToday ? ", today" : ""}`}
              onClick={soft(() => {
                onPick(i);
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
