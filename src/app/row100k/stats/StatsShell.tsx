"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HourGrid } from "../HourGrid";
import { MonthSection } from "../MonthSection";
import { PageHead } from "../PageHead";
import { StatsShare } from "../StatsShare";
import { StatsBoards, StatsRecords, type BoardMode } from "../Stats";
import { TextMenu } from "../TextMenu";
import { RECORD_DEFS, recordDef, type RecordKey } from "../records/defs";
import { FieldSection } from "./FieldSection";
import { PerfectAttendance } from "./PerfectAttendance";
import type { StatsPayload } from "./statsData";
import { rankingsHref, statsHref } from "./statsUrl";

/* THE STATS PAGE, below the bar, as one client shell (owner, 2026-09-25:
 * "every time I click fastest 5K / 10K / a month / a day there's a loading
 * page and my scroll resets. There shouldn't be. Whatever we need to do to
 * swap the data without a loading bar, do it").
 *
 * The server renders this once with the period the URL named
 * (stats/page.tsx → statsData.ts). From then on nothing navigates:
 *   - the STAT word swaps between the five boards already in hand;
 *   - the MONTH word — and the calendar's arrows — fetch the period as
 *     JSON from /api/row100k/stats?m= (the same builder, masked for this
 *     viewer the same way) and swap it in, remembering every period seen
 *     so the way back is instant;
 *   - the DAY (a calendar) and the WEEK (a word menu) are picks into the
 *     boards already here.
 * The URL follows with history.replaceState, so a reload or a shared link
 * lands on the same view (statsUrl.ts spells it; the server reads it), and
 * every soft line keeps a real href for a middle click. The tap line
 * (NavProgress.tsx) never runs: no page is coming. While a month is on its
 * way the page dims a touch (aria-busy) so the tap is seen to land; a fetch
 * that fails falls back to loading the page the old way rather than
 * leaving the wrong month on screen. */

type Land = "first" | "last" | "today";

export function StatsShell({
  initial,
  statKey: statKey0,
  day0,
  week0,
}: {
  initial: StatsPayload;
  /* From ?s=, validated by the page. */
  statKey: RecordKey;
  /* From ?day= / ?w= (1-based), when the URL named one; a named week opens
   * the week board. */
  day0: number | null;
  week0: number | null;
}) {
  const [data, setData] = useState<StatsPayload>(initial);
  const [statKey, setStatKey] = useState<RecordKey>(statKey0);
  const [mode, setMode] = useState<BoardMode>(week0 != null ? "week" : "day");
  const [day, setDayState] = useState<number>(day0 != null ? Math.max(0, Math.min(initial.todayDay, day0 - 1)) : initial.todayDay);
  const [week, setWeekState] = useState<number>(week0 != null ? Math.max(0, week0 - 1) : initial.defaultWeek);
  /* Whether the day / week in the URL is the viewer's own pick (kept on a
   * reload) or just the default (kept out of the URL). */
  const [dayPicked, setDayPicked] = useState(day0 != null);
  const [weekPicked, setWeekPicked] = useState(week0 != null);
  const [busy, setBusy] = useState(false);

  /* Every period seen this visit, by key — the way back is a swap. */
  const seen = useRef<Map<string, StatsPayload>>(new Map([[initial.period.key, initial]]));
  /* The latest request wins; an older answer landing late is dropped. */
  const seq = useRef(0);

  const setDay = (i: number) => {
    setDayState(i);
    setDayPicked(true);
  };
  const setWeek = (i: number) => {
    setWeekState(i);
    setWeekPicked(true);
  };

  const land = useCallback((p: StatsPayload, where: Land) => {
    setData(p);
    if (where === "first") {
      setDayState(0);
      setWeekState(0);
      setDayPicked(true);
      setWeekPicked(false);
    } else if (where === "last") {
      setDayState(p.todayDay);
      setWeekState(p.defaultWeek);
      setDayPicked(true);
      setWeekPicked(false);
    } else {
      setDayState(p.todayDay);
      setWeekState(p.defaultWeek);
      setDayPicked(false);
      setWeekPicked(false);
    }
  }, []);

  const goPeriod = useCallback(
    async (key: string, where: Land = "today") => {
      const my = ++seq.current;
      const had = seen.current.get(key);
      if (had) {
        land(had, where);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/row100k/stats?m=${encodeURIComponent(key)}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const json = (await res.json()) as { ok: boolean; data?: StatsPayload; error?: string };
        if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (my !== seq.current) return;
        seen.current.set(key, json.data);
        land(json.data, where);
      } catch (err) {
        console.error("row100k/stats: could not swap the period in place", err);
        if (my !== seq.current) return;
        /* The old way: the page itself, at the address the pick meant. */
        window.location.assign(statsHref({ m: key, s: statKey }, data.currentMonthKey));
      } finally {
        if (my === seq.current) setBusy(false);
      }
    },
    [land, statKey, data.currentMonthKey],
  );

  /* THE URL FOLLOWS THE VIEW. replaceState, never push: a pick is not a
   * page, and the back button should leave the stats altogether. Next
   * syncs its router to a replaceState (14.1+), so useSearchParams users
   * see the change without a fetch. */
  const periodKey = data.period.key;
  const cur = data.currentMonthKey;
  useEffect(() => {
    const href = statsHref(
      {
        m: periodKey,
        s: statKey,
        day: mode === "day" && dayPicked ? day + 1 : undefined,
        w: mode === "week" && weekPicked ? week + 1 : undefined,
      },
      cur,
    );
    const now = window.location.pathname + window.location.search;
    if (now === href) return;
    try {
      window.history.replaceState(null, "", href);
    } catch {
      /* A browser that refuses is a browser that keeps the old address. */
    }
  }, [periodKey, statKey, mode, day, week, dayPicked, weekPicked, cur]);

  const def = recordDef(statKey) ?? RECORD_DEFS[0];
  const href = (q: { m?: string; s?: string; day?: number; w?: number }) =>
    statsHref({ m: periodKey, s: statKey, ...q }, cur);

  /* THE MONTH WORD — every month so far and all time, each a soft line:
   * a plain tap swaps the period in place, a middle click opens the page. */
  const monthWord = (
    <TextMenu
      options={data.periods.map((o) => ({ key: o.key, label: o.label, href: href({ m: o.key }), soft: true }))}
      value={periodKey}
      ariaLabel="Which month"
      onPick={(k) => {
        if (k !== periodKey) void goPeriod(k, "today");
      }}
    />
  );

  /* THE STAT WORD: the five boards are already here, so this is a swap. */
  const statWord = (
    <TextMenu
      options={RECORD_DEFS.map((d) => ({ key: d.key, label: d.title, href: href({ s: d.key }), soft: true }))}
      value={statKey}
      ariaLabel="Which stat"
      onPick={(k) => setStatKey((recordDef(k) ?? RECORD_DEFS[0]).key)}
    />
  );

  const m = data.month;
  const community = {
    ...data.community,
    byDay: data.communityByDay,
    daily: data.curve,
    hourGrid: data.hourGrid,
    days: data.gridDayCount,
  };

  return (
    <div className="st-swap" aria-busy={busy || undefined}>
      {/* THE HEAD: the month word as the dateline, the community total in
          the odometer, and SHARE A CARD on the dateline's right (owner,
          2026-09-25: "put it on the same line as the DECEMBER 2026 word, on
          the right"). The three figures that sat under the odometer are
          gone (owner, 2026-09-25: "remove them for now"). */}
      <div className="ph-sec">
        <div className="wrap">
          <PageHead
            name=""
            dateline={monthWord}
            meters={data.unavailable ? null : data.community.meters}
            unit="Meters"
            aside={<StatsShare community={community} prefer="rowtember-community-month" />}
          />
        </div>
      </div>

      {/* The stat block runs straight off the head: the two words, the
          leading value, the podiums (owner call, 2026-09-05 — the leaders
          and their values carry the emphasis, not the controls). */}
      <section>
        <div className="wrap">
          <StatsRecords
            records={data.records}
            statKey={def.key}
            pick={
              <>
                {monthWord}
                <span className="dot">·</span>
                {statWord}
              </>
            }
            rankingsHref={rankingsHref(def.key, periodKey)}
            started={data.started}
            meId={data.meId}
            anyHidden={data.anyHidden}
            unavailable={data.unavailable}
            blackout={data.blackout}
          />
        </div>
      </section>

      {/* Meters by day / by week — the section head is the period itself,
          so StatsBoards prints it. */}
      <section>
        <div className="wrap">
          <StatsBoards
            month={m}
            weeks={data.weeks}
            live={data.liveMonth}
            weekly={data.weekly}
            daily={data.daily}
            dayTotals={data.dayTotals}
            weekTotals={data.weekTotals}
            todayDay={data.todayDay}
            mode={mode}
            day={day}
            week={week}
            onMode={setMode}
            onDay={setDay}
            onWeek={setWeek}
            onStepMonth={(dir) => {
              const to = dir === "prev" ? data.prev : data.next;
              if (to) void goPeriod(to.key, dir === "prev" ? "last" : "first");
            }}
            hrefDay={(i) => href({ day: i + 1 })}
            hrefWeek={(i) => href({ w: i + 1 })}
            hrefStep={(dir) =>
              dir === "prev"
                ? statsHref({ m: data.prev?.key, s: statKey, day: 31 }, cur)
                : statsHref({ m: data.next?.key, s: statKey, day: 1 }, cur)
            }
            started={data.started}
            meId={data.meId}
            maskedIds={data.maskedIds}
            prev={data.prev}
            next={data.next}
          />
        </div>
      </section>

      {/* THE MONTH: the calendar alone under its title (owner, 2026-09-24:
          no subtitle). */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
          </div>
          <MonthSection
            month={{ key: m.key, firstDow: m.firstDow, days: m.days }}
            byDay={data.communityByDay}
            thresholds={data.thresholds}
            days={data.gridDayCount}
          />
        </div>
      </section>

      {/* THE HOURS: the grid alone (owner, 2026-09-24). */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The hours</h2>
          </div>
          <HourGrid grid={data.hourGrid} month={m.label.slice(0, 3)} />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The field</h2>
            <span className="mono">
              EVERY ROW · LENGTH AND PACE{data.field && data.field.rowers > 0 ? ` · ${data.field.rowers} ROWERS` : ""}
            </span>
          </div>
          <FieldSection field={data.field} hours={data.hours} distances={data.distances} />
        </div>
      </section>

      {/* PERFECT ATTENDANCE (owner, 2026-09-21), last on the page since
          2026-09-24 (owner: below THE FIELD). */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Perfect attendance</h2>
            <span className="mono">{data.attendance.note}</span>
          </div>
          <PerfectAttendance rows={data.attendance.rows} />
        </div>
      </section>
    </div>
  );
}
