import { useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type PeriodRow, type RecordRow, type Stats } from "../api";
import { Columns, Density, HourGrid, MonthGrid } from "../charts";
import { useSession } from "../session";
import { Cols, Dash, Dot, Eye, Fig, Lead, TableHead, Tr, WordMenu, mono, Ctl, Chip } from "../site";
import { C, F, MONTHS, fmtClock, fmtInt } from "../theme";
import { Blocks, Waiting, useLoad, useScrollDir } from "../ui";

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
const dayWord = (day?: string) => (day ? `${MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)} ${Number(day.slice(8))}` : "");

type Payload = Stats & {
  thresholds?: number[];
  field: (Stats["field"] & { length?: Sum; pace?: Sum }) | null;
};
type Sum = { mean: number; median: number; sd: number; p10: number; p90: number };

export function StatsScreen({ onRower, onRankings, onScrollDir }: { onRower: (n: number) => void; onRankings?: (period: string, rec: string) => void; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { me } = useSession();
  /* ALL TIME first (owner, 2026-11-22: "on the stats, let's default it to
   * all time"). */
  const [period, setPeriod] = useState("all");
  const [stat, setStat] = useState<StatKey>("total");
  const [slot, setSlot] = useState<number | null>(null);
  const path = `/api/row100k/stats${period ? `?m=${period}` : ""}`;
  const { data, error, loading, reload } = useLoad(() => api<{ data: Payload }>(path), [path, me.me?.rowerNumber], path);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const s = data.data;
  const month = s.period.kind === "month";
  const key: StatKey = !month && (stat === "day" || stat === "week") ? "total" : stat;
  const rec = RECORDS.find((r) => r.key === key);
  const pickPeriod = (k: string) => {
    setPeriod(k);
    setSlot(null);
  };

  const monthWord = (color: string, size = 12, bold = true) => <WordMenu options={s.periods} value={s.period.key} onPick={pickPeriod} ariaLabel="Which month" textStyle={mono(size, bold, color)} />;
  const statWord = (
    <WordMenu
      options={[...RECORDS, ...(month ? PERIODS : [])]}
      value={key}
      onPick={(k) => {
        setStat(k);
        setSlot(null);
      }}
      ariaLabel="Which stat"
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
      {/* THE TWO WORDS */}
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", rowGap: 8, marginTop: 24 }}>
        {monthWord(C.ink)}
        <Dot />
        {statWord}
      </View>

      {rec ? <Records key={rec.key} s={s} rec={rec} onRower={onRower} onAll={onRankings ? () => onRankings(period, rec.key) : undefined} /> : <ByPeriod s={s} mode={key as "day" | "week"} slot={slot} onSlot={setSlot} onMode={setStat} onRower={onRower} />}

      {month ? (
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

      {s.field ? (
        <>
          <Eye left="The field" />
          {/* The two medians, and no line of mean, deviation and
              percentiles under them (owner, 2026-11-21: "the field on the
              stats page, that like little copy, isn't doing much ... we
              can probably just remove it"). */}
          {s.field.length ? <Summary k="Length · median row" v={fmtInt(s.field.length.median)} u="m" first /> : null}
          {s.field.pace ? <Summary k="Pace · median split" v={m2(s.field.pace.median)} u="/500m" /> : null}
          <ChartHead>Length of every row</ChartHead>
          <Density kde={s.field.lengthKde} fmt={(x) => (x >= 1000 ? `${x / 1000}K` : `${x}`)} />
          <ChartHead>Split of every row</ChartHead>
          <Density kde={s.field.paceKde} fmt={m2} lowerIsBetter />
          {s.distances
            .filter((d) => d.fieldN > 0)
            .map((d) => (
              <View key={d.meters}>
                <ChartHead>
                  The {d.label} · {d.fieldN} timed rows
                </ChartHead>
                <Density kde={d.field} you={d.you} fmt={m2} lowerIsBetter />
              </View>
            ))}
          {month && s.hourGrid.length ? null : hoursOfDay}
        </>
      ) : null}

      {month && s.attendance && s.attendance.rows.length ? (
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

function ChartHead({ children }: { children: ReactNode }) {
  return (
    <View style={{ marginTop: 26, marginBottom: 10 }}>
      <Dash />
      <Text style={[mono(11, false, C.gray), { marginTop: 12 }]}>{children}</Text>
    </View>
  );
}

/* ONE RECORD: the lead, then the men's and the women's five. */
function Records({ s, rec, onRower, onAll }: { s: Payload; rec: (typeof RECORDS)[number]; onRower: (n: number) => void; onAll?: () => void }) {
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
          <Tr key={r.participantId} place={r.unranked ? null : place} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} onPress={() => onRower(r.rowerNumber)} label={`${r.unranked ? "" : `Place ${place}, `}${r.name}, ${r.masked ? "hidden" : val(r)}`}>
            {r.masked ? <Blocks n={r.digits ?? 5} size={13} /> : <Fig>{val(r)}</Fig>}
          </Tr>
        ))}
      </View>
    );
  };

  return (
    <View>
      {s.blackout.active ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 12 }]}>Lights out{rec.time ? " · times are shown" : ""}</Text> : null}
      {elite.length > 0 ? (
        <Lead value={<Blocks n={elite.reduce((n, r) => Math.max(n, r.digits ?? String(Math.round(r.value)).length), 1)} size={44} />} unit="m" />
      ) : first ? (
        <Lead value={rec.time ? fmtClock(first.value) : fmtInt(first.value)} unit={rec.time ? undefined : "m"}>
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
        <Lead value={first.masked ? <Blocks n={first.digits ?? 5} size={44} /> : fmtInt(first.meters)} unit="m">
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
export function RankingsScreen({ period: p0, rec: r0, onRower }: { period: string; rec: string; onRower: (n: number) => void }) {
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
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", rowGap: 8 }}>
        <WordMenu options={s.periods} value={s.period.key} onPick={setPeriod} ariaLabel="Which month" />
        <Dot />
        <WordMenu options={RECORDS} value={key} onPick={(k) => setKey(k as RecordKey)} ariaLabel="Which record" />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 18 }}>
        <Chip label="Everyone" on={who === "all"} onPress={() => setWho("all")} />
        <Chip label="Men" on={who === "M"} onPress={() => setWho("M")} />
        <Chip label="Women" on={who === "F"} onPress={() => setWho("F")} />
      </View>
      <TableHead>{`${rows.length} ${rows.length === 1 ? "rower" : "rowers"}`}</TableHead>
      {rows.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 14 }]}>Nobody on this board yet.</Text> : null}
      {rows.map((r) => {
        const n = r.unranked ? null : ++place;
        return (
          <Tr key={r.participantId} place={n} num={r.rowerNumber} name={r.name} me={r.participantId === s.meId} onPress={() => onRower(r.rowerNumber)} label={`${n ? `Place ${n}, ` : ""}${r.name}`}>
            {r.masked ? <Blocks n={r.digits ?? 5} size={13} /> : <Fig>{val(r)}</Fig>}
          </Tr>
        );
      })}
    </ScrollView>
  );
}
