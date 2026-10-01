"use client";

import { useState } from "react";
import { TextMenu } from "../TextMenu";
import { statsHref } from "../stats/statsUrl";
import type { LandingMonth } from "../landing/data";

/* THE MONTH on the landing (owner, 2026-10-01: "before how it counts and
 * the cards, we should have a stats section … the month diagram — how many
 * meters have been logged every day of the month … and then allow users to
 * see the previous months with a selector — click October and have
 * September be selectable … let's try that with the month charts").
 *
 * The site's heat calendar (Heatmap.tsx, as the stats page draws it whole):
 * weekday letters over one cell per day, each cell shaded by everyone's
 * meters that day with the k figure inside, the days still to come as dim
 * dashed cells. Drawn here rather than with Heatmap itself because that
 * one's ramp is the theme's (.hm-cell b1..b4: water blues on paper, greys
 * under the ink look) and this page is its own ground with its own accent
 * — the cells are .l1-c s1..s5 in l1Css.ts, ONE hue, mixed from the
 * palette's accent and the ground, so the calendar follows whatever the
 * palette is (owner, same day: "the colors on some of these charts are a
 * little funky — blue and also red").
 *
 * The month word on the head's right is a TextMenu, the same word-that-is-
 * a-menu the stats page hangs its months on. Every month so far came with
 * the page (landing/data.ts LandingMonth — one number per day), so a pick
 * is a swap of state: no fetch, no navigation, no scroll. Each line keeps
 * a real href (that month on the stats page) for a middle click.
 *
 * One mono line under the calendar: the month's meters and its rowers. */

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = (n: number) => n.toLocaleString("en-US");

/* Five steps off the month's biggest day, the stats page's rule (a share
 * of the biggest day on record) cut one finer: a community's days sit
 * closer together than one rower's, and four steps drew most of a month in
 * two shades. */
function step(m: number, top: number): number {
  if (m <= 0 || top <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((m / top) * 5)));
}

export function L1Month({ months, current }: { months: LandingMonth[]; current: string }) {
  /* Opens on the month the clock is in — or, before it has a meter (the
   * 1st, first thing), on the newest month that has one, the way the fold
   * prints the all-time figures rather than two zeros. */
  const live = months.find((m) => m.key === current);
  const first = live && live.meters > 0 ? live : ([...months].reverse().find((m) => m.meters > 0) ?? live ?? months[months.length - 1]);
  const [key, setKey] = useState(first?.key ?? current);
  const mon = months.find((m) => m.key === key) ?? first;
  if (!mon) return null;

  const top = Math.max(0, ...mon.byDay);
  const tag = SHORT[Number(mon.key.slice(5, 7)) - 1] ?? "";
  const today = mon.key === current ? mon.elapsed : 0;

  return (
    <section className="l1-sec l1-month">
      {/* The head line is the section head of the page (.l1-h) with the
          heading inside it, so the menu and its list sit beside the
          heading and not in it. */}
      <div className="l1-h">
        <h2>The month</h2>
        {months.length > 1 ? (
          <TextMenu
            /* Newest first: the month a visitor is in, then back. */
            options={[...months].reverse().map((m) => ({ key: m.key, label: m.label, href: statsHref({ m: m.key }, current), soft: true }))}
            value={mon.key}
            ariaLabel="Which month"
            align="right"
            onPick={setKey}
          />
        ) : (
          <span>{mon.label}</span>
        )}
      </div>

      <div className="l1-cal" role="img" aria-label={`Meters logged per day, ${mon.label}`}>
        {DOW.map((d, i) => (
          <div className="l1-dow" key={`${d}${i}`}>
            {d}
          </div>
        ))}
        {Array.from({ length: mon.firstDow }, (_, i) => (
          <div key={`blank${i}`} />
        ))}
        {mon.byDay.map((m, i) => {
          const d = i + 1;
          const todo = d > mon.elapsed;
          const s = todo ? 0 : step(m, top);
          const cls = ["l1-c", s ? `s${s}` : "", todo ? "todo" : "", d === today ? "now" : ""].filter(Boolean).join(" ");
          return (
            <div key={`${mon.key}-${d}`} className={cls} title={todo ? `${tag} ${d}` : `${tag} ${d} — ${num(m)} m`}>
              {s ? <span aria-hidden="true">{`${Math.max(1, Math.round(m / 1000))}k`}</span> : null}
            </div>
          );
        })}
      </div>

      <p className="l1-cal-sum mono" aria-live="polite">
        <span className="l1-nb">
          <b>{num(mon.meters)}</b> meters
        </span>
        {" · "}
        <span className="l1-nb">
          <b>{num(mon.rowers)}</b> {mon.rowers === 1 ? "rower" : "rowers"}
        </span>
      </p>
    </section>
  );
}
