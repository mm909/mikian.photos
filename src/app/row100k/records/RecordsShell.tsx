"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ELITE_LABEL, ELITE_TAG, digitCount, eliteOrder, partialShape } from "@/lib/blackoutRules";
import { FIRST_DAY_TAG, fmtDay, fmtMeters, fmtRecordTime, fmtSplit, type Week } from "@/lib/row100k";
import { BlockShape, Blocks } from "../Blackout";
import { Boards, Who, fold, rowMatches, type Tab } from "../Boards";
import type { PeriodRow, PeriodTotal } from "../Stats";
import { DayCalendar, type CalendarStep } from "../stats/DayCalendar";
import { TextMenu, type TextMenuOption } from "../TextMenu";
import { BoardFind } from "./BoardFind";
import {
  DIV_DEFS,
  PERIOD_DEFS,
  RECORD_DEFS,
  divMatch,
  isPeriodKey,
  parseDiv,
  periodDef,
  recordDef,
  type BoardKey,
  type DivKey,
  type RecordRowLite,
} from "./defs";
import { LeadBlock } from "./LeadBlock";
import type { RecordsMonth, RecordsPayload } from "./recordsData";
import { recordsHref } from "./recordsUrl";

/* THE FULL RANKINGS, below the bar, as one client shell (owner,
 * 2026-09-25: "why is there a loading page between each click (category,
 * bracket, month)? There shouldn't be").
 *
 * The server renders this once with the record, the bracket and the
 * period the URL named (records/[record]/page.tsx → recordsData.ts). From
 * then on nothing navigates:
 *   - the CATEGORY word swaps between the rankings already in hand — the
 *     five records and, for a month, the two period boards (METERS BY DAY,
 *     METERS BY WEEK; owner, 2026-09-25);
 *   - the BRACKET word (All / Men's / Women's) is a filter over them;
 *   - the MONTH word — and the calendar's arrows — fetch the period as
 *     JSON from /api/row100k/records?m= (the same builder, masked for this
 *     viewer the same way) and swap it in, remembering every period seen
 *     so the way back is instant;
 *   - the DAY (a calendar, the stats page's own) and the WEEK (a word menu
 *     between two arrows) are picks into the boards already here.
 * The URL follows with history.replaceState — the record key in the path,
 * ?d=, ?m=, ?day= and ?w= in the query (recordsUrl.ts spells it; the
 * server reads it) — so a reload or a shared link lands on the same view,
 * and every soft line keeps a real href for a middle click. The tap line
 * (NavProgress.tsx) never runs: no page is coming. Scroll never resets:
 * nothing here touches it. While a month is on its way the page dims a
 * touch (aria-busy) so the tap is seen to land; a fetch that fails falls
 * back to loading the page the old way rather than leaving the wrong
 * month on screen. The stats page's StatsShell.tsx is the model.
 *
 * THE HEAD is three words that are menus on one mono line — DECEMBER 2026
 * · TOTAL METERS · ALL (owner, 2026-09-25: "the five chips wrap into ugly
 * rows: condense them into a word menu next to the month word, the way
 * DECEMBER 2026 is a word; and if there is room, a third word for ALL /
 * MEN'S / WOMEN'S") — on every width; the bracket word drops to its own
 * line on a phone (recordsCss.ts). On the two period boards a fourth line
 * under it is the day or the week between its arrows. Under that the
 * leader of the category for the bracket and the period (LeadBlock.tsx),
 * the pace on the holder line so the block never changes height (owner,
 * 2026-09-25), then the table — whose ROWER head is the search (owner,
 * 2026-09-25: "make the NAME the search"; BoardFind.tsx). Nothing under
 * the table since 2026-09-25 (owner: "remove the stats link at the bottom
 * of the board, and remove SHARE THE BOARD").
 *
 * Blackout: every row here arrived masked from recordsData.ts. TOTAL
 * METERS is the board (Boards.tsx, its tiers, arrows and progress bars,
 * the elite in blocks by average split); the other four records are flat
 * rankings where a hidden rower's meters draw as blocks and their times
 * print (owner, 2026-09-08); the period boards lift the elite into their
 * own block the way the stats page does. Nothing in here decides who is
 * hidden. */

type Land = "first" | "last" | "today";

const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function RecordsShell({
  initial,
  recordKey: key0,
  div0,
  day0,
  week0,
}: {
  initial: RecordsPayload;
  /* The URL segment, validated by the page. */
  recordKey: BoardKey;
  /* From ?d=, validated by the page. */
  div0: DivKey;
  /* From ?day= / ?w= (1-based), when the URL named one. */
  day0: number | null;
  week0: number | null;
}) {
  const [data, setData] = useState<RecordsPayload>(initial);
  const [key, setKey] = useState<BoardKey>(key0);
  const [div, setDiv] = useState<DivKey>(div0);
  const [busy, setBusy] = useState(false);

  /* THE DAY AND THE WEEK on the period boards, as indexes into the month
   * in hand; whether each is the viewer's own pick (kept in the URL on a
   * reload) or the default (kept out of it). */
  const m0 = initial.month;
  const [day, setDayState] = useState<number>(day0 != null ? clamp(day0 - 1, 0, m0?.todayDay ?? 0) : (m0?.todayDay ?? 0));
  const [week, setWeekState] = useState<number>(week0 != null ? Math.max(0, week0 - 1) : (m0?.defaultWeek ?? 0));
  const [dayPicked, setDayPicked] = useState(day0 != null);
  const [weekPicked, setWeekPicked] = useState(week0 != null);

  /* Every period seen this visit, by key — the way back is a swap. */
  const seen = useRef<Map<string, RecordsPayload>>(new Map([[initial.period.key, initial]]));
  /* The latest request wins; an older answer landing late is dropped. */
  const seq = useRef(0);

  const periodKey = data.period.key;
  const cur = data.currentMonthKey;

  const setDay = (i: number) => {
    setDayState(i);
    setDayPicked(true);
  };
  const setWeek = (i: number) => {
    setWeekState(i);
    setWeekPicked(true);
  };

  /* Landing on a period: a month stepped into from the calendar opens on
   * its first or last day (and week); one picked from the month word opens
   * on today, or a past month's last day. ALL TIME has no day or week
   * board, so a period category folds back to the board (owner,
   * 2026-09-25: no day/week categories on all time). */
  const land = useCallback((p: RecordsPayload, where: Land) => {
    setData(p);
    if (p.period.kind === "all") setKey((k) => (isPeriodKey(k) ? "total" : k));
    const m = p.month;
    if (!m) return;
    if (where === "first") {
      setDayState(0);
      setWeekState(0);
      setDayPicked(true);
      setWeekPicked(false);
    } else if (where === "last") {
      setDayState(m.todayDay);
      setWeekState(m.defaultWeek);
      setDayPicked(true);
      setWeekPicked(false);
    } else {
      setDayState(m.todayDay);
      setWeekState(m.defaultWeek);
      setDayPicked(false);
      setWeekPicked(false);
    }
  }, []);

  const goPeriod = useCallback(
    async (pk: string, where: Land = "today") => {
      const my = ++seq.current;
      const had = seen.current.get(pk);
      if (had) {
        land(had, where);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/row100k/records?m=${encodeURIComponent(pk)}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        const json = (await res.json()) as { ok: boolean; data?: RecordsPayload; error?: string };
        if (!res.ok || !json.ok || !json.data) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (my !== seq.current) return;
        seen.current.set(pk, json.data);
        land(json.data, where);
      } catch (err) {
        console.error("row100k/records: could not swap the period in place", err);
        if (my !== seq.current) return;
        /* The old way: the page itself, at the address the pick meant. */
        window.location.assign(recordsHref({ key, d: div, m: pk }, cur));
      } finally {
        if (my === seq.current) setBusy(false);
      }
    },
    [land, key, div, cur],
  );

  /* THE URL FOLLOWS THE VIEW. replaceState, never push: a pick is not a
   * page, and the back button should leave the rankings altogether. Next
   * syncs its router to a replaceState (14.1+), so usePathname and
   * useSearchParams users see the change without a fetch. */
  useEffect(() => {
    const href = recordsHref(
      {
        key,
        d: div,
        m: periodKey,
        day: key === "day" && dayPicked ? day + 1 : undefined,
        w: key === "week" && weekPicked ? week + 1 : undefined,
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
  }, [key, div, periodKey, day, week, dayPicked, weekPicked, cur]);

  const rdef = recordDef(key);
  const href = (q: { key?: string; d?: string; m?: string; day?: number; w?: number }) =>
    recordsHref({ key, d: div, m: periodKey, ...q }, cur);

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

  /* THE CATEGORY WORD: the five records, then — for a month — the two
   * period boards (owner, 2026-09-25: "add METERS BY DAY and METERS BY
   * WEEK to the category menu"; not on all time). All already here, so a
   * pick is a swap. */
  const mo: RecordsMonth | null = data.month;
  const catOptions: TextMenuOption[] = [
    ...RECORD_DEFS.map((d) => ({ key: d.key, label: d.title, href: href({ key: d.key }), soft: true })),
    ...(mo ? PERIOD_DEFS.map((d) => ({ key: d.key, label: d.title, href: href({ key: d.key }), soft: true })) : []),
  ];
  const catWord = (
    <TextMenu
      options={catOptions}
      value={key}
      ariaLabel="Which record"
      onPick={(k) => setKey(recordDef(k)?.key ?? periodDef(k)?.key ?? RECORD_DEFS[0].key)}
    />
  );

  /* THE BRACKET WORD: All / Men's / Women's, a filter over the rows. */
  const divWord = (
    <TextMenu
      options={DIV_DEFS.map((d) => ({ key: d.key, label: d.label, href: href({ d: d.key }), soft: true }))}
      value={div}
      ariaLabel="Which bracket"
      onPick={(k) => setDiv(parseDiv(k))}
    />
  );

  /* THE DAY OR THE WEEK on a period board: which index is up, clamped
   * into the month in hand (a week exists once its first day arrives, so
   * only the started weeks are offered; before the 1st, Week 1 stands
   * in), and the pieces the picker line draws. */
  const periodKeyUp = isPeriodKey(key) && mo !== null;
  const lastDayKey = mo ? `${mo.key}-${pad2(mo.todayDay + 1)}` : "";
  const startedWeeks = mo ? mo.weeks.filter((w) => w.first <= lastDayKey) : [];
  const shownWeeks: Week[] = mo ? (startedWeeks.length > 0 ? startedWeeks : [mo.weeks[0]]) : [];
  const wk = clamp(week, 0, Math.max(0, shownWeeks.length - 1));
  const maxDay = mo ? clamp(mo.todayDay, 0, mo.daily.length - 1) : 0;
  const dy = clamp(day, 0, maxDay);
  const dayKey = (i: number) => `${mo?.key}-${pad2(i + 1)}`;

  /* The ranking for the category and the bracket, places within it: a
   * record's flat ranking, or the day's / the week's rows. */
  const periodRows: PeriodRow[] = periodKeyUp && mo ? ((key === "day" ? mo.daily[dy] : mo.weekly[wk]) ?? []).filter((r) => divMatch(div, r.division)) : [];
  const rows: RecordRowLite[] = periodKeyUp
    ? periodRows.map(periodLite)
    : (data.records[rdef?.key ?? "total"] ?? []).filter((r) => divMatch(div, r.division));
  const kind = rdef?.kind ?? "meters";
  const dist = rdef?.dist;

  /* THE LEADER: the first row of the ranking as it stands for this
   * bracket and period — on a period board, the most meters that day or
   * that week. TOTAL METERS while the elite are hidden has no leader — the
   * row at the top is the fastest hidden rower by split, nobody's number
   * one — so the block draws the longest hidden total in blocks over
   * LIGHTS OUT, exactly as the stats page does; the period boards do the
   * same, since their elite are the board's. The masking is the row's own
   * (recordsData.ts): a hidden meters value is a digit count, a
   * half-covered run-up total draws its tail as blocks, and a time is
   * public for everyone (owner, 2026-09-08). */
  const eliteRows = key === "total" || periodKeyUp ? rows.filter((r) => r.unranked) : [];
  const first = periodKeyUp ? rows.filter((r) => !r.unranked)[0] : rows[0];
  const eliteDigits = eliteRows.reduce((n, r) => Math.max(n, r.digits ?? digitCount(r.value)), 1);
  const pace = first && dist ? fmtSplit(dist, first.value) : undefined;

  const tab = div.toUpperCase() as Tab;
  /* A finished month: no empty tier is drawn on the board (owner,
   * 2026-09-25: nobody can unlock it any more). */
  const finished = data.period.kind === "month" && !data.thisMonth;

  const emptyLine = data.unavailable
    ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT."
    : data.started
      ? "NOTHING ON THIS ONE YET."
      : `THE START LIST IS FILLING — METERS SHOW UP HERE ${FIRST_DAY_TAG}.`;

  /* THE PICKER LINE on a period board: the day word with the stats page's
   * calendar under it (stats/DayCalendar.tsx), or the week word with the
   * month's weeks under it, between two arrows that step a day or a week
   * and, past either end of the month, the month (a change of period the
   * shell fetches in place, landing on its last or first day). */
  const prevM = mo?.prev;
  const nextM = mo?.next;
  const stepPrev: CalendarStep | undefined = prevM
    ? {
        label: `Last day of ${prevM.label}`,
        href: href({ m: prevM.key, day: key === "day" ? 31 : undefined, w: key === "week" ? 9 : undefined }),
        onStep: () => void goPeriod(prevM.key, "last"),
      }
    : undefined;
  const stepNext: CalendarStep | undefined = nextM
    ? {
        label: `First day of ${nextM.label}`,
        href: href({ m: nextM.key, day: key === "day" ? 1 : undefined, w: key === "week" ? 1 : undefined }),
        onStep: () => void goPeriod(nextM.key, "first"),
      }
    : undefined;

  const arrow = (dir: "prev" | "next", can: boolean, onStep: () => void, label: string) => {
    const glyph = dir === "prev" ? "‹" : "›";
    const step = dir === "prev" ? stepPrev : stepNext;
    if (can) {
      return (
        <button type="button" className="st-arrow" aria-label={label} onClick={onStep}>
          {glyph}
        </button>
      );
    }
    if (step) {
      return (
        <a
          className="st-arrow"
          aria-label={step.label}
          href={step.href}
          data-inplace=""
          onClick={(ev) => {
            if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
            ev.preventDefault();
            step.onStep();
          }}
        >
          {glyph}
        </a>
      );
    }
    return (
      <span className="st-arrow off" aria-hidden="true">
        {glyph}
      </span>
    );
  };

  let pickLine: ReactNode = null;
  if (periodKeyUp && mo) {
    if (key === "day") {
      const dayWord = mo.live && dy === mo.todayDay ? `${fmtDay(dayKey(dy))} · today` : fmtDay(dayKey(dy));
      pickLine = (
        <div className="st-day rec-when" role="group" aria-label="Day">
          {arrow("prev", dy > 0, () => setDay(dy - 1), "Previous day")}
          {/* Keyed: the week word sits in the same place, and an open
              calendar must not carry its open state over to it when the
              category swaps. */}
          <TextMenu
            key="day"
            options={[]}
            value={String(dy)}
            label={dayWord}
            ariaLabel="Which day"
            className="st-days"
            panel={(close) => (
              <DayCalendar
                month={{ key: mo.key, label: mo.label, firstDow: mo.firstDow, days: mo.days }}
                maxDay={maxDay}
                value={dy}
                today={mo.live ? mo.todayDay : null}
                hrefFor={(i) => href({ day: i + 1 })}
                onPick={setDay}
                prev={stepPrev}
                next={stepNext}
                close={close}
              />
            )}
          />
          {arrow("next", dy < maxDay, () => setDay(dy + 1), "Next day")}
        </div>
      );
    } else {
      const weekOptions: TextMenuOption[] = shownWeeks.map((w, i) => ({
        key: String(i),
        label: `${w.label} · ${weekDates(w)}`,
        href: href({ w: i + 1 }),
        soft: true,
      }));
      pickLine = (
        <div className="st-day rec-when" role="group" aria-label="Week">
          {arrow("prev", wk > 0, () => setWeek(wk - 1), "Previous week")}
          <TextMenu key="week" options={weekOptions} value={String(wk)} ariaLabel="Which week" onPick={(k) => setWeek(Number(k))} className="st-weeks" />
          {arrow("next", wk < shownWeeks.length - 1, () => setWeek(wk + 1), "Next week")}
        </div>
      );
    }
  }

  return (
    <div className="rec-shell rec-swap" aria-busy={busy || undefined}>
      <section>
        <div className="wrap">
          {/* THE HEAD: three words that are menus (owner, 2026-09-25). The
              first two never part; the bracket drops to its own line on a
              phone, its dot with it. A period board adds its day or week
              line under them. */}
          <div className="rec-head">
            <h1 className="rec-period">
              <span className="rec-w">
                {monthWord}
                <span className="dot">·</span>
                {catWord}
              </span>
              <span className="rec-w rec-w2">
                <span className="dot">·</span>
                {divWord}
              </span>
            </h1>
            {pickLine}
          </div>

          {/* THE LEADER, the stats page's stat block (owner, 2026-09-24),
              the pace on the holder line (owner, 2026-09-25). */}
          {eliteRows.length > 0 ? (
            <LeadBlock
              value={
                <>
                  <Blocks digits={eliteDigits} /> <span className="u">m</span>
                </>
              }
              label={ELITE_LABEL}
            />
          ) : first ? (
            <LeadBlock
              value={<LiteVal r={first} kind={kind} unit="big" />}
              holder={{ rowerNumber: first.rowerNumber, name: first.name }}
              day={key === "day" && mo ? dayKey(dy) : first.day}
              sessions={first.sessions}
              pace={pace}
              paceInline
            />
          ) : (
            <p className="board-empty rec-lead-empty">{emptyLine}</p>
          )}

          {/* Same line the board prints; an admin sees nothing hidden and
              is told so. The board says it on its own (Boards.tsx); the
              flat rankings and the period boards say it here — the meters
              ones that the elite are hidden, a time board that its times
              are shown. */}
          {key !== "total" && (data.blackout.active || data.anyHidden) && (
            <p className="bo-note rec-note">
              {data.anyHidden ? `${ELITE_LABEL}${kind === "time" ? " · TIMES ARE SHOWN" : ""}` : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
            </p>
          )}

          {/* THE TABLE, its ROWER head the search on every category
              (owner, 2026-09-25; BoardFind.tsx): the board on TOTAL METERS,
              a flat ranking on the four records, the day or the week on
              the two period boards. */}
          <BoardFind>
            {(q, head) =>
              key === "total" ? (
                <Boards
                  boards={data.board}
                  started={data.started}
                  blackout={data.blackout}
                  head={false}
                  tab={tab}
                  movement={data.movement}
                  query={q}
                  foot={false}
                  final={finished}
                  rowerHead={head}
                />
              ) : periodKeyUp && mo ? (
                <PeriodTable
                  rows={periodRows}
                  /* The ledger line is everyone in the day or the week,
                     so it prints on ALL only: a bracket has no total of
                     its own the server summed. */
                  total={div === "all" ? (key === "day" ? mo.dayTotals[dy] : mo.weekTotals[wk]) : undefined}
                  meId={data.meId}
                  query={q}
                  started={data.started}
                  head={head}
                />
              ) : isPeriodKey(key) ? (
                <p className="board-empty">{emptyLine}</p>
              ) : (
                <FlatTable rows={rows} kind={kind} dist={dist} meId={data.meId} query={q} started={data.started} unavailable={data.unavailable} head={head} />
              )
            }
          </BoardFind>
        </div>
      </section>
    </div>
  );
}

/* "Dec 15–21" (both ends via fmtDay; the month drops off the second end
 * when it repeats — every week sits inside its month). */
function weekDates(w: Week): string {
  return w.first.slice(0, 7) === w.last.slice(0, 7) ? `${fmtDay(w.first)}–${Number(w.last.slice(8, 10))}` : `${fmtDay(w.first)}–${fmtDay(w.last)}`;
}

/* A period board row in the shape the leader block reads: the meters as
 * the value, the mask and the elite tag as they came. */
function periodLite(r: PeriodRow): RecordRowLite {
  return {
    participantId: r.participantId,
    name: r.name,
    rowerNumber: r.rowerNumber,
    division: r.division,
    value: r.meters,
    sessions: r.sessions,
    ...(r.masked ? { masked: true, digits: r.digits } : {}),
    ...(r.unranked ? { unranked: true } : {}),
    ...(r.paceTag ? { paceTag: r.paceTag } : {}),
  };
}

/* A record value: a time with tenths, or meters with its unit — small and
 * grey inside the headline, plain in a table cell. A hidden row draws
 * blocks for its digit count (the value itself is 0 by now); a total in
 * the run-up draws its covered tail as blocks (blackoutRules.partialShape,
 * the board's own treatment). A time is never masked (owner, 2026-09-08). */
function LiteVal({ r, kind, unit }: { r: RecordRowLite; kind: "time" | "meters"; unit: "big" | "table" }) {
  if (kind === "time") return <>{fmtRecordTime(r.value)}</>;
  const num = r.masked ? (
    <Blocks digits={r.digits ?? digitCount(r.value)} />
  ) : r.hideLow ? (
    <BlockShape shape={partialShape(r.value, r.hideLow, r.digits)} label="partly hidden" />
  ) : unit === "big" ? (
    Math.round(r.value).toLocaleString("en-US")
  ) : (
    fmtMeters(r.value)
  );
  if (unit === "table") return r.masked || r.hideLow ? <>{num} m</> : <>{num}</>;
  return (
    <>
      {num} <span className="u">m</span>
    </>
  );
}

/* THE FLAT RANKING of a record other than TOTAL METERS: place, rower, the
 * time or the meters, the pace as its own column on a 5k or 10k (owner,
 * 2026-09-24: "remove the /500m on the time; just say their time and then
 * their pace"), and the day. The day column is for wide screens; on a
 * phone the day sits under the value in the same cell (recordsCss.ts), so
 * the name keeps its one line. The viewer's own row wears the tint the
 * stats boards use, so their place is findable on the full list (owner,
 * 2026-09-05: seeing where you are matters).
 *
 * The search narrows what is drawn, never what is counted: a row found
 * keeps the place it holds on the whole ranking. */
function FlatTable({
  rows,
  kind,
  dist,
  meId,
  query,
  started,
  unavailable,
  head,
}: {
  rows: RecordRowLite[];
  kind: "time" | "meters";
  dist?: 5000 | 10000;
  meId: string | null;
  query: string;
  started: boolean;
  unavailable: boolean;
  /* The ROWER head, the search control (BoardFind.tsx). */
  head: ReactNode;
}) {
  const q = fold(query);
  const finding = q !== "";
  const placed = rows.map((r, i) => ({ r, place: i + 1 }));
  const shown = finding ? placed.filter(({ r }) => rowMatches(r, q)) : placed;

  if (rows.length === 0) {
    return (
      <p className="board-empty">
        {unavailable
          ? "THE RECORDS COULD NOT BE READ JUST NOW — RELOAD IN A MOMENT."
          : started
            ? "NOTHING ON THIS ONE YET."
            : `THE START LIST IS FILLING — METERS SHOW UP HERE ${FIRST_DAY_TAG}.`}
      </p>
    );
  }

  const dayOf = (r: RecordRowLite): ReactNode => (r.day ? fmtDay(r.day) : "");

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="board rec-flat">
        <thead>
          <tr>
            <th className="rk">#</th>
            <th>{head}</th>
            <th style={{ textAlign: "right" }}>{kind === "time" ? "Time" : "Meters"}</th>
            {dist ? <th style={{ textAlign: "right" }}>Pace</th> : null}
            <th className="rec-dcol" style={{ textAlign: "right" }}>
              Day
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.length === 0 ? (
            /* The search found nobody: said inside the table so the head
               — the search itself — stays where it is. */
            <tr className="lockrow">
              <td colSpan={dist ? 5 : 4}>NOBODY ON THIS BOARD MATCHES.</td>
            </tr>
          ) : (
            shown.map(({ r, place }) => (
              <tr key={r.participantId} className={r.participantId === meId ? "fin" : undefined}>
                <td className="rk">{place}</td>
                {/* Name and number only reach the browser for a hidden rower
                    (recordsData.ts), so the link is safe: the profile masks
                    the same way. */}
                <td className="wc">
                  <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
                </td>
                <td className="num">
                  <LiteVal r={r} kind={kind} unit="table" />
                  <span className="rec-dsub">{dayOf(r)}</span>
                </td>
                {dist ? <td className="num">{fmtSplit(dist, r.value)}</td> : null}
                <td className="num rec-dcol" style={{ color: "var(--gray)" }}>
                  {dayOf(r)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* THE DAY OR THE WEEK, whole (owner, 2026-09-25: "add METERS BY DAY and
 * METERS BY WEEK to the category menu"): every rower with meters in it,
 * ranked, with their meters and their sessions — the stats page's top ten
 * with no ten (Stats.tsx BoardWindow is the model). The elite lead the
 * table in their own block, no place, the pace tag where the tier tag
 * goes, ordered by average split (blackoutRules.eliteOrder), and the ranked
 * rows under them count from 1 (owner, 2026-09-08). The ledger line under
 * everyone is the server's own sum, hidden rowers counted, and is not
 * drawn while a search is on — it is a line about everybody. The viewer's
 * own row wears the finisher tint. */
function PeriodTable({
  rows,
  total,
  meId,
  query,
  started,
  head,
}: {
  rows: PeriodRow[];
  total?: PeriodTotal;
  meId: string | null;
  query: string;
  started: boolean;
  head: ReactNode;
}) {
  const q = fold(query);
  const finding = q !== "";
  const elite = rows.filter((r) => !!r.unranked).sort(eliteOrder);
  const ranked = rows.filter((r) => !r.unranked).map((r, i) => ({ r, place: i + 1 }));
  const eliteShown = finding ? elite.filter((r) => rowMatches(r, q)) : elite;
  const rankedShown = finding ? ranked.filter(({ r }) => rowMatches(r, q)) : ranked;

  if (rows.length === 0) {
    return <p className="board-empty">{started ? "NOBODY ON THIS BOARD YET." : "THE START LIST IS FILLING — METERS SHOW UP HERE ON THE 1ST."}</p>;
  }

  const meters = (r: PeriodRow) =>
    r.masked ? (
      <>
        <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
      </>
    ) : (
      fmtMeters(r.meters)
    );

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="board rec-period-t">
        <thead>
          <tr>
            <th className="rk">#</th>
            <th>{head}</th>
            <th style={{ textAlign: "right" }}>Meters</th>
            <th style={{ textAlign: "right" }}>Sessions</th>
          </tr>
        </thead>
        <tbody>
          {finding && eliteShown.length === 0 && rankedShown.length === 0 && (
            <tr className="lockrow">
              <td colSpan={4}>NOBODY ON THIS BOARD MATCHES.</td>
            </tr>
          )}
          {eliteShown.length > 0 && (
            <>
              <tr className="divrow elite">
                <td colSpan={4}>
                  {ELITE_LABEL}
                  <span className="by">BY AVERAGE SPLIT</span>
                </td>
              </tr>
              {eliteShown.map((r) => (
                <tr key={r.participantId} className="elite-row">
                  <td className="rk" />
                  <td className="wc">
                    <Who
                      row={{ name: r.name, rowerNumber: r.rowerNumber }}
                      badge={r.paceTag ? <span className="tierbadge pace">{r.paceTag}</span> : <span className="tierbadge elite">{ELITE_TAG}</span>}
                    />
                  </td>
                  <td className="num">{meters(r)}</td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {r.sessions}
                  </td>
                </tr>
              ))}
            </>
          )}
          {rankedShown.map(({ r, place }) => (
            <tr key={r.participantId} className={r.participantId === meId ? "fin" : undefined}>
              <td className="rk">{r.masked ? "" : place}</td>
              <td className="wc">
                <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
              </td>
              <td className="num">{meters(r)}</td>
              <td className="num" style={{ color: "var(--gray)" }}>
                {r.sessions}
              </td>
            </tr>
          ))}
          {total && total.rowers > 0 && !finding && (
            <tr className="totrow">
              <td className="lbl" colSpan={2}>
                EVERYONE · {total.rowers} {total.rowers === 1 ? "ROWER" : "ROWERS"}
              </td>
              <td className="num">{fmtMeters(total.meters)}</td>
              <td className="num">{total.sessions}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
