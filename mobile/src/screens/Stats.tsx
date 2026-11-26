import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type Kde, type KdeYou, type PeriodRow, type RecordRow, type Stats } from "../api";
import { Columns, Density, HourGrid, MonthGrid, kdeAtShare, kdePeak, kdeShareUnder } from "../charts";
import { useSession } from "../session";
import { Cols, Dash, Dot, Eye, Fig, Lead, TableHead, Tr, WordMenu, mono, Ctl, Chip } from "../site";
import { C, F, MONTHS, fmtClock, fmtInt } from "../theme";
import { Blocks, Waiting, scrub, useLoad, useScrollDir } from "../ui";
import { Flip } from "./Field";
import { Box } from "./reviewBits";
import { M2dStatsView } from "./M2D";

/* THE STATS, the site's /stats on a phone (stats/StatsShell.tsx, Stats.tsx),
 * in the order and the manner the site settled on:
 *
 *   THE STAMP: the month word and the community total, small, a dateline
 *     and not a headline (owner, 2026-09-25: "more like a timestamp").
 *   THE TWO WORDS: NOVEMBER 2026 · TOTAL METERS, each a menu (a word on a
 *     dotted rule that drops the house panel; owner, 2026-09-24: "more
 *     text, less UI button-y"). The month word swaps the period, the stat
 *     word swaps between the five records and, over a month, METERS BY DAY
 *     and METERS BY WEEK.
 *   THE LEAD: the record's number one, big and blue, the holder on the mono
 *     line under it.
 *   THE TABLES: the men's and the women's five on the warm tint, and the
 *     viewer's own line under the five when they sit deeper. By day and by
 *     week it is one table of everyone, with BY DAY · BY WEEK · ‹ NOV 20 ›
 *     over it and the day word dropping a calendar.
 *   Then THE MONTH, THE HOURS, THE FIELD and PERFECT ATTENDANCE under
 *     eyebrows. All time drops the month's sections, as the site does.
 *
 * THE FIELD'S CURVES ARE CARDS WITH TWO FACES (owner, 2026-11-23: "what if
 * we gave more room to some of these KDEs ... a little more real estate to
 * each one of them vertically? ... can we say anything cooler about them?
 * Can we do that swiping like the cards we did with the post hoc, where
 * this one will show everyone's, but then if I swipe, maybe it can show
 * mine overlaid on it"). Each curve is half as tall again as it was, in the
 * card a row's analytics draws its pictures in, with one sentence under it
 * worked out from the curve. The first face is everyone's rows; a swipe to
 * the left, or a press on the line under the dots, brings the second, the
 * signed-in rower's own rows and curve over the same field, as a row's
 * cards turn to AGAINST EVERYONE (Field.tsx Flip). The rower's half comes
 * from /api/row100k/app/standing for the same period. Signed out, or with
 * no rows over that measure, a card has the one face and no dots.
 *
 * A finger across a curve still reads it (the hairline), so the card is
 * turned from its name, its sentence or the line under it, not from the
 * curve; and a touch that lands on one of these cards is the card's, so the
 * tabs do not change under it (ui.tsx scrub).
 *
 * One answer of /api/row100k/stats per period, the route the site's own
 * page swaps months with; every period seen is kept, so the way back is
 * instant. A name opens the rower. */

type RecordKey = "total" | "5000" | "10000" | "longest" | "bigday";
type StatKey = RecordKey | "day" | "week";
const RECORDS: { key: RecordKey; label: string; time?: number }[] = [
  { key: "total", label: "Total meters" },
  { key: "5000", label: "Fastest 5k", time: 5000 },
  { key: "10000", label: "Fastest 10k", time: 10000 },
  { key: "longest", label: "Longest row" },
  { key: "bigday", label: "Biggest day" },
];
const PERIODS: { key: "day" | "week"; label: string }[] = [
  { key: "day", label: "Meters by day" },
  { key: "week", label: "Meters by week" },
];
const m2 = (s: number) => fmtClock(s, false);
const STAT_KEY = "stats/stat/1";
const ALL_STATS: StatKey[] = ["total", "5000", "10000", "longest", "bigday", "day", "week"];
let lastStat: StatKey = "total";
const WHO: { key: "all" | "M" | "F"; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "M", label: "Men" },
  { key: "F", label: "Women" },
];
const dayWord = (day?: string) => (day ? `${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)} ${Number(day.slice(8))}` : "");

type Payload = Stats & {
  thresholds?: number[];
  field: (Stats["field"] & { length?: Sum; pace?: Sum }) | null;
};
type Sum = { mean: number; median: number; sd: number; p10: number; p90: number };
/* The signed-in rower over the field, for one period (app/standing). */
type Standing = {
  period: string;
  you: { sessions: number; avgLen: number; avgPace: number | null; lenPct: number | null; pacePct: number | null; lengthYou: KdeYou | null; paceYou: KdeYou | null } | null;
  distances: { meters: number; you: KdeYou; youN: number }[];
};
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/* "about 62%": a share read off a drawn curve is never said to the unit as
 * if it were counted, and never as all or none. */
const about = (share: number) => `about ${Math.max(1, Math.min(99, Math.round(share * 100)))}%`;

export function StatsScreen({ onRower, onRow, onRankings, onScrollDir }: { onRower: (n: number) => void; onRow?: (id: string) => void; onRankings?: (period: string, rec: string) => void; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { me } = useSession();
  /* THE CURRENT MONTH FIRST (owner, 2026-11-26: "on the stats page, let's
   * actually have it default to just the current month ... let's revert
   * that change"): no ?m, so the server answers with this month. M2D and
   * all time are one pick away. */
  const [period, setPeriod] = useState("");
  const [m2d, setM2d] = useState(false);
  /* THE STAT LEFT ON IS THE STAT COME BACK TO (owner, 2026-11-23: "make
   * the stat page remember the category that I left off at. Right now it
   * resets to total meters"): kept for the app's life and on the phone. */
  const [stat, setStatNow] = useState<StatKey>(lastStat);
  useEffect(() => {
    AsyncStorage.getItem(STAT_KEY)
      .then((v) => {
        if (v && ALL_STATS.includes(v as StatKey) && v !== lastStat) {
          lastStat = v as StatKey;
          setStatNow(lastStat);
        }
      })
      .catch(() => null);
  }, []);
  const setStat = (k: StatKey) => {
    lastStat = k;
    setStatNow(k);
    AsyncStorage.setItem(STAT_KEY, k).catch(() => null);
  };
  const [slot, setSlot] = useState<number | null>(null);
  const path = `/api/row100k/stats${period ? `?m=${period}` : ""}`;
  const { data, error, loading, reload } = useLoad(() => api<{ data: Payload }>(path), [path, me.me?.rowerNumber], path);
  /* The rower's own half of the field's cards, when somebody is signed in. */
  const minePath = me.me ? `/api/row100k/app/standing${period ? `?m=${period}` : ""}` : null;
  const own = useLoad(() => (minePath ? api<Standing>(minePath) : Promise.resolve(null)), [minePath, me.me?.rowerNumber], minePath);
  const [cardW, setCardW] = useState(0);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const s = data.data;
  /* Only the answer for the period on the screen: its curves sit on that
   * period's grid and no other's. */
  const st = own.data && own.data.period === s.period.key ? own.data : null;
  const month = s.period.kind === "month";
  const key: StatKey = !month && (stat === "day" || stat === "week") ? "total" : stat;
  const rec = RECORDS.find((r) => r.key === key);
  /* M2D IS A TIME FRAME (owner, 2026-11-25): first in the picker, its one
   * metric DOLLARS RAISED, drawn by M2dStatsView (screens/M2D.tsx). The
   * period under it stays as it was, so the way back is instant. */
  const pickPeriod = (k: string) => {
    if (k === "m2d") {
      setM2d(true);
      return;
    }
    setM2d(false);
    setPeriod(k);
    setSlot(null);
  };
  const frames = [{ key: "m2d", label: "M2D" }, ...s.periods];

  const monthWord = (color: string, size = 12, bold = true, chip = false) => <WordMenu options={frames} value={m2d ? "m2d" : s.period.key} onPick={pickPeriod} ariaLabel="Which time frame" textStyle={mono(size, bold, color)} chip={chip} />;
  const statWord = m2d ? (
    <WordMenu options={[{ key: "dollars", label: "Dollars raised" }]} value="dollars" onPick={() => null} ariaLabel="Which stat" chip />
  ) : (
    <WordMenu
      options={[...RECORDS, ...(month ? PERIODS : [])]}
      value={key}
      onPick={(k) => {
        setStat(k);
        setSlot(null);
      }}
      ariaLabel="Which stat"
      chip
    />
  );

  /* ROWS BY HOUR OF THE DAY, drawn under the grid of hours when there is
   * one (owner, 2026-11-21: "let's put the hours and rows by hour of day
   * charts close to each other"). */
  const hoursOfDay = s.hours ? (
    <>
      <ChartHead>Rows by hour of the day</ChartHead>
      <Columns values={Array.from({ length: 24 }, (_, i) => s.hours!.counts[(i + s.hours!.start) % 24] ?? 0)} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
        {[0, 6, 12, 18, 24].map((k) => {
          const h = (s.hours!.start + k) % 24;
          return (
            <Text key={k} style={mono(10, false, C.gray, 0.1)}>
              {h === 0 ? "12 AM" : h === 12 ? "NOON" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </Text>
          );
        })}
      </View>
    </>
  ) : null;

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      {/* No stamp of the month and its meters here any more (owner,
          2026-11-21): every meter anybody has rowed is what the mark in the
          top bar rolls over into on this tab (App.tsx). */}
      {/* THE TWO CHOICES, centred at the head of the page as two buttons
          (owner, 2026-11-23: "the time frame is like kind of off the
          corner ... we just need to center it, or ... put the time frame
          somewhere where ... it's clear that users can change it"). */}
      <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
        {monthWord(C.ink, 12, true, true)}
        {statWord}
      </View>

      {m2d ? <M2dStatsView onRower={onRower} /> : null}
      {m2d ? null : rec ? <Records key={rec.key} s={s} rec={rec} onRower={onRower} onRow={onRow} onAll={onRankings ? () => onRankings(period || s.period.key, rec.key) : undefined} /> : <ByPeriod s={s} mode={key as "day" | "week"} slot={slot} onSlot={setSlot} onMode={setStat} onRower={onRower} />}

      {month && !m2d ? (
        <>
          <Eye left="The month" right={s.month.label} />
          <MonthGrid month={s.month} byDay={s.communityByDay} today={s.liveMonth ? s.todayDay + 1 : undefined} marks={(s.thresholds?.length === 3 ? s.thresholds : marksOf(s.communityByDay)) as [number, number, number]} />
          {s.hourGrid.length ? (
            <>
              <Eye left="The hours" />
              <HourGrid grid={s.hourGrid} />
              {hoursOfDay}
            </>
          ) : null}
        </>
      ) : null}

      {s.field && !m2d ? (
        <>
          <Eye left="The field" />
          {/* The two medians, and no line of mean, deviation and
              percentiles under them (owner, 2026-11-21: "the field on the
              stats page, that like little copy, isn't doing much ... we
              can probably just remove it"). */}
          {/* The two side by side, as a profile has them (owner, 2026-11-23:
              "length median row and pace median split can be on the same
              line"). */}
          {s.field.length || s.field.pace ? (
            <View style={{ flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.ink }}>
              {s.field.length ? <Half k="Median row" v={fmtInt(s.field.length.median)} u="m" /> : null}
              {s.field.length && s.field.pace ? <View style={{ width: 1, backgroundColor: C.ink }} /> : null}
              {s.field.pace ? <Half k="Median split" v={m2(s.field.pace.median)} u="/500m" pad={!!s.field.length} /> : null}
            </View>
          ) : null}
          <View onLayout={(e) => setCardW(Math.round(e.nativeEvent.layout.width))} style={{ marginTop: 10 }}>
            <FieldCards
              w={cardW}
              field={s.field}
              you={st?.you ?? null}
              distances={s.distances
                .filter((d) => d.fieldN > 0)
                .map((d) => {
                  const mine = st?.distances.find((x) => x.meters === d.meters) ?? null;
                  return { meters: d.meters, label: d.label, field: d.field, fieldN: d.fieldN, you: mine?.you ?? d.you ?? null, youN: mine ? mine.youN : null };
                })}
            />
          </View>
          {month && s.hourGrid.length ? null : hoursOfDay}
        </>
      ) : null}

      {month && !m2d && s.attendance && s.attendance.rows.length ? (
        <>
          <Eye left="Perfect attendance" right={s.attendance.note} />
          {s.attendance.rows.map((r) => (
            <Tr key={r.participantId} place={null} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} onPress={() => onRower(r.rowerNumber)}>
              <Fig>{fmtInt(r.meters)} m</Fig>
            </Tr>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function marksOf(byDay: Record<string, number>): [number, number, number] {
  const max = Math.max(1, ...Object.values(byDay));
  return [max * 0.25, max * 0.5, max * 0.75];
}

/* One of two figures on a line, as the profile's standings are set. */
function Half({ k, v, u, pad }: { k: string; v: string; u: string; pad?: boolean }) {
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingLeft: pad ? 12 : 0 }}>
      <Text style={mono(10, false, C.gray, 0.14)}>{k}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 6 }}>
        <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, fontVariant: ["tabular-nums"] }}>{v}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.gray }}>{u}</Text>
      </View>
    </View>
  );
}

/* A figure of the field with its line of spread, between ink rules. */
function Summary({ k, v, u, line, first }: { k: string; v: string; u: string; line?: string; first?: boolean }) {
  return (
    <View style={{ borderTopWidth: first ? 2 : 1, borderBottomWidth: first ? 0 : 2, borderColor: C.ink, paddingVertical: 14 }}>
      <Text style={mono(11, false, C.gray)}>{k}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <Text style={{ fontFamily: F.black, fontSize: 28, color: C.ink, fontVariant: ["tabular-nums"] }}>{v}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.gray }}>{u}</Text>
      </View>
      {line ? <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 6, lineHeight: 18 }]}>{line}</Text> : null}
    </View>
  );
}

/* ONE CURVE OF THE FIELD AS A CARD, and where there is a rower to lay over
 * it, two: everyone, then the rower over everyone. The same curve, the same
 * frame of numbers, the same height, so the eye keeps its place across the
 * turn. */
/* Taller (owner, 2026-11-23: "give more vertical space to the KDEs"); was 180. */
const CURVE_H = 260;
/* THE FIELD'S CARDS, the stats tab's and a rower's profile's alike (owner,
 * 2026-11-23: "make the user page ... the exact same KDEs ... but starts
 * with their data, and then swiping is everyone else's data"). The stats
 * tab opens on everyone; a profile (`youFirst`) on the rower. */
type FieldYou = { sessions: number; lenPct: number | null; pacePct: number | null; lengthYou: KdeYou | null; paceYou: KdeYou | null };
type FieldDistance = { meters: number; label: string; field: Kde; fieldN: number; you: KdeYou | null; youN: number | null };
export function FieldCards({ w, field, you, distances, youFirst = false }: { w: number; field: { sessions: number; lengthKde?: Kde | null; paceKde?: Kde | null }; you: FieldYou | null; distances: FieldDistance[]; youFirst?: boolean }) {
  return (
    <>
      {field.lengthKde ? (
        <FieldCard
          w={w}
          youFirst={youFirst}
          name="the length of every row"
          title="Length of every row"
          note={`${fmtInt(field.sessions)} rows`}
          kde={field.lengthKde}
          fmt={(x) => (x >= 1000 ? `${x / 1000}K` : `${x}`)}
          say={lengthSay(field.lengthKde)}
          you={you?.lengthYou ?? null}
          youNote={you ? `${fmtInt(you.sessions)} of yours` : undefined}
          sayYou={you?.lengthYou ? lengthYouSay(you.lengthYou, you.lenPct) : null}
        />
      ) : null}
      {field.paceKde ? (
        <FieldCard
          w={w}
          youFirst={youFirst}
          name="the split of every row"
          title="Split of every row"
          note="/500m"
          kde={field.paceKde}
          fmt={m2}
          lowerIsBetter
          say={`Half of all timed rows hold a split faster than ${m2(field.paceKde.median)} /500m${middleHalf(field.paceKde, m2, 1, "sit")}. Faster is to the left.`}
          you={you?.paceYou ?? null}
          youNote={you?.paceYou ? `${fmtInt(you.paceYou.rug.length)} of yours` : undefined}
          sayYou={you?.paceYou ? paceYouSay(you.paceYou, you.pacePct) : null}
        />
      ) : null}
      {distances.map((d) => (
        <FieldCard
          key={d.meters}
          w={w}
          youFirst={youFirst}
          name={`every ${d.label}`}
          title={`The ${d.label}`}
          note={`${fmtInt(d.fieldN)} timed rows`}
          kde={d.field}
          fmt={m2}
          lowerIsBetter
          say={`The ${d.label} in the middle takes ${m2(d.field.median)}: half of the ${fmtInt(d.fieldN)} timed rows are quicker${middleHalf(d.field, m2, 5, "finish")}. Faster is to the left.`}
          you={d.you}
          youNote={d.youN !== null ? `${fmtInt(d.youN)} of yours` : undefined}
          sayYou={d.you && d.youN !== null ? distanceYouSay(d.label, d.field, d.you, d.youN) : null}
        />
      ))}
    </>
  );
}

function FieldCard({ w, name, title, note, kde, fmt, lowerIsBetter, say, you, youNote, sayYou, youFirst = false }: { w: number; name: string; title: string; note?: string; kde: Kde; fmt: (x: number) => string; lowerIsBetter?: boolean; say: string | null; you: KdeYou | null; youNote?: string; sayYou: string | null; youFirst?: boolean }) {
  const everyone = (fill: boolean) => (
    <Box fill={fill} title={title} note={note} say={say}>
      <Density kde={kde} fmt={fmt} lowerIsBetter={lowerIsBetter} height={CURVE_H} />
    </Box>
  );
  /* The same name over it, so either face says what it is a curve of. */
  const mine = (fill: boolean) => (
    <Box fill={fill} title={title} note={youNote ? `You over everyone · ${youNote}` : "You over everyone"} say={sayYou}>
      <Density kde={kde} you={you} fmt={fmt} lowerIsBetter={lowerIsBetter} height={CURVE_H} />
    </Box>
  );
  /* Before the width is known there is nothing to page across. */
  if (!you || w <= 0) return everyone(false);
  return (
    /* A touch that begins on the card is the card's: the tabs stay put
       while it is turned (ui.tsx scrub; the app's outer view clears it as
       the next touch begins). */
    <View
      onTouchStart={() => {
        scrub.on = true;
      }}
      onTouchEnd={() => {
        scrub.on = false;
      }}
      onTouchCancel={() => {
        scrub.on = false;
      }}
    >
      <Flip
        w={w}
        name={name}
        labels={youFirst ? [`You over everyone: ${name}`, `Everyone: ${name}`] : [`Everyone: ${name}`, `You over everyone: ${name}`]}
        own={youFirst ? mine : everyone}
        other={youFirst ? everyone(true) : mine(true)}
      />
    </View>
  );
}

/* THE ONE THING SAID UNDER A CURVE, each worked out from what the card
 * draws: the field's middle (counted by the server) and where its curve is
 * tallest; the rower's own middle and best, how their average stands among
 * the other rowers' (counted by the server, stats/field.ts), or the share
 * of the field's curve their middle is ahead of. Which way is better is
 * said where one way is: a longer row is not a better one. */
/* ", and the middle half sit between about 1:55 and 2:12": the quarter and
 * the three-quarter marks of the curve, to a round step. Nothing when the
 * curve cannot be read or the two round to one value. */
function middleHalf(kde: Kde, fmt: (x: number) => string, step: number, verb: string): string {
  const a = Math.round(kdeAtShare(kde, 0.25) / step) * step;
  const b = Math.round(kdeAtShare(kde, 0.75) / step) * step;
  return num(a) && num(b) && b > a ? `, and the middle half ${verb} between about ${fmt(a)} and ${fmt(b)}` : "";
}
function lengthSay(kde: Kde): string {
  const peak = kdePeak(kde);
  const top = num(peak) ? Math.round(peak / 100) * 100 : NaN;
  const mid = `Half of all rows are shorter than ${fmtInt(kde.median)} m and half are longer${middleHalf(kde, (x) => `${fmtInt(x)} m`, 100, "run")}.`;
  /* The commonest length is said only when it is not the middle again. */
  return num(top) && top > 0 && Math.abs(top - kde.median) > 0.1 * kde.median ? `${mid} The commonest length is about ${fmtInt(top)} m.` : mid;
}
function lengthYouSay(you: KdeYou, pct: number | null): string {
  const a = `Your average row is ${fmtInt(you.median)} m`;
  const b = pct === null ? "." : `, longer than the average of ${pct}% of the other rowers.`;
  const c = num(you.best) ? ` Your longest is ${fmtInt(you.best)} m.` : "";
  /* No moral after it (owner, 2026-11-23: "We can remove the commentary
   * that says longer is more meters in a sitting, not a better row"). */
  return `${a}${b}${c}`;
}
function paceYouSay(you: KdeYou, pct: number | null): string {
  const a = `Your average split is ${m2(you.median)} /500m`;
  const b = pct === null ? "." : `, faster than the average of ${pct}% of the other rowers.`;
  const c = num(you.best) ? ` Your fastest row held ${m2(you.best)}.` : "";
  return `${a}${b}${c} Faster is to the left.`;
}
function distanceYouSay(label: string, field: Kde, you: KdeYou, n: number): string {
  /* The share of the field's rows slower than the rower's middle. */
  const under = kdeShareUnder(field, you.median);
  const ahead = num(under) ? ` ${n > 1 ? "That middle" : "It"} is quicker than ${about(1 - under)} of every ${label} here.` : "";
  if (n <= 1) return `Your one timed ${label} took ${m2(you.median)}.${ahead} Faster is to the left.`;
  return `The middle of your ${n} timed ${label}s is ${m2(you.median)}${num(you.best) ? ` and your best is ${m2(you.best)}` : ""}.${ahead} Faster is to the left.`;
}

function ChartHead({ children }: { children: ReactNode }) {
  return (
    <View style={{ marginTop: 26, marginBottom: 10 }}>
      <Dash />
      <Text style={[mono(11, false, C.gray), { marginTop: 12 }]}>{children}</Text>
    </View>
  );
}

/* ONE RECORD: the lead, then the men's and the women's five. */
/* A RECORD THAT IS ONE ROW OPENS THAT ROW (owner, 2026-11-23: "I click
 * on that 5K on that chart on the next table, on the best table, it should
 * take me to that row, not that rower"). A fastest 5k or 10k and a longest
 * row are each one row; the board sends its day, not its id, so the row is
 * found in that rower's log: the day's row that makes the time (a 5k's
 * time pro-rated from anything at or over the distance), or the day's
 * longest. Total meters and the biggest day are a sum of rows, and open
 * the rower, as does a row that cannot be found (a private account). */
async function recordRow(num: number, key: RecordKey, r: RecordRow): Promise<string | null> {
  if (key !== "5000" && key !== "10000" && key !== "longest") return null;
  /* The board names the row now; the search below is for an answer cached
   * from before it did. */
  if (r.entryId) return r.entryId;
  if (!r.day) return null;
  const got = await api<{ profile?: { logRows: { id: string; day: string; meters?: number; seconds?: number; masked: boolean }[] } }>(`/api/row100k/app/profile?num=${num}&m=all`);
  const rows = (got.profile?.logRows ?? []).filter((x) => x.day === r.day && !x.masked && (x.meters ?? 0) > 0);
  if (key === "longest") return [...rows].sort((a, b) => (b.meters ?? 0) - (a.meters ?? 0))[0]?.id ?? null;
  const dist = Number(key);
  const timed = rows.filter((x) => (x.meters ?? 0) >= dist && (x.seconds ?? 0) > 0);
  return [...timed].sort((a, b) => Math.abs(((a.seconds ?? 0) * dist) / (a.meters ?? 1) - r.value) - Math.abs(((b.seconds ?? 0) * dist) / (b.meters ?? 1) - r.value))[0]?.id ?? null;
}

function openRecord(r: RecordRow, key: RecordKey, onRower: (n: number) => void, onRow?: (id: string) => void): void {
  if (!onRow || r.masked) return onRower(r.rowerNumber);
  if (r.entryId && key !== "total" && key !== "bigday") return onRow(r.entryId);
  recordRow(r.rowerNumber, key, r).then(
    (id) => (id ? onRow(id) : onRower(r.rowerNumber)),
    () => onRower(r.rowerNumber),
  );
}

/* A fastest's time with its pace under it (owner, 2026-11-23: "for the
 * fastest, I really need the pace here as well"). */
function TimeFig({ rec, r, val }: { rec: (typeof RECORDS)[number]; r: RecordRow; val: string }) {
  if (!rec.time) return <Fig>{val}</Fig>;
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Fig>{val}</Fig>
      <Text style={[mono(10, false, C.gray), { marginTop: 2 }]}>{fmtClock(r.value / (rec.time / 500))} /500m</Text>
    </View>
  );
}

function Records({ s, rec, onRower, onRow, onAll }: { s: Payload; rec: (typeof RECORDS)[number]; onRower: (n: number) => void; onRow?: (id: string) => void; onAll?: () => void }) {
  const open = (r: RecordRow) => openRecord(r, rec.key, onRower, onRow);
  const rows: RecordRow[] = s.records[rec.key] ?? [];
  const first = rows[0];
  const elite = rec.key === "total" ? rows.filter((r) => r.unranked) : [];
  const val = (r: RecordRow) => (rec.time ? fmtClock(r.value) : `${fmtInt(r.value)} m`);
  const table = (title: string, division: string) => {
    const list = rows.filter((r) => r.division === division);
    const mine = list.findIndex((r) => r.participantId === s.meId);
    const shown = list.slice(0, 5).map((r, i) => ({ r, place: i + 1 }));
    if (mine >= 5) shown.push({ r: list[mine], place: mine + 1 });
    return (
      <View>
        <TableHead>{title}</TableHead>
        {shown.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 14 }]}>Nobody on this board yet.</Text> : null}
        {shown.map(({ r, place }) => (
          <Tr key={r.participantId} place={r.unranked ? null : place} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} onPress={() => open(r)} label={`${r.unranked ? "" : `Place ${place}, `}${r.name}, ${r.masked ? "hidden" : val(r)}`}>
            {r.masked ? <Blocks n={r.digits ?? 5} size={13} /> : <TimeFig rec={rec} r={r} val={val(r)} />}
          </Tr>
        ))}
      </View>
    );
  };

  return (
    <View>
      {s.blackout.active ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 12 }]}>Lights out{rec.time ? " · times are shown" : ""}</Text> : null}
      {elite.length > 0 ? (
        <Lead center value={<Blocks n={elite.reduce((n, r) => Math.max(n, r.digits ?? String(Math.round(r.value)).length), 1)} size={44} />} unit="m" />
      ) : first ? (
        <Lead center value={rec.time ? fmtClock(first.value) : fmtInt(first.value)} unit={rec.time ? undefined : "m"}>
          {String(first.rowerNumber).padStart(3, "0")} · <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{first.name}</Text>
          {first.day ? ` · ${dayWord(first.day)}` : ""}
          {first.sessions != null ? ` · ${first.sessions} sessions` : ""}
          {rec.time ? ` · ${fmtClock((first.value / rec.time) * 500)} pace` : ""}
        </Lead>
      ) : (
        <Text style={[mono(11, false, C.gray), { paddingVertical: 18 }]}>Nobody holds this one yet.</Text>
      )}
      {elite.length > 0 ? null : (
        <>
          {table("Men", "M")}
          {table("Women", "F")}
          {/* THE FULL RANKINGS are their own page (owner, 2026-11-22: "there
              should be a full rankings button, and that just takes me to
              the full rankings page ... a different view"). */}
          {onAll && rows.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <Ctl label="Full rankings →" onPress={onAll} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/* METERS BY DAY / BY WEEK: one reading line, the lead, and everyone who
 * rowed that day or week in one table. */
function ByPeriod({ s, mode, slot, onSlot, onMode, onRower }: { s: Payload; mode: "day" | "week"; slot: number | null; onSlot: (i: number) => void; onMode: (k: "day" | "week") => void; onRower: (n: number) => void }) {
  const isWeek = mode === "week";
  const count = isWeek ? s.weekly.length : s.liveMonth ? s.todayDay + 1 : s.daily.length;
  const at = Math.min(count - 1, Math.max(0, slot ?? (isWeek ? s.defaultWeek : s.todayDay)));
  const rows: PeriodRow[] = (isWeek ? s.weekly[at] : s.daily[at]) ?? [];
  const total = isWeek ? s.weekTotals[at] : s.dayTotals[at];
  const word = isWeek ? (s.weeks[at]?.label ?? `Week ${at + 1}`) : `${s.month.short} ${at + 1}`;
  const first = rows[0];
  const modeWord = (k: "day" | "week", label: string) =>
    k === mode ? (
      <Text style={mono(12, true)}>{label}</Text>
    ) : (
      <Pressable accessibilityRole="button" onPress={() => onMode(k)} hitSlop={8}>
        <Text style={[mono(12, false, C.gray), { textDecorationLine: "underline", textDecorationStyle: "dotted" }]}>{label}</Text>
      </Pressable>
    );
  const arrow = (dir: -1 | 1) => {
    const off = dir < 0 ? at <= 0 : at >= count - 1;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={dir < 0 ? "Earlier" : "Later"} disabled={off} onPress={() => onSlot(at + dir)} hitSlop={12} style={{ paddingHorizontal: 8, opacity: off ? 0.3 : 1 }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 16, color: C.ink }}>{dir < 0 ? "‹" : "›"}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
        {modeWord("day", "By day")}
        <Dot />
        {modeWord("week", "By week")}
        <Dot />
        {arrow(-1)}
        <WordMenu
          ariaLabel={isWeek ? "Which week" : "Which day"}
          label={word}
          width={isWeek ? 240 : 296}
          options={isWeek ? s.weeks.slice(0, count).map((w, i) => ({ key: String(i), label: w.label })) : undefined}
          value={isWeek ? String(at) : undefined}
          onPick={isWeek ? (k) => onSlot(Number(k)) : undefined}
          panel={isWeek ? undefined : (close) => <DayPanel month={s.month} max={count} value={at} today={s.liveMonth ? s.todayDay : null} onPick={(i) => (close(), onSlot(i))} />}
        />
        {arrow(1)}
      </View>

      {first ? (
        <Lead center value={first.masked ? <Blocks n={first.digits ?? 5} size={44} /> : fmtInt(first.meters)} unit="m">
          {String(first.rowerNumber).padStart(3, "0")} · <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{first.name}</Text> · {first.sessions} {first.sessions === 1 ? "session" : "sessions"}
        </Lead>
      ) : (
        <Text style={[mono(11, false, C.gray), { paddingVertical: 18 }]}>Nothing rowed {isWeek ? "this week" : "that day"}.</Text>
      )}

      {rows.length ? (
        <View style={{ marginTop: 30 }}>
          <Cols cols={[{ label: "#", width: 34 }, { label: "Rower", flex: 1 }, { label: "Meters", width: 84, right: true }, { label: "Sess.", width: 52, right: true }]} />
          {rows.map((r, i) => (
            <Tr key={r.participantId} place={i + 1} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} you={r.participantId === s.meId} onPress={() => onRower(r.rowerNumber)}>
              {r.masked ? <Blocks n={r.digits ?? 5} size={13} /> : <Fig>{fmtInt(r.meters)} m</Fig>}
              <Text style={{ width: 52, textAlign: "right", fontFamily: F.mono, fontSize: 13, color: C.ink }}>{r.sessions}</Text>
            </Tr>
          ))}
          {total ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F2EEDF", paddingHorizontal: 6, paddingVertical: 11, borderTopWidth: 2, borderColor: C.ink }}>
              <Text style={mono(11, true, C.ink, 0.08)}>
                {total.rowers} rowers · {total.sessions} sessions
              </Text>
              <Text style={{ fontFamily: F.monoBold, fontSize: 13, color: C.ink }}>{fmtInt(total.meters)} m</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* THE DAY CALENDAR the day word drops (stats/DayCalendar.tsx): the month as
 * a grid, the day on screen in ink, today ringed in the blue, the days to
 * come faint. */
function DayPanel({ month, max, value, today, onPick }: { month: Stats["month"]; max: number; value: number; today: number | null; onPick: (i: number) => void }) {
  const cells: (number | null)[] = [...Array.from({ length: month.firstDow }, () => null), ...Array.from({ length: month.days }, (_, i) => i)];
  while (cells.length % 7) cells.push(null);
  return (
    <View style={{ padding: 12 }}>
      <Text style={[mono(11, true), { textAlign: "center", marginBottom: 10 }]}>{month.label}</Text>
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {"SMTWTFS".split("").map((l, i) => (
          <Text key={i} style={[mono(10, false, C.gray), { flex: 1, textAlign: "center" }]}>
            {l}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
            const off = d >= max;
            const on = d === value;
            return (
              <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${month.short} ${d + 1}`} accessibilityState={{ selected: on, disabled: off }} disabled={off} onPress={() => onPick(d)} style={{ flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: on || d === today ? "solid" : "dashed", borderColor: on ? C.ink : d === today ? C.accent : C.line, backgroundColor: on ? C.ink : "transparent", opacity: off ? 0.45 : 1 }}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 11, color: on ? C.paper : d === today ? C.accent : off ? C.gray : C.ink }}>{d + 1}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* THE FULL RANKINGS for one record: everybody on it, men and women in one
 * table in order, as the website's rankings page lists a board. The record
 * and the month are the two words at the top, as on the stats tab. */
export function RankingsScreen({ period: p0, rec: r0, onRower, onRow }: { period: string; rec: string; onRower: (n: number) => void; onRow?: (id: string) => void }) {
  const [period, setPeriod] = useState(p0);
  const [key, setKey] = useState<RecordKey>((RECORDS.find((r) => r.key === r0)?.key ?? "total") as RecordKey);
  const [who, setWho] = useState<"all" | "M" | "F">("all");
  const path = `/api/row100k/stats${period ? `?m=${period}` : ""}`;
  const { data, error, loading, reload } = useLoad(() => api<{ data: Payload }>(path), [path], path);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const s = data.data;
  const rec = RECORDS.find((r) => r.key === key) ?? RECORDS[0];
  const every: RecordRow[] = s.records[rec.key] ?? [];
  /* EVERYONE, MEN, WOMEN (owner, 2026-11-22: "on the full rankings page,
   * let's include a filter for men's and women's"). Places are counted
   * within what is showing. */
  const rows = who === "all" ? every : every.filter((r) => r.division === who);
  const val = (r: RecordRow) => (rec.time ? fmtClock(r.value) : `${fmtInt(r.value)} m`);
  let place = 0;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      {/* THREE OF ONE KIND (owner, 2026-11-23: "all-time, total meters, and
          then men, women, everyone should have the same exact selectors"):
          the time frame, the record and who, each a button with a caret,
          centred as on the stats tab. */}
      {/* On one line (owner, 2026-11-23: "These three menu options ... can
          they be like on the same line?"): the smaller button. */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginHorizontal: -14 }}>
        <WordMenu options={s.periods} value={s.period.key} onPick={setPeriod} ariaLabel="Which time frame" chip tight />
        <WordMenu options={RECORDS} value={key} onPick={(k) => setKey(k as RecordKey)} ariaLabel="Which record" chip tight />
        <WordMenu options={WHO} value={who} onPick={(k) => setWho(k as typeof who)} ariaLabel="Who" chip tight width={160} />
      </View>
      <TableHead>{`${rows.length} ${rows.length === 1 ? "rower" : "rowers"}`}</TableHead>
      {rows.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 14 }]}>Nobody on this board yet.</Text> : null}
      {rows.map((r) => {
        const n = r.unranked ? null : ++place;
        return (
          <Tr key={r.participantId} place={n} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} onPress={() => openRecord(r, rec.key, onRower, onRow)} label={`${n ? `Place ${n}, ` : ""}${r.name}`}>
            {r.masked ? <Blocks n={r.digits ?? 5} size={13} /> : <TimeFig rec={rec} r={r} val={val(r)} />}
          </Tr>
        );
      })}
    </ScrollView>
  );
}
