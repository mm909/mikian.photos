import { Text, View } from "react-native";
import { api } from "../api";
import { ScrubColumns } from "../charts";
import { mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Waiting, useLoad } from "../ui";

/* WHO USES THE APP (owner, 2026-11-26: "inside the app, I need like a total
 * number of downloads, total number of users, total number of times used
 * in a day ... I need to know who's using the app because I think someone
 * has downloaded it. So I want to see a count of that somewhere"; and "a
 * place inside of settings that shows me the Android status, like how many
 * people we have and if they've ... downloaded the app"). The owner's
 * alone, in settings. The figures are the site's (row100k/appUsage.ts). */
type Person = { name: string; rowerNumber: number | null; platforms: string[]; firstDay: string; lastDay: string; days: number; opens: number; days28?: number; opens28?: number; acts28?: number; power?: boolean };
type Versus = { key: string; label: string; today: number; avgDay: number | null; week: number; avgWeek: number | null };
type Usage = {
  today: string;
  weekly?: { thisWeek: number; avg4: number; goal: number; weeks: { start: string; end: string; users: number }[] };
  powerUses?: number;
  versus?: Versus[];
  since: string | null;
  accounts: number;
  byPlatform: { ios: number; android: number; web: number; phone?: number };
  meterShare?: { today: number | null; week: number | null; prior4: number | null };
  recorded?: { week: number | null; weekRows: number; prior4: number | null; prior4Rows: number };
  panels?: { panel: string; minutes: number; rowers: number }[];
  signedOut?: number;
  todayUsers: number;
  todayOpens: number;
  days: { day: string; users: number; opens: number }[];
  people: Person[];
  android: { have: number; goal: number; testers: { name: string; sent: boolean; onApp: boolean }[]; installs: number };
};
const PATH = "/api/row100k/app/usage";
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
/* The live erg view's panels, by the names the top bar gives them. */
const PANEL: Record<string, string> = { race: "Race", show: "Arcade", up: "Up next", pace: "Pace", figures: "Figures", chart: "Chart", splits: "Splits", end: "The end" };
const PLAT: Record<string, string> = { ios: "iPhone", android: "Android", web: "Web", phone: "Phone, kind not known yet" };

export function AppUsage() {
  const { data, error, reload } = useLoad(() => api<Usage>(PATH), [], PATH);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const d = data;
  const head = (s: string, aside?: string) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 30, paddingBottom: 6, borderBottomWidth: 2, borderColor: C.ink }}>
      <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase" }}>{s}</Text>
      {aside ? <Text style={mono(9.5, false, C.gray, 0.08)}>{aside}</Text> : null}
    </View>
  );
  const row = (k: string, v: string, sub?: string) => (
    <View key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10 }}>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
        <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{v}</Text>
      </View>
      {sub ? <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 3 }]}>{sub}</Text> : null}
    </View>
  );
  const a = d.android;
  /* A figure, its average beside it, and how far off, up in blue. */
  const vs = (k: string, now: number, avg: number | null) => {
    const off = avg != null && avg > 0 ? Math.round((now / avg - 1) * 100) : null;
    return (
      <View key={k} style={{ flexDirection: "row", alignItems: "baseline", columnGap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
        <Text style={{ width: 52, textAlign: "right", fontFamily: F.monoBold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(now)}</Text>
        <Text style={{ width: 52, textAlign: "right", fontFamily: F.mono, fontSize: 12, color: C.gray, fontVariant: ["tabular-nums"] }}>{avg == null ? "—" : avg >= 10 ? fmtInt(avg) : avg.toFixed(1)}</Text>
        <Text style={{ width: 52, textAlign: "right", fontFamily: F.monoBold, fontSize: 12, color: off == null ? C.gray : off >= 0 ? C.accent : C.ink, fontVariant: ["tabular-nums"] }}>{off == null ? "" : `${off >= 0 ? "+" : ""}${off}%`}</Text>
      </View>
    );
  };
  return (
    <View>
      <Text style={[mono(10, true, C.ink, 0.12), { marginTop: 8 }]}>Accounts on the app</Text>
      <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 6 }}>{fmtInt(d.accounts)}</Text>
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4, lineHeight: 16 }]}>
        {`${d.byPlatform.ios} iPhone · ${d.byPlatform.android} Android${d.byPlatform.phone ? ` · ${d.byPlatform.phone} not known yet` : ""}${d.byPlatform.web ? ` · ${d.byPlatform.web} web` : ""}. On the app by an open, a phone set for notifications, or something only the app does (a like, a comment, a follow, a recording, a row logged there). A download nobody signed in on is only in Apple's and Google's consoles.`}
      </Text>

      {/* AGAINST FOUR WEEKS (owner, 2026-11-26: "include things like likes
          and comments on rows ... compare most of these numbers to a ...
          4-week average"). */}
      {d.versus ? (
        <>
          {head("Today", "vs a 4-week average day")}
          {d.versus.map((v) => vs(v.label, v.today, v.avgDay))}
          {/* WHERE THE METERS ARE LOGGED (owner, 2026-11-26: "a percentage of
              meters that happen on the app versus online"). */}
          {d.meterShare ? (
            <>
              {head("Meters logged on the app")}
              {row("Today", d.meterShare.today == null ? "—" : `${d.meterShare.today}%`)}
              {row("Last 7 days", d.meterShare.week == null ? "—" : `${d.meterShare.week}%`)}
              {row("The 4 weeks before", d.meterShare.prior4 == null ? "—" : `${d.meterShare.prior4}%`, "Before Nov 26 a row is the app's when it has a recording or a caption; a typed one counts as the site's.")}
            </>
          ) : null}
          {/* OFF A MONITOR OR TYPED IN (owner, 2026-11-26: "how many rows
              have telemetry data versus are just logged manually"). */}
          {d.recorded ? (
            <>
              {head("Rows with a recording", "off a monitor, not typed")}
              {row("Last 7 days", d.recorded.week == null ? "—" : `${d.recorded.week}%`, `${d.recorded.weekRows} rows logged`)}
              {row("The 4 weeks before", d.recorded.prior4 == null ? "—" : `${d.recorded.prior4}%`, `${d.recorded.prior4Rows} rows logged`)}
            </>
          ) : null}
          {/* THE LIVE ERG VIEW (owner: "which panel users are spending their
              time on"). */}
          {d.panels ? (
            <>
              {head("The live erg view", "minutes, last 28 days")}
              {d.panels.length ? (
                d.panels.map((p) => row(PANEL[p.panel] ?? p.panel, `${p.minutes} min`, `${p.rowers} ${p.rowers === 1 ? "rower" : "rowers"}`))
              ) : (
                <Text style={[mono(10, false, C.gray, 0.08), { paddingVertical: 8 }]}>Counts from this update: nobody else has rowed with the app open since.</Text>
              )}
            </>
          ) : null}
          {head("Last 7 days", "vs a 4-week average week")}
          {d.versus.map((v) => vs(v.label, v.week, v.avgWeek))}
          <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>
            {`The app's opens are counted from ${d.since ? short(d.since) : "today"}, so their average is over the days there are. Rows, likes and comments go back as far as they need.`}
          </Text>
        </>
      ) : (
        <>
          {/* THE GOAL (owner, 2026-11-26: "I want 100 average weekly users
          across 4 weeks ... we just first need to get to there"): rowers
          who used the app on some day of each 7-day stretch. */}
      {d.weekly ? (
        <>
          {head("Weekly app users", `goal ${d.weekly.goal}`)}
          <View style={{ flexDirection: "row", alignItems: "baseline", columnGap: 10, marginTop: 10 }}>
            <Text style={{ fontFamily: F.black, fontSize: 40, lineHeight: 44, color: C.accent, fontVariant: ["tabular-nums"] }}>{d.weekly.avg4}</Text>
            <Text style={mono(10, false, C.gray, 0.08)}>{`a week, the 4 weeks before this one · ${d.weekly.thisWeek} this week`}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: C.line, marginTop: 10 }}>
            <View style={{ height: 8, width: `${Math.min(100, (d.weekly.avg4 / d.weekly.goal) * 100)}%`, backgroundColor: C.accent }} />
          </View>
          <View style={{ marginTop: 12 }}>
            <ScrubColumns
              values={d.weekly.weeks.map((w) => w.users)}
              accent={d.weekly.weeks.length - 1}
              say={(i) => (i === null ? "App users a week. Scrub for a week." : `${short(d.weekly!.weeks[i].start)} to ${short(d.weekly!.weeks[i].end)}: ${d.weekly!.weeks[i].users} rowers`)}
            />
          </View>
        </>
      ) : null}
      {d.signedOut ? row("Phones not signed in", fmtInt(d.signedOut), "Opened the app and never signed in, counted from this update.") : null}
      {head("Today", short(d.today))}
          {row("Rowers who opened the app", fmtInt(d.todayUsers))}
          {row("Times it was opened", fmtInt(d.todayOpens), "Each time it comes to the front, a minute apart at least.")}
        </>
      )}

      {head("The last 14 days", d.since ? `Counted from ${short(d.since)}` : "Counts from today")}
      <View style={{ marginTop: 12 }}>
        <ScrubColumns
          values={d.days.map((x) => x.users)}
          accent={d.days.length - 1}
          say={(i) => (i === null ? "Rowers in the app, a day. Scrub for a day." : `${short(d.days[i].day)}: ${d.days[i].users} rowers, opened ${d.days[i].opens} times`)}
        />
      </View>

      {head("Android testers", `${a.have} of ${a.goal}`)}
      {row("On the closed test list", `${a.have}`, "Google needs 12 for 14 days.")}
      {row("Have the app on an Android", `${a.testers.filter((t) => t.onApp).length}`, `Signed in on an Android phone. ${a.installs} Android accounts in all.`)}
      {a.testers.map((t, i) => (
        <View key={`${t.name}${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.ink }}>{t.name}</Text>
          <Text style={mono(10, true, t.onApp ? C.accent : C.gray, 0.08)}>{t.onApp ? "✓ On the app" : t.sent ? "Invited" : "Not invited"}</Text>
        </View>
      ))}

      {/* RANKED BY USE (owner, 2026-11-26: "rank each user for how much
          they're using the app ... who are the super users ... I should
          reach out for example, for inputs, or I should maybe deliver
          features first to"). */}
      {head("Who, by use", `${d.people.filter((p) => p.power).length} power · ${d.people.length} in all`)}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 6, lineHeight: 15 }]}>
        {`Ranked by the days they used the app in the last 28, then by uses: each open, like, comment, follow, row logged on the app or recording. A power user has ${d.powerUses ?? 15} or more uses in 28 days.`}
      </Text>
      {d.people.map((p, i) => (
        <View key={`${p.name}${i}`} style={{ paddingVertical: 9, borderBottomWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10 }}>
            <Text style={{ width: 24, fontFamily: F.monoBold, fontSize: 13, color: p.power ? C.accent : C.gray }}>{i + 1}</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.ink }}>
              {p.rowerNumber != null ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{`${String(p.rowerNumber).padStart(3, "0")} · `}</Text> : null}
              {p.name}
            </Text>
            <Text style={mono(10, true, C.ink, 0.06)}>{p.platforms.map((x) => PLAT[x] ?? x).join(" · ")}</Text>
          </View>
          <Text style={[mono(9.5, false, C.gray, 0.06), { marginTop: 3 }]}>
            {`${p.power ? "POWER · " : ""}${p.days28 ?? 0} day${p.days28 === 1 ? "" : "s"}, ${(p.opens28 ?? 0) + (p.acts28 ?? 0)} uses in 28 · since ${short(p.firstDay)} · last ${short(p.lastDay)}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
