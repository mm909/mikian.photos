import { Text, View } from "react-native";
import { api } from "../api";
import { mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Waiting, useLoad } from "../ui";

/* THE OWNER'S ANALYTICS, in one place in settings (owner, 2026-11-26: "we
 * can probably group all these into a settings tab ... analytics ... all
 * those back-end analytics that are designed for me"): the app's use, M2D,
 * what it costs to run, and who stays. This file holds the last two; the
 * site computes them (api/row100k/app/analytics). */
const PATH = "/api/row100k/app/analytics";
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const monthWord = (k: string) => new Date(`${k}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

function head(s: string, aside?: string) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 30, paddingBottom: 6, borderBottomWidth: 2, borderColor: C.ink }}>
      <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase" }}>{s}</Text>
      {aside ? <Text style={mono(9.5, false, C.gray, 0.08)}>{aside}</Text> : null}
    </View>
  );
}
function row(k: string, v: string, sub?: string, key?: string) {
  return (
    <View key={key ?? k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10 }}>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
        <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{v}</Text>
      </View>
      {sub ? <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 3, lineHeight: 15 }]}>{sub}</Text> : null}
    </View>
  );
}
const big = (n: string, label: string, sub: string) => (
  <>
    <Text style={[mono(10, true, C.ink, 0.12), { marginTop: 8 }]}>{label}</Text>
    <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 6 }}>{n}</Text>
    <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4, lineHeight: 16 }]}>{sub}</Text>
  </>
);

/* WHAT IT COSTS (owner: "our monthly cost to run the app, with all the
 * different services ... and what they're for ... my burn rate"). */
type Line = { name: string; what: string; group: string; monthly: number | null; billed: string; how: "receipt" | "price" | "free" | "unknown"; note?: string };
type Costs = { lines: Line[]; oneTime: { name: string; amount: number; when: string }[]; monthly: number; running: number; building: number; unknown: number };
const HOW: Record<Line["how"], string> = { receipt: "from a receipt", price: "the published price", free: "free plan", unknown: "no bill found" };
export function CostsPage() {
  const { data, error, reload } = useLoad(() => api<Costs>(`${PATH}?k=costs`), [], `${PATH}?k=costs`);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const groups = [...new Set(data.lines.map((l) => l.group))];
  return (
    <View>
      {big(usd(data.monthly), "A month, known so far", `${usd(data.running)} to run the app and be in the stores · ${usd(data.building)} to build it.${data.unknown ? ` ${data.unknown} services have no bill in your inbox yet, so the real figure is higher.` : ""}`)}
      {groups.map((g) => (
        <View key={g}>
          {head(g, usd(data.lines.filter((l) => l.group === g).reduce((a, l) => a + (l.monthly ?? 0), 0)) + " a month")}
          {data.lines
            .filter((l) => l.group === g)
            .map((l) => row(l.name, l.monthly == null ? "?" : l.monthly === 0 ? "$0" : usd(l.monthly), `${l.what} ${l.billed[0].toUpperCase()}${l.billed.slice(1)}, ${HOW[l.how]}.${l.note ? ` ${l.note}` : ""}`))}
        </View>
      ))}
      {data.oneTime.length ? (
        <>
          {head("Paid once", "not in the month")}
          {data.oneTime.map((o) => row(o.name, usd(o.amount), o.when))}
        </>
      ) : null}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 12, lineHeight: 15 }]}>
        Read from your Gmail on Nov 26. A bill sent to another inbox is not here: send me the amount and it goes in.
      </Text>
    </View>
  );
}

/* WHO STAYS (owner: "how many people sign up and never row again ...
 * what's your churn probability after row number 3?"). */
type Churn = {
  signedUp: number;
  neverRowed: number;
  afterRow: { n: number; rowers: number; judged: number; went: number }[];
  months: { key: string; rowers: number; next: number | null }[];
  byEffort: { from: string; to: string; bands: { label: string; rowers: number; stayed: number }[] } | null;
};
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
export function ChurnPage() {
  const { data, error, reload } = useLoad(() => api<Churn>(`${PATH}?k=churn`), [], `${PATH}?k=churn`);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const d = data;
  return (
    <View>
      {big(pct(d.neverRowed, d.signedUp), "Signed up and never rowed", `${d.neverRowed} of the ${d.signedUp} who signed up. None of yours counted.`)}
      {head("Another row after row N", "within a month")}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 6, lineHeight: 15 }]}>Of the rowers whose Nth row is two weeks old or more, how many logged one more.</Text>
      {d.afterRow.filter((r) => r.judged > 0).map((r) => row(`After row ${r.n}`, pct(r.went, r.judged), `${r.went} of ${r.judged}`, `n${r.n}`))}
      {head("Month to month", "rowed the month after")}
      {d.months.map((m) => row(monthWord(m.key), m.next == null ? `${m.rowers} rowers` : pct(m.next, m.rowers), m.next == null ? "This month: the next has not come." : `${m.next} of ${m.rowers} rowers rowed the month after`, m.key))}
      {d.byEffort ? (
        <>
          {head(`${monthWord(d.byEffort.from)} rows`, `rowed in ${monthWord(d.byEffort.to)}`)}
          {d.byEffort.bands.map((b) => row(`${b.label} rows`, pct(b.stayed, b.rowers), `${b.stayed} of ${fmtInt(b.rowers)} rowers`, b.label))}
        </>
      ) : null}
    </View>
  );
}
