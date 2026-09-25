"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { HourGrid } from "../HourGrid";
import { MonthSection } from "../MonthSection";
import { StatsShare } from "../StatsShare";
import { StatsBoards, StatsRecords, type BoardMode } from "../Stats";
import { TextMenu, type TextMenuOption } from "../TextMenu";
import { RECORD_DEFS, recordDef, type RecordKey } from "../records/defs";
import { FieldSection } from "./FieldSection";
import { PerfectAttendance } from "./PerfectAttendance";
import type { StatsPayload } from "./statsData";
import { isPeriodStat, rankingsHref, statsHref, type PeriodStatKey } from "./statsUrl";

/* THE STATS PAGE, below the bar, as one client shell (owner, 2026-09-25:
 * "every time I click fastest 5K / 10K / a month / a day there's a loading
 * page and my scroll resets. There shouldn't be. Whatever we need to do to
 * swap the data without a loading bar, do it").
 *
 * The server renders this once with the period the URL named
 * (stats/page.tsx → statsData.ts). From then on nothing navigates:
 *   - the STAT word swaps between the seven boards already in hand — the
 *     five records and, since the third look (owner, 2026-09-25:
 *     "combine METERS BY DAY and BY WEEK with the headline stat: add them
 *     as categories on the stat word"), METERS BY DAY and METERS BY WEEK;
 *   - the MONTH word — and the calendar's arrows — fetch the period as
 *     JSON from /api/row100k/stats?m= (the same builder, masked for this
 *     viewer the same way) and swap it in, remembering every period seen
 *     so the way back is instant;
 *   - the DAY and the WEEK (one calendar, stats/DayCalendar.tsx, in two
 *     modes) are picks into the boards already here.
 * The URL follows with history.replaceState, so a reload or a shared link
 * lands on the same view (statsUrl.ts spells it; the server reads it), and
 * every soft line keeps a real href for a middle click. The tap line
 * (NavProgress.tsx) never runs: no page is coming. While a month is on its
 * way the page dims a touch (aria-busy) so the tap is seen to land; a fetch
 * that fails falls back to loading the page the old way rather than
 * leaving the wrong month on screen.
 *
 * ALL TIME is a shorter page (owner, 2026-09-25: "when ALL TIME is
 * selected, hide METERS BY DAY / BY WEEK, THE MONTH, THE HOURS and PERFECT
 * ATTENDANCE"): the head, the stat block and the field. The month
 * sections are drawn only while the period is a month, and the two period
 * stats are offered only then — the payload still carries the current
 * month for them, so the way back to a month is the same swap.
 *
 * The section titles are mono eyebrows in the profile idiom (pieces.tsx
 * Eyebrow, .pf-eye): a left word and a right word on a hairline (owner,
 * 2026-09-25: "I don't like the big bold black section titles"). */

type Land = "first" | "last" | "today";

/* A stat on the stat word: one of the five records (records/defs.ts) or
 * one of the two period boards (statsUrl.ts). */
export type StatKey = RecordKey | PeriodStatKey;

const PERIOD_STATS: { key: PeriodStatKey; title: string }[] = [
  { key: "day", title: "Meters by day" },
  { key: "week", title: "Meters by week" },
];

/* A block heading kept to one mono line over a hairline, the profile's
 * (pieces.tsx Eyebrow) — a plain element here so the client shell does
 * not pull the profile's pieces in. */
function Eyebrow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="pf-eye st-eye">
      <span>{left}</span>
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

export function StatsShell({
  initial,
  statKey: statKey0,
  day0,
  week0,
}: {
  initial: StatsPayload;
  /* From ?s=, validated by the page. */
  statKey: StatKey;
  /* From ?day= / ?w= (1-based), when the URL named one. */
  day0: number | null;
  week0: number | null;
}) {
  const [data, setData] = useState<StatsPayload>(initial);
  /* A period stat over all time is nothing: TOTAL METERS instead. */
  const [statKey, setStatKeyState] = useState<StatKey>(
    initial.period.kind === "all" && isPeriodStat(statKey0) ? "total" : statKey0,
  );
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

  const setStatKey = (k: string) => {
    if (isPeriodStat(k)) setStatKeyState(k);
    else setStatKeyState((recordDef(k) ?? RECORD_DEFS[0]).key);
  };
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
    /* All time has no day board and no week board (owner, 2026-09-25). */
    if (p.period.kind === "all") setStatKeyState((k) => (isPeriodStat(k) ? "total" : k));
    if (where === "first") {
      setDayState(0);
      setWeekState(0);
      setDayPicked(true);
      setWeekPicked(true);
    } else if (where === "last") {
      setDayState(p.todayDay);
      setWeekState(p.defaultWeek);
      setDayPicked(true);
      setWeekPicked(true);
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
        day: statKey === "day" && dayPicked ? day + 1 : undefined,
        w: statKey === "week" && weekPicked ? week + 1 : undefined,
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
  }, [periodKey, statKey, day, week, dayPicked, weekPicked, cur]);

  const href = (q: { m?: string; s?: string; day?: number; w?: number }) =>
    statsHref({ m: periodKey, s: statKey, ...q }, cur);

  const m = data.month;
  /* Which sections the period gets: a month has its boards, calendar,
   * hours and attendance; all time has none of them (owner, 2026-09-25). */
  const isMonth = data.period.kind === "month";

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

  /* THE STAT WORD: the five records and, over a month, the two period
   * boards — all already here, so this is a swap. */
  const statOptions: TextMenuOption[] = [
    ...RECORD_DEFS.map((d) => ({ key: d.key, label: d.title, href: href({ s: d.key }), soft: true })),
    ...(isMonth ? PERIOD_STATS.map((d) => ({ key: d.key, label: d.title, href: href({ s: d.key }), soft: true })) : []),
  ];
  const statWord = <TextMenu options={statOptions} value={statKey} ariaLabel="Which stat" onPick={setStatKey} />;

  const pick = (
    <>
      {monthWord}
      <span className="dot">·</span>
      {statWord}
    </>
  );

  const community = {
    ...data.community,
    byDay: data.communityByDay,
    daily: data.curve,
    hourGrid: data.hourGrid,
    days: data.gridDayCount,
  };

  const periodStat = isMonth && isPeriodStat(statKey) ? statKey : null;
  const recordKey: RecordKey = periodStat ? "total" : (recordDef(statKey)?.key ?? "total");

  return (
    <div className="st-swap" aria-busy={busy || undefined}>
      {/* THE STAMP (owner, 2026-09-25: "make that big cumulative number
          more like a timestamp — like the date on a newspaper: the month
          and then the total; a certification of the stats, a lot less
          important"). On this page the community total is a dateline, not
          a headline: the month word, then the metres, small and grey with
          the figure in ink. ALL TIME keeps its word because the word is the
          control. Everywhere else the number stays the head. SHARE A CARD
          keeps the right of the line. */}
      <div className="ph-sec">
        <div className="wrap">
          <div className="st-stamp">
            <span className="st-stamp-l">
              {monthWord}
              <span className="dot">·</span>
              <span className="st-stamp-n">{data.unavailable ? "—" : `${data.community.meters.toLocaleString("en-US")} m`}</span>
            </span>
            <span className="ph-aside">
              <StatsShare community={community} prefer="rowtember-community-month" />
            </span>
          </div>
        </div>
      </div>

      {/* The stat block runs straight off the head: the two words, the
          leading value, the tables (owner call, 2026-09-05 — the leaders
          and their values carry the emphasis, not the controls). On
          METERS BY DAY / BY WEEK it is the period board in the same shape
          (owner, 2026-09-25, third look). */}
      <section>
        <div className="wrap">
          {periodStat ? (
            <StatsBoards
              month={m}
              weeks={data.weeks}
              live={data.liveMonth}
              weekly={data.weekly}
              daily={data.daily}
              dayTotals={data.dayTotals}
              weekTotals={data.weekTotals}
              todayDay={data.todayDay}
              mode={periodStat}
              day={day}
              week={week}
              onMode={(k: BoardMode) => setStatKeyState(k)}
              onDay={setDay}
              onWeek={setWeek}
              onStepMonth={(dir) => {
                const to = dir === "prev" ? data.prev : data.next;
                if (to) void goPeriod(to.key, dir === "prev" ? "last" : "first");
              }}
              hrefMode={(k) => href({ s: k })}
              hrefDay={(i) => href({ day: i + 1 })}
              hrefWeek={(i) => href({ w: i + 1 })}
              hrefStep={(dir) =>
                /* The last day or week of the month before, the first of
                   the month after; the shell clamps a week past the end. */
                periodStat === "week"
                  ? statsHref({ m: dir === "prev" ? data.prev?.key : data.next?.key, s: statKey, w: dir === "prev" ? 9 : 1 }, cur)
                  : statsHref({ m: dir === "prev" ? data.prev?.key : data.next?.key, s: statKey, day: dir === "prev" ? 31 : 1 }, cur)
              }
              pick={pick}
              rankingsHref={rankingsHref(periodStat, periodKey, periodStat === "week" ? { w: week + 1 } : { day: day + 1 })}
              started={data.started}
              meId={data.meId}
              maskedIds={data.maskedIds}
              prev={data.prev}
              next={data.next}
              anyHidden={data.anyHidden}
              blackout={data.blackout}
            />
          ) : (
            <StatsRecords
              records={data.records}
              statKey={recordKey}
              pick={pick}
              rankingsHref={rankingsHref(recordKey, periodKey)}
              started={data.started}
              meId={data.meId}
              anyHidden={data.anyHidden}
              unavailable={data.unavailable}
              blackout={data.blackout}
            />
          )}
        </div>
      </section>

      {/* THE MONTH and THE HOURS: a month's sections, not drawn for all
          time (owner, 2026-09-25). */}
      {isMonth && (
        <>
          {/* THE MONTH: the calendar alone under its eyebrow (owner,
              2026-09-24: no subtitle), every day of the month drawn — the
              days to come as empty dashed cells (owner, 2026-09-25: "give
              THE MONTH calendar all its squares back for the whole
              month"). */}
          <section className="st-sec">
            <div className="wrap">
              <Eyebrow left="The month" right={m.label} />
              <MonthSection
                month={{ key: m.key, firstDow: m.firstDow, days: m.days }}
                byDay={data.communityByDay}
                thresholds={data.thresholds}
                days={data.gridDayCount}
                whole
              />
            </div>
          </section>

          {/* THE HOURS: the grid alone (owner, 2026-09-24). */}
          <section className="st-sec">
            <div className="wrap">
              <Eyebrow left="The hours" />
              <HourGrid grid={data.hourGrid} month={m.label.slice(0, 3)} />
            </div>
          </section>
        </>
      )}

      {/* THE FIELD, with no line after the word (owner, 2026-09-25:
          "remove the copy at the end of the field"). */}
      <section className="st-sec">
        <div className="wrap">
          <Eyebrow left="The field" />
          <FieldSection field={data.field} hours={data.hours} distances={data.distances} />
        </div>
      </section>

      {/* PERFECT ATTENDANCE (owner, 2026-09-21), last on the page since
          2026-09-24 (owner: below THE FIELD); a month's section, not drawn
          for all time, and not drawn at all when nobody has it (owner,
          2026-09-25: "if nobody has perfect attendance, hide the
          section"). */}
      {isMonth && data.attendance.rows.length > 0 && (
        <section className="st-sec">
          <div className="wrap">
            <Eyebrow left="Perfect attendance" right={data.attendance.note} />
            <PerfectAttendance rows={data.attendance.rows} />
          </div>
        </section>
      )}
    </div>
  );
}
