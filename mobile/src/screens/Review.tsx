import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { analyseSession, comparableRows, fmtGap, fmtSplit, type AnalysisForce, type AnalysisSplit, type ErgAnalysis } from "../pm5/analysis";
import type { TelemetryDoc } from "../pm5/session";
import { asSaved, loadDoc, type Row } from "../store";
import { C, F, fmtInt } from "../theme";
import { Btn, Card, Eyebrow, Num, Pop, styles } from "../ui";

/* THE READ (owner, 2026-11-14, of the website's saved-session screen: "this
 * needs to be a focus of the app ... make it really good").
 *
 * One finished piece, read back in the order a rower reads one: the time,
 * big; then the read in plain English; then the numbers behind the
 * sentences; then the pictures (splits, the average stroke, how the piece
 * moved); then how steady it was; then what to do next.
 *
 * Every figure and every sentence comes out of analyseSession, the same
 * function the website runs (src/pm5/analysis.ts is a copy of the site's),
 * fed the document this phone recorded. It ranks the piece against the
 * other recorded pieces on this phone at the same distance, and lays the
 * best of them behind the force curve. */

const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? fmtInt(v) : "--");
const n1 = (v: number | null | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "--");

export function Review({ row, rows, banked, onDone, onDelete }: { row: Row; rows: Row[]; banked: boolean; onDone: () => void; onDelete: () => void }) {
  const [state, setState] = useState<{ doc: TelemetryDoc; compare: { title: string; doc: TelemetryDoc } | null } | "missing" | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const doc = await loadDoc(row.id);
      if (!live) return;
      if (!doc) return setState("missing");
      const history = rows.filter((r) => r.hasDoc).map(asSaved);
      const best = comparableRows(doc, history, row.id)[0];
      const other = best ? await loadDoc(best.id) : null;
      if (live) setState({ doc, compare: best && other ? { title: best.title, doc: other } : null });
    })();
    return () => {
      live = false;
    };
  }, [row.id, rows]);

  const a = useMemo<ErgAnalysis | null>(() => {
    if (!state || state === "missing") return null;
    try {
      return analyseSession({ doc: state.doc, id: row.id, history: rows.filter((r) => r.hasDoc).map(asSaved), compare: state.compare });
    } catch {
      return null;
    }
  }, [state, row.id, rows]);

  if (state === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={C.ink} />
      </View>
    );
  }
  if (!a) {
    return (
      <View style={{ padding: 18 }}>
        <Text style={styles.mid}>{fmtInt(row.meters)} m</Text>
        <Text style={[styles.body, { marginVertical: 12 }]}>This row has no recording behind it, so there is nothing to read. Rows banked from a connected erg get the full read.</Text>
        <Btn label="Back" onPress={onDone} />
      </View>
    );
  }

  const dr = a.driveRecovery;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {banked ? (
        <Pop>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.accent, marginBottom: 10 }}>ROW BANKED · +{fmtInt(row.meters)} M</Text>
        </Pop>
      ) : null}

      <Eyebrow>
        {row.day} · {a.device}
        {a.simulated ? " · demo" : ""}
      </Eyebrow>
      <Num size={84} color={C.accent}>
        {a.clock}
      </Num>
      <View style={[styles.row, { gap: 22, marginBottom: 16 }]}>
        <View>
          <Eyebrow>Distance</Eyebrow>
          <Text style={styles.mid}>{fmtInt(a.meters)} m</Text>
        </View>
        <View>
          <Eyebrow>Average split</Eyebrow>
          <Text style={styles.mid}>{fmtSplit(a.avgPaceTenths)}</Text>
        </View>
      </View>

      {/* THE READ: the point of the screen. */}
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.ink, padding: 18, marginBottom: 8 }}>
        <Eyebrow style={{ marginBottom: 8 }}>The read</Eyebrow>
        {a.read.map((line, i) => (
          <Text key={i} style={{ color: C.ink, fontSize: i === 0 ? 20 : 17, lineHeight: i === 0 ? 27 : 25, fontFamily: i === 0 ? F.black : F.sans, marginBottom: i < a.read.length - 1 ? 10 : 0 }}>
            {line}
          </Text>
        ))}
      </View>

      <Section title="The numbers">
        <Grid>
          <Cell k="Average split" v={fmtSplit(a.avgPaceTenths)} u="per 500 m" />
          <Cell k="Rate" v={n1(a.avgSpm, 0)} u="strokes a minute" />
          <Cell k="Metres a stroke" v={n1(a.metresPerStroke, 2)} u="distance per stroke" />
          <Cell k="Watts" v={n0(a.avgWatts)} u="average power" />
          <Cell k="Work a stroke" v={n0(a.workPerStrokeJ)} u="joules" />
          <Cell k="Drive : recovery" v={dr ? `1 : ${dr.ratio.toFixed(1)}` : "--"} u={dr ? `${dr.driveS.toFixed(2)} s drive` : "no stroke data"} />
        </Grid>
      </Section>

      <Section title="Splits" note={a.splitsDerived ? "cut from the recording" : "as the monitor recorded them"}>
        {a.splits.length ? <SplitBars splits={a.splits} fastest={a.fastestSplit} slowest={a.slowestSplit} avg={a.avgSplitTenths} /> : <Text style={styles.body}>Too short a piece to cut into splits.</Text>}
      </Section>

      <Section title="Your stroke" note={a.force ? `average of ${fmtInt(a.force.curves)} strokes` : undefined}>
        {a.force ? (
          <>
            <ForceChart force={a.force} compare={a.compare?.force ?? null} />
            <Text style={[styles.body, { marginTop: 8 }]}>
              Peak {Math.round(a.force.peakLbf)} lbf, {Math.round(a.force.peakPct)}% of the way through the drive.
              {a.compare ? ` The thin line is your best at this distance (${a.compare.title}).` : ""}
            </Text>
          </>
        ) : (
          <Text style={styles.body}>This monitor sent no force curves.</Text>
        )}
      </Section>

      <Section title="Through the piece" note="stroke by stroke">
        <Trace label="Split" values={a.series.filter((s) => s.counted).map((s) => s.paceTenths)} fmt={(v) => fmtSplit(Math.round(v))} invert />
        <Trace label="Rate" values={a.series.filter((s) => s.counted).map((s) => s.spm)} fmt={(v) => `${v.toFixed(0)} s/m`} />
        <Trace label="Work a stroke" values={a.series.filter((s) => s.counted).map((s) => s.workJ)} fmt={(v) => `${v.toFixed(0)} J`} />
      </Section>

      <Section title="How steady">
        <Grid>
          <Cell k="Split spread" v={a.steady.paceSdTenths === null ? "--" : `± ${fmtGap(a.steady.paceSdTenths)}`} u={a.steady.paceMeanTenths === null ? "too few strokes" : `around ${fmtSplit(Math.round(a.steady.paceMeanTenths))}`} />
          <Cell k="Work spread" v={a.steady.workSdJ === null ? "--" : `± ${a.steady.workSdJ.toFixed(1)}`} u={a.steady.workMeanJ === null ? "joules a stroke" : `joules around ${a.steady.workMeanJ.toFixed(0)}`} />
          <Cell k="Strokes to settle" v={a.steady.settle === null ? "--" : String(a.steady.settle.count)} u={a.steady.settle === null ? "never inside the band" : `settled at stroke ${a.steady.settle.strokeN}`} />
          <Cell k="Drive length" v={a.steady.avgDriveLengthCm === null ? "--" : `${(a.steady.avgDriveLengthCm / 100).toFixed(2)} m`} u="average drive" />
        </Grid>
      </Section>

      {a.next.length ? (
        <View style={{ borderTopWidth: 2, borderColor: C.ink, paddingVertical: 18 }}>
          <Eyebrow style={{ color: C.ink, marginBottom: 8 }}>What next</Eyebrow>
          {a.next.map((line, i) => (
            <Text key={i} style={{ fontSize: 16, lineHeight: 23, color: C.ink, marginBottom: i < a.next.length - 1 ? 8 : 0 }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={[styles.body, { fontSize: 13, color: C.gray, marginBottom: 14 }]}>
        {fmtInt(a.strokes)} strokes · drag {n0(a.dragFactor)} · {a.recordedVia}
      </Text>
      <Btn label={banked ? "See today" : "Done"} onPress={onDone} />
      <Btn label="Delete this row" quiet onPress={onDelete} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card>
      <View style={[styles.row, { justifyContent: "space-between", marginBottom: 12 }]}>
        <Text style={{ fontSize: 12, fontFamily: F.monoBold, letterSpacing: 2.2, color: C.ink }}>{title.toUpperCase()}</Text>
        {note ? <Text style={{ fontSize: 11, color: C.gray }}>{note}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6, marginBottom: -12 }}>{children}</View>;
}

function Cell({ k, v, u }: { k: string; v: string; u: string }) {
  return (
    <View style={{ width: "50%", paddingHorizontal: 6, marginBottom: 12 }}>
      <Eyebrow>{k}</Eyebrow>
      <Num size={26}>{v}</Num>
      <Text style={{ fontSize: 12, color: C.gray }}>{u}</Text>
    </View>
  );
}

/* One column a split, rising as the screen opens. Faster is taller; the
 * fastest is green, the slowest the brown, and the dashed rule is the
 * average of them. */
function SplitBars({ splits, fastest, slowest, avg }: { splits: AnalysisSplit[]; fastest: AnalysisSplit | null; slowest: AnalysisSplit | null; avg: number | null }) {
  const paces = splits.map((s) => s.paceTenths).filter((p): p is number => p !== null);
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);
  const pad = Math.max(10, (hi - lo) * 0.6);
  const H = 130;
  /* 0.25 for the slowest the scale allows, 1 for the fastest. */
  const frac = (p: number | null) => (p === null ? 0 : 0.25 + 0.75 * (1 - (p - (lo - pad * 0.2)) / Math.max(1, hi + pad - (lo - pad * 0.2))));
  const wide = splits.length > 8;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: H + 44 }}>
      {avg !== null ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 44 + frac(avg) * H, borderTopWidth: 1, borderStyle: "dashed", borderColor: C.gray }} /> : null}
      {splits.map((s, i) => (
        <View key={`${s.n}-${s.endMeters}`} style={{ flex: wide ? undefined : 1, width: wide ? 46 : undefined, alignItems: "center", paddingHorizontal: 3 }}>
          <Rise frac={frac(s.paceTenths)} height={H} delay={i * 60} color={s === fastest ? C.good : s === slowest ? C.accentLight : C.ink} />
          <Text style={{ fontSize: 11, fontFamily: F.bold, color: C.ink, marginTop: 5, fontVariant: ["tabular-nums"] }}>{fmtSplit(s.paceTenths)}</Text>
          <Text style={{ fontSize: 10, color: C.gray }}>{s.endMeters >= 1000 ? `${(s.endMeters / 1000).toFixed(1)}k` : s.endMeters}</Text>
        </View>
      ))}
    </View>
  );
  return wide ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {body}
    </ScrollView>
  ) : (
    body
  );
}

function Rise({ frac, height, delay, color }: { frac: number; height: number; delay: number; color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: frac, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, frac, delay]);
  return (
    <View style={{ height, width: "100%", justifyContent: "flex-end" }}>
      <Animated.View style={{ backgroundColor: color, height: a.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }} />
    </View>
  );
}

/* A smooth path through points. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/* The average stroke of the piece, filled, with the best comparable piece
 * as a thin line behind it and a dot on the peak. */
function ForceChart({ force, compare }: { force: AnalysisForce; compare: AnalysisForce | null }) {
  const W = 320;
  const H = 150;
  const top = Math.max(force.peakLbf, compare?.peakLbf ?? 0, 1) * 1.1;
  const map = (points: number[]): [number, number][] => points.map((p, i) => [(i / Math.max(1, points.length - 1)) * W, H - (Math.max(0, p) / top) * H]);
  const mine = map(force.points);
  const line = smooth(mine);
  const peak = mine[force.peakIndex] ?? mine[0];
  return (
    <Svg width="100%" height={H + 6} viewBox={`0 -4 ${W} ${H + 8}`} preserveAspectRatio="none">
      <Path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={C.pale} />
      {compare ? <Path d={smooth(map(compare.points))} stroke={C.gray} strokeWidth={1.5} strokeDasharray="5 4" fill="none" /> : null}
      <Path d={line} stroke={C.accent} strokeWidth={3.5} fill="none" strokeLinejoin="round" />
      <Line x1={0} y1={H} x2={W} y2={H} stroke={C.ink} strokeWidth={2} />
      <Circle cx={peak[0]} cy={peak[1]} r={5} fill={C.ink} />
    </Svg>
  );
}

/* One measure across the piece: a thin line, its first and last readings. */
function Trace({ label, values, fmt, invert }: { label: string; values: (number | null)[]; fmt: (v: number) => string; invert?: boolean }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  if (pts.length < 4) return null;
  /* A rolling mean of nine strokes: the shape, not the wobble. */
  const sm = pts.map((p, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - 4); j <= Math.min(pts.length - 1, i + 4); j++) {
      s += pts[j][1];
      n++;
    }
    return [p[0], s / n] as const;
  });
  const ys = sm.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const W = 320;
  const H = 54;
  const span = Math.max(1e-6, hi - lo);
  const last = sm[sm.length - 1][0] || 1;
  const xy: [number, number][] = sm.map(([i, v]) => {
    const f = (v - lo) / span;
    return [(i / last) * W, 4 + (invert ? f : 1 - f) * (H - 8)];
  });
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Eyebrow>{label}</Eyebrow>
        <Text style={{ fontSize: 12, color: C.soft, fontVariant: ["tabular-nums"] }}>
          {fmt(ys[0])} to {fmt(ys[ys.length - 1])}
        </Text>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Path d={smooth(xy)} stroke={C.ink} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
