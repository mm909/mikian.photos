import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { api, type Stories as Base } from "../api";
import { Columns } from "../charts";
import { Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Bar, Waiting, useLoad } from "../ui";

/* THE FAQS BEHIND THE STATS, called QUESTIONS until 2026-11-23 (owner, 2026-11-21: "there's a desire to
 * look at charts ... if they're answering a cool question"; "the
 * notification button on the stats page gets replaced with like little FAQ
 * button. And then the FAQ button has ... row after row of a question ...
 * And then when you click it ... it'll take you to a new page. It'll kind
 * of show you whatever graph and some explanation for that stat. Let's try
 * it for two of them"; "maybe ... the FAQs are really stories").
 *
 * A LIST of questions, each a line. A question's page: the answer as one
 * big figure, the chart that shows it, and a few plain sentences about
 * what the chart counts. Two to begin with (api/row100k/app/stories):
 * how many people are rowing, and when people row. A third is a line in
 * STORIES and a case in StoryScreen. */
/* THREE MORE (owner, 2026-11-21, of the first two: "in general, these
 * questions are good ... take that as free rein to add a couple more"):
 * who makes the 100K (the question the whole app leans on), how far a
 * typical row is, and how long a 5K takes the field. */
/* THE FAQS (owner, 2026-11-23: "instead of questions, let's just make it
 * FAQs. Still the Q be the thing that is blue"): the page's name in the bar
 * over it (App.tsx, mark.tsx). And two more answers ("spend some time
 * adding some more stats in that FAQ, and like a couple of them I think is
 * appropriate"; a scatter was the kind of picture he named):
 *
 *   slower   do longer rows go slower: every timed row, its length against
 *            its split, a dot the size of how many rows are there, and the
 *            middle split of each thousand meters as the blue line
 *   often    how many days of a week a rower who rows in it rows
 *
 * Absent from a server that has not been updated, as the three before. */
type Slower = { bands: { rows: number; median: number }[]; cells: { b: number; p: number; n: number }[]; paceFrom: number; paceTo: number; paceStep: number; rows: number; short: { rows: number; median: number }; long: { rows: number; median: number } };
type Often = { days: number[]; weeks: number; median: number; mean: number; rowers: number; spans: number };
type Stories = Base & { slower?: Slower; often?: Often };

export type StoryId = "rowers" | "when" | "club" | "length" | "fivek" | "slower" | "often";
const STORIES: { id: StoryId; q: string; sub: string }[] = [
  { id: "rowers", q: "How many people are rowing?", sub: "Today, this week, and each month so far" },
  { id: "club", q: "How many make the 100K?", sub: "Each month, and how many rows it took them" },
  { id: "when", q: "When do people row?", sub: "The hour of the day, and the day of the week" },
  { id: "length", q: "How far is a typical row?", sub: "Every row by its length, a thousand meters at a time" },
  { id: "fivek", q: "How long does a 5K take?", sub: "Every timed 5,000 m, half a minute at a time" },
  { id: "slower", q: "Do longer rows go slower?", sub: "Every timed row, its length against its split" },
  { id: "often", q: "How many days a week do people row?", sub: "Every rower's week, by the days rowed in it" },
];
const PATH = "/api/row100k/app/stories";

export function StoriesScreen({ onStory }: { onStory: (id: StoryId) => void }) {
  /* Read as the list opens, so a question's page has its answer in hand. */
  useLoad(() => api<Stories>(PATH), [], PATH);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140 }}>
      {STORIES.map((s) => (
        <Pressable key={s.id} accessibilityRole="link" accessibilityLabel={s.q} onPress={() => onStory(s.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 76, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ flex: 1, paddingVertical: 14 }}>
            <Text style={{ fontFamily: F.black, fontSize: 20, lineHeight: 24, color: C.ink }}>{s.q}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.gray, marginTop: 4 }}>{s.sub}</Text>
          </View>
          <Text style={{ fontFamily: F.black, fontSize: 16, color: C.gray }}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const hourWord = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "noon" : h < 12 ? `${h} AM` : `${h - 12} PM`);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const short = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8))}`;

export function StoryScreen({ id }: { id: StoryId }) {
  const { data, error, reload } = useLoad(() => api<Stories>(PATH), [], PATH);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const story = STORIES.find((s) => s.id === id) ?? STORIES[0];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }}>
      <Text style={{ fontFamily: F.black, fontSize: 28, lineHeight: 32, color: C.ink }}>{story.q}</Text>
      {id === "rowers" ? <Rowers r={data.rowers} /> : id === "club" && data.club ? <Club c={data.club} /> : id === "length" && data.length ? <Length l={data.length} /> : id === "fivek" && data.fivek ? <FiveK f={data.fivek} /> : id === "slower" && data.slower ? <SlowerStory s={data.slower} /> : id === "often" && data.often ? <OftenStory o={data.often} /> : id === "when" ? <When w={data.when} /> : <Words>This answer is not here yet. Pull the stats down to refresh and open it again.</Words>}
    </ScrollView>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/* HOW MANY MAKE THE 100K: the share of the last finished month as the big
 * figure, then every month as a bar of who made it out of who rowed. */
function Club({ c }: { c: NonNullable<Stories["club"]> }) {
  const done = c.months.filter((m) => !m.live);
  const lead = done[done.length - 1] ?? c.months[c.months.length - 1];
  if (!lead) return <Words>Nobody has logged a row yet.</Words>;
  const pct = lead.rowers ? Math.round((lead.made / lead.rowers) * 100) : 0;
  return (
    <>
      <Answer value={`${pct}%`} unit={`made it in ${lead.label}`}>
        {lead.made} of the {lead.rowers} rowers who logged a row in {lead.label} reached {fmtInt(c.goal)} m.{lead.made ? ` Half of those who made it needed ${lead.rowsToMake} rows or fewer: about ${fmtInt(Math.round(c.goal / Math.max(1, lead.rowsToMake) / 100) * 100)} m a row.` : ""}
      </Answer>

      <Eye left="Each month" right={`${fmtInt(c.everMade)} rowers have made one`} />
      {c.months.map((m) => (
        <View key={m.key} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>
              {m.label} <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{m.year}</Text>
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {fmtInt(m.made)} <Text style={{ fontFamily: F.mono, color: C.gray }}>of {fmtInt(m.rowers)}</Text>
            </Text>
          </View>
          <Bar value={m.made} goal={m.rowers + 0.001} height={10} />
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 8 }]}>{m.live ? "Still being rowed" : m.made ? `${m.rowsToMake} rows to make it, at the median` : "Nobody made it"}</Text>
        </View>
      ))}
      <Words>A rower counts for a month once they have logged one row in it, and makes the 100K when their rows in that month add up to {fmtInt(c.goal)} m. 100,000 m in a thirty-day month is 3,334 m a day, or a 5K two days in three.</Words>
    </>
  );
}

/* HOW FAR A ROW IS: the row in the middle of them all as the big figure,
 * then every row in columns a thousand meters wide. */
function Length({ l }: { l: NonNullable<Stories["length"]> }) {
  const total = Math.max(1, l.rows);
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  const peak = l.bins.indexOf(Math.max(...l.bins));
  return (
    <>
      <Answer value={fmtInt(l.median)} unit="meters, the row in the middle">
        Half of all {fmtInt(l.rows)} rows were shorter than that and half were longer. {share(l.fives)} of them were a 5,000 m and {share(l.tens)} a 10,000 m. The longest anybody has logged in one sitting is {fmtInt(l.longest)} m.
      </Answer>

      <Eye left="Rows by length" right="A column a thousand meters" />
      <Columns values={l.bins} accent={peak} height={110} />
      <Under labels={["0", "3K", "6K", "9K", "12K+"]} />
      <Words>One column is a thousand meters of length: the first is every row under 1,000 m, the last is every row of 12,000 m or more. The blue one is the commonest.</Words>
    </>
  );
}

/* HOW LONG A 5K TAKES: the time in the middle as the big figure, then
 * every timed 5,000 m in columns half a minute wide. */
function FiveK({ f }: { f: NonNullable<Stories["fivek"]> }) {
  if (!f.rows) return <Words>Nobody has logged a timed 5,000 m yet.</Words>;
  const at = Math.max(0, Math.min(f.bins.length - 1, Math.floor((f.median - f.from) / f.step)));
  const end = f.from + f.bins.length * f.step;
  const marks = [0, 0.25, 0.5, 0.75, 1].map((p) => mmss(f.from + (end - f.from) * p));
  return (
    <>
      <Answer value={mmss(f.median)} unit="the 5K in the middle">
        Half of the {fmtInt(f.rows)} timed 5,000 m rows, by {fmtInt(f.rowers)} rowers, were quicker than that. It is a split of {mmss(f.median / 10)} a 500. {Math.round((f.under20 / f.rows) * 100)}% of them came in under 20 minutes.
      </Answer>

      <Eye left="Every 5K by its time" right="A column half a minute" />
      <Columns values={f.bins} accent={at} height={110} />
      <Under labels={marks} />
      <Words>One column is half a minute of finishing time, quicker to the left. The blue one holds the 5K in the middle. A rower who has rowed forty of them is in here forty times, so this is every 5K rowed and not every rower's best.</Words>
    </>
  );
}

/* DO LONGER ROWS GO SLOWER: how many seconds a 500 the rows of 9,000 m and
 * over give away to the rows under 3,000 m, as the big figure; then every
 * timed row as a field of dots, length across and split up the side, faster
 * at the top. */
function SlowerStory({ s }: { s: Slower }) {
  const [w, setW] = useState(0);
  if (!s.rows) return <Words>Nobody has logged a timed row yet.</Words>;
  const both = s.short.rows >= 5 && s.long.rows >= 5;
  const gap = both ? Math.round(s.long.median - s.short.median) : 0;
  const value = !both ? mmss(mid(s.bands)) : gap === 0 ? "0 s" : `${gap > 0 ? "+" : "-"}${Math.abs(gap)} s`;
  const unit = !both ? "the split in the middle" : gap > 0 ? "a 500, short rows to long" : gap < 0 ? "a 500: the long rows are quicker" : "a 500: no difference";

  /* The frame: the pace band that has rows in it, a little air either
   * side, to the ten seconds. */
  const used = s.cells.map((c) => s.paceFrom + c.p * s.paceStep);
  const top = used.length ? Math.max(s.paceFrom, Math.floor((Math.min(...used) - 5) / 10) * 10) : s.paceFrom;
  const foot = used.length ? Math.min(s.paceTo, Math.ceil((Math.max(...used) + s.paceStep + 5) / 10) * 10) : s.paceTo;
  const H = 240;
  const L = 40;
  const R = 8;
  const T = 10;
  const B = 8;
  const N = s.bands.length;
  const col = w > L + R ? (w - L - R) / N : 0;
  const cx = (b: number) => L + (b + 0.5) * col;
  const cy = (pace: number) => T + ((pace - top) / Math.max(1, foot - top)) * (H - T - B);
  const most = Math.max(1, ...s.cells.map((c) => c.n));
  const rMax = Math.max(3, Math.min(col / 2 - 0.5, 9));
  const marks: number[] = [];
  const stepY = foot - top > 80 ? 20 : 10;
  for (let v = Math.ceil(top / stepY) * stepY; v <= foot; v += stepY) marks.push(v);
  let line = "";
  s.bands.forEach((b, i) => {
    if (b.rows >= 5) line += `${line ? "L" : "M"}${cx(i).toFixed(1)} ${cy(b.median).toFixed(1)}`;
  });
  const fastest = s.bands.map((b, i) => ({ ...b, i })).filter((b) => b.rows >= 5).sort((a, b) => a.median - b.median)[0];
  const bandWord = (i: number) => (i >= N - 1 ? `${fmtInt(i * 1000)} m and over` : `${fmtInt(i * 1000)} to ${fmtInt((i + 1) * 1000)} m`);
  return (
    <>
      <Answer value={value} unit={unit}>
        {both
          ? `The ${fmtInt(s.short.rows)} timed rows under 3,000 m went at ${mmss(s.short.median)} a 500 in the middle, and the ${fmtInt(s.long.rows)} of 9,000 m and over at ${mmss(s.long.median)}.`
          : `There are not yet five timed rows under 3,000 m and five of 9,000 m and over to set against each other, out of ${fmtInt(s.rows)} timed rows.`}
        {fastest ? ` The quickest of all are the rows of ${bandWord(fastest.i)}, at ${mmss(fastest.median)} in the middle.` : ""}
      </Answer>

      <Eye left="Length against split" right={`${fmtInt(s.rows)} timed rows`} />
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ height: H }}>
        {col > 0 ? (
          <Svg width={w} height={H}>
            {marks.map((v) => (
              <Line key={v} x1={L} x2={w - R} y1={cy(v)} y2={cy(v)} stroke={C.line} strokeWidth={1} />
            ))}
            {marks.map((v) => (
              <SvgText key={`t${v}`} x={L - 6} y={cy(v) + 3.5} textAnchor="end" fontSize={10} fontFamily={F.mono} fill={C.gray}>
                {mmss(v)}
              </SvgText>
            ))}
            <Line x1={L} x2={w - R} y1={H - 1} y2={H - 1} stroke={C.ink} strokeWidth={2} />
            {s.cells.map((c) => {
              const pace = s.paceFrom + (c.p + 0.5) * s.paceStep;
              if (pace < top || pace > foot) return null;
              return <Circle key={`${c.b}:${c.p}`} cx={cx(c.b)} cy={cy(pace)} r={Math.max(1.6, rMax * Math.sqrt(c.n / most))} fill={C.ink} opacity={0.3} />;
            })}
            {line ? <Path d={line} stroke={C.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
            {s.bands.map((b, i) => (b.rows >= 5 ? <Circle key={`m${i}`} cx={cx(i)} cy={cy(b.median)} r={3.2} fill={C.accent} /> : null))}
          </Svg>
        ) : null}
      </View>
      {/* Under the columns: the thousands at their own edges, and the last
          column, which is every row of 12,000 m and more. */}
      <View style={{ height: 18, marginTop: 5 }}>
        {col > 0
          ? [0, 3, 6, 9].map((k) => (
              <Text key={k} style={[mono(10, false, C.gray, 0.1), { position: "absolute", left: L + k * col - 20, width: 40, textAlign: "center" }]}>
                {k ? `${k}K` : "0"}
              </Text>
            ))
          : null}
        {col > 0 ? <Text style={[mono(10, false, C.gray, 0.1), { position: "absolute", right: 0, width: 48, textAlign: "right" }]}>12K+</Text> : null}
      </View>
      <Words>Across is how long the row was, a column a thousand meters; up the side is its split, faster at the top. A dot is every row of that length at that split, five seconds to a step, and a bigger dot is more rows. The blue line joins the split in the middle of each thousand that has five rows or more.</Words>
      <Words>It is every row and not every rower: somebody who rows a 10K every morning is in the last columns many times over, so the line says what the rows did, not what a longer row would cost you.</Words>
    </>
  );
}
/* The split in the middle of every timed row, from the thousands' own
 * middles weighted by their rows: only for the figure when the short and
 * the long rows cannot yet be set against each other. */
function mid(bands: { rows: number; median: number }[]): number {
  const total = bands.reduce((a, b) => a + b.rows, 0);
  let run = 0;
  for (const b of [...bands].filter((x) => x.rows > 0).sort((a, b) => a.median - b.median)) {
    run += b.rows;
    if (run >= total / 2) return b.median;
  }
  return 0;
}

/* HOW MANY DAYS A WEEK: the week in the middle as the big figure, then
 * every rower's week in seven columns, by the days rowed in it. */
function OftenStory({ o }: { o: Often }) {
  if (!o.weeks) return <Words>There is not a whole week of rows yet.</Words>;
  /* A few weeks out of hundreds are not none of them. */
  const share = (n: number) => (n > 0 && n / o.weeks < 0.005 ? "under 1%" : `${Math.round((n / o.weeks) * 100)}%`);
  const peak = o.days.indexOf(Math.max(...o.days));
  const five = o.days.slice(4).reduce((a, b) => a + b, 0);
  const m = Math.round(o.median * 2) / 2;
  return (
    <>
      <Answer value={String(m)} unit={m === 1 ? "day a week, in the middle" : "days a week, in the middle"}>
        Out of {fmtInt(o.weeks)} weeks rowed by {fmtInt(o.rowers)} rowers, half had that many days with a row in them or fewer. The average is {o.mean.toFixed(1)}. {share(o.days[0])} of those weeks had one day with a row, {share(five)} had five or more, and {share(o.days[6])} had all seven.
      </Answer>

      <Eye left="Weeks by days rowed" right={`${fmtInt(o.spans)} ${o.spans === 1 ? "week" : "weeks"} so far`} />
      <Columns values={o.days} accent={peak} height={110} />
      {/* A number under the middle of each column. */}
      <View style={{ flexDirection: "row", gap: 2, marginTop: 5 }}>
        {o.days.map((_, i) => (
          <Text key={i} style={[mono(10, false, C.gray, 0.1), { flex: 1, textAlign: "center" }]}>
            {i + 1}
          </Text>
        ))}
      </View>
      <Words>A week is Monday to Sunday, and a rower is counted in it once they have logged one row in it: a week off is not in here. One column is how many of those weeks had that many days with a row. The blue one is the commonest. The week still being rowed is left out.</Words>
    </>
  );
}

/* The answer: one figure in the blue, and what it counts. */
function Answer({ value, unit, children }: { value: string; unit: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 22, borderTopWidth: 2, borderBottomWidth: 1, borderColor: C.ink, paddingVertical: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ fontFamily: F.black, fontSize: 60, lineHeight: 64, color: C.accent, fontVariant: ["tabular-nums"] }}>{value}</Text>
        <Text style={mono(12, true)}>{unit}</Text>
      </View>
      <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>{children}</Text>
    </View>
  );
}
const Words = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 22, color: C.soft, marginTop: 14 }}>{children}</Text>;
/* Labels under a chart's columns, the first, the middle ones and the last. */
function Under({ labels }: { labels: string[] }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
      {labels.map((l, i) => (
        <Text key={i} style={mono(10, false, C.gray, 0.1)}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function Rowers({ r }: { r: Stories["rowers"] }) {
  const [now, last, before] = r.weeks;
  const diff = now - last;
  const pct = last > 0 ? Math.round((Math.abs(diff) / last) * 100) : 0;
  const trend = last === 0 && now === 0 ? "the same as" : Math.abs(diff) < 0.05 ? "level with" : diff > 0 ? `up ${pct}% on` : `down ${pct}% on`;
  const most = Math.max(1, ...r.months.map((m) => m.rowers));
  return (
    <>
      <Answer value={String(now)} unit="rowers a day">
        The average over the last seven whole days. That is {trend} the week before ({last} a day), and the week before that was {before} a day.
      </Answer>

      <Eye left="Each day, the last four weeks" right={`${r.today} so far today`} />
      <Columns values={r.days.map((d) => d.rowers)} accent={r.days.length - 1} height={110} />
      <Under labels={[short(r.days[0].day), short(r.days[9].day), short(r.days[18].day), "Today"]} />
      <Words>One column is one day: how many different rowers logged at least one row on it. Today is the blue one, and it is still filling.</Words>

      <Eye left="Each month" right={`${fmtInt(r.everyone)} rowers in all`} />
      {r.months.map((m) => (
        <View key={m.key} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>
              {m.label} <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{m.year}</Text>
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {fmtInt(m.rowers)} <Text style={{ fontFamily: F.mono, color: C.gray }}>rowers</Text>
            </Text>
          </View>
          <Bar value={m.rowers} goal={most + 0.001} height={10} />
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 8 }]}>
            {fmtInt(m.rows)} rows · {fmtInt(m.meters)} m
          </Text>
        </View>
      ))}
      <Words>A rower counts for a month once they have logged one row in it, however many more they log.</Words>
    </>
  );
}

function When({ w }: { w: Stories["when"] }) {
  const peak = w.hours.indexOf(Math.max(...w.hours));
  const total = Math.max(1, w.rows);
  const before9 = w.hours.slice(0, 9).reduce((a, b) => a + b, 0);
  const after5 = w.hours.slice(17).reduce((a, b) => a + b, 0);
  const share = (n: number) => `${Math.round((n / total) * 100)}%`;
  const topDay = w.weekdays.indexOf(Math.max(...w.weekdays));
  /* The week from Monday, as a rower plans it. */
  const week = [1, 2, 3, 4, 5, 6, 0];
  return (
    <>
      <Answer value={hourWord(peak).toUpperCase()} unit="is the busiest hour">
        {share(w.hours[peak])} of all {fmtInt(w.rows)} rows were logged in the hour from {hourWord(peak)}. {share(before9)} were in before 9 in the morning, and {share(after5)} came after 5 in the evening.
      </Answer>

      <Eye left="Rows by hour of the day" right="Pacific time" />
      <Columns values={w.hours} accent={peak} height={110} />
      <Under labels={["12 AM", "6 AM", "Noon", "6 PM", "12 AM"]} />
      <Words>One column is one hour of the day, every row ever logged. The hour is when the row was logged, which for most rows is a few minutes after the last stroke.</Words>

      <Eye left="Rows by day of the week" right={`${DAYS[topDay]} leads`} />
      <Columns values={week.map((d) => w.weekdays[d])} accent={week.indexOf(topDay)} height={90} />
      <Under labels={week.map((d) => DAYS[d].slice(0, 3))} />
      <Words>The day is the one the rower put the row under.</Words>
    </>
  );
}
