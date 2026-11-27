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
type Person = { name: string; rowerNumber: number | null; platforms: string[]; firstDay: string; lastDay: string; days: number; opens: number };
type Versus = { key: string; label: string; today: number; avgDay: number | null; week: number; avgWeek: number | null };
type Usage = {
  today: string;
  versus?: Versus[];
  since: string | null;
  accounts: number;
  byPlatform: { ios: number; android: number; web: number; phone?: number };
  meterShare?: { today: number | null; week: number | null; prior4: number | null };
  todayUsers: number;
  todayOpens: number;
  days: { day: string; users: number; opens: number }[];
  people: Person[];
  android: { have: number; goal: number; testers: { name: string; sent: boolean; onApp: boolean }[]; installs: number };
};
const PATH = "/api/row100k/app/usage";
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
          {head("Last 7 days", "vs a 4-week average week")}
          {d.versus.map((v) => vs(v.label, v.week, v.avgWeek))}
          <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>
            {`The app's opens are counted from ${d.since ? short(d.since) : "today"}, so their average is over the days there are. Rows, likes and comments go back as far as they need.`}
          </Text>
        </>
      ) : (
        <>
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

      {head("Who", `${d.people.length}`)}
      {d.people.map((p, i) => (
        <View key={`${p.name}${i}`} style={{ paddingVertical: 9, borderBottomWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.ink }}>
              {p.rowerNumber != null ? <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{`${String(p.rowerNumber).padStart(3, "0")} · `}</Text> : null}
              {p.name}
            </Text>
            <Text style={mono(10, true, C.ink, 0.06)}>{p.platforms.map((x) => PLAT[x] ?? x).join(" · ")}</Text>
          </View>
          <Text style={[mono(9.5, false, C.gray, 0.06), { marginTop: 3 }]}>
            {`Since ${short(p.firstDay)} · last ${short(p.lastDay)}${p.days ? ` · ${p.days} day${p.days === 1 ? "" : "s"}, opened ${p.opens}` : ""}`}
          </Text>
        </View>
      ))}
    </View>
  );
}
