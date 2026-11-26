import { type ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { ticks, type Pad, type XY } from "../erg/reviewGeom";
import { medianOf, quantile } from "../pm5/craft";
import { mono } from "../site";
import { C, F } from "../theme";

/* WHAT EVERY CHART ON A ROW'S ANALYTICS IS MADE OF: the card a picture sits
 * in, a word inside a chart, the grid and axes, a line beside its name.
 * Lifted out of Review.tsx on 2026-11-22 so the cards that compare a row
 * against everyone (Field.tsx) are drawn with the same pieces. */

export const PAD: Pad = { l: 40, r: 8, t: 16, b: 28 };

/* A word or a number inside a chart: Space Mono, small, grey unless told. */
export function Lab({ x, y, anchor = "start", size = 9, color, bold, children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; size?: number; color?: string; bold?: boolean; children: string }) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fontSize={size} fontFamily={bold ? F.monoBold : F.mono} fill={color ?? C.gray}>
      {children}
    </SvgText>
  );
}

/* The grid, the labels down the left and the two axes. */
export function Axes({ W, H, pad, ys, sy, fmt }: { W: number; H: number; pad: Pad; ys: number[]; sy: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <G>
      {ys.map((v) => (
        <G key={v}>
          <Line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={C.line} strokeWidth={1} opacity={0.55} />
          <Lab x={pad.l - 5} y={sy(v) + 3} anchor="end">
            {fmt(v)}
          </Lab>
        </G>
      ))}
      <Line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke={C.line} strokeWidth={1} />
      <Line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={C.ink} strokeWidth={1.5} />
    </G>
  );
}

export const pathOf = (pts: XY[], sx: (x: number) => number, sy: (y: number) => number) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

/* A line beside its name, as it is drawn in the chart. */
export function Key({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Svg width={22} height={8}>
        <Line x1={0} x2={22} y1={4} y2={4} stroke={color} strokeWidth={dashed ? 1.8 : 2.4} strokeDasharray={dashed ? "5 4" : undefined} />
      </Svg>
      <Text style={mono(10, false, C.gray, 0.1)}>{label}</Text>
    </View>
  );
}

/* A CHART IS A CARD (owner, 2026-11-21: "should we make the profile page a
 * little less flat and box these charts up a little bit? ... give them a
 * little bit more formal section ... a more formal title"; and "is there
 * anything useful we can say ... below these charts?"). Its name in the
 * head's own face, a quiet word at the right, the picture, and under it ONE
 * thing the picture says, worked out from the same numbers and never made
 * up: a chart with nothing to say says nothing. `foot` is a last line under
 * all of it (the way to a card's questions), held to the bottom of a card
 * that is stretched to its neighbour's height. */
export const BOX_PAD = 14;
export function Box({ title, note, say, fill, foot, children }: { title: string; note?: ReactNode; say?: string | null; /* Takes the height it is given: one of two cards side by side. */ fill?: boolean; foot?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderCurve: "continuous", borderRadius: 8, padding: BOX_PAD, marginTop: 14, flex: fill ? 1 : undefined }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 10, rowGap: 2, marginBottom: 10 }}>
        <Text style={{ fontFamily: F.black, fontSize: 18, lineHeight: 22, color: C.ink }}>{title}</Text>
        {typeof note === "string" ? <Text style={mono(10, false, C.gray, 0.1)}>{note}</Text> : (note ?? null)}
      </View>
      {children}
      {say ? (
        <View style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 10, marginTop: 12 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.soft }}>{say}</Text>
        </View>
      ) : null}
      {foot ? (
        <>
          {fill ? <View style={{ flex: 1 }} /> : null}
          {foot}
        </>
      ) : null}
    </View>
  );
}

/* ---- one figure, every rower, as a curve -------------------------------- */

/* EVERYONE AS A CURVE, AND WHERE THIS ROW LIES ON IT (owner, 2026-11-23:
 * "if we're going to show this sort of like you against everyone on a line
 * chart, the line chart's probably not the way to go. It's definitely like
 * a KDE ... when it says ... steady pace, everyone's at 70 and I'm at 82.
 * Show me the KDE where I lie. Show me the distribution"; and of work per
 * stroke, "joules per stroke 441 and everyone else is 446. Is that a big
 * difference? Is that a little difference? A KDE will help me there").
 *
 * The density of every rower's figure (one a rower, `vals`), drawn as the
 * stats tab draws the field (charts.tsx Density): the grey filled curve on
 * the ink rule, a tick a rower under it. The rower in the middle is the
 * dashed grey line; this row is the blue line with YOU and its figure over
 * it. Where one way is better, the part of the field this row beats is
 * washed in the blue (`beats`: "low" fills to the right of the row, "high"
 * to the left). `stand` is the one plain line under it, worked out by the
 * caller ("Steadier than 74% of rowers"), and `word` the way that is
 * better, at the right of the name. It does not scrub: a drag across it
 * turns the card it sits on. */
function kdeOf(sorted: number[], lo: number, hi: number, h: number): { xs: number[]; ys: number[] } {
  const N = 96;
  const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
  const ys = xs.map((x) => {
    let sum = 0;
    for (const v of sorted) sum += Math.exp(-0.5 * ((x - v) / h) ** 2);
    return sum;
  });
  const top = Math.max(...ys);
  return { xs, ys: top > 0 ? ys.map((y) => y / top) : ys };
}

/* Silverman's bandwidth, widened for a small field and never narrower than
 * a sixtieth of the span, as charts.tsx draws a rower's own curve. */
function bandwidth(sorted: number[], span: number): number {
  const n = sorted.length;
  const floor = span / 60;
  if (n < 2) return Math.max(span / 8, floor);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd;
  if (!(spread > 0)) return Math.max(span / 8, floor);
  return Math.max(0.9 * spread * Math.pow(n, -0.2) * Math.max(1, Math.sqrt(12 / n)), floor);
}

export function FieldDensity({ name, word, vals, mine, fmt, tick, beats, stand, w, height = 170 }: { name: string; word: string; vals: number[]; mine: number; fmt: (v: number) => string; tick?: (v: number) => string; beats?: "low" | "high" | null; stand: string; w: number; height?: number }) {
  const sorted = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length || w < 80 || !Number.isFinite(mine)) return null;
  const a = Math.min(sorted[0], mine);
  const b = Math.max(sorted[sorted.length - 1], mine);
  let span = b - a;
  if (!(span > 1e-9)) span = Math.max(Math.abs(a) * 0.1, 1);
  const h = bandwidth(sorted, span);
  /* Room for the curve's tails, but not so much that the field is a spike. */
  const air = Math.max(span * 0.06, Math.min(h * 2.5, span * 0.35));
  const lo = a - air;
  const hi = b + air;
  const curve = kdeOf(sorted, lo, hi, h);

  const H = height;
  const edge = 4;
  const top = 34;
  const base = H - 14;
  const sx = (v: number) => edge + ((v - lo) / (hi - lo)) * (w - 2 * edge);
  const sy = (y: number) => base - y * (base - top);
  const heightAt = (x: number) => {
    const t = ((x - lo) / (hi - lo)) * (curve.xs.length - 1);
    const i = Math.max(0, Math.min(curve.xs.length - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i));
    return curve.ys[i] + (curve.ys[i + 1] - curve.ys[i]) * f;
  };
  const pts = curve.xs.map((x, i) => `${sx(x).toFixed(1)} ${sy(curve.ys[i]).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const fill = `M${sx(lo).toFixed(1)} ${base} L${pts.join(" L")} L${sx(hi).toFixed(1)} ${base} Z`;
  /* The part of the field this row beats, its edge at the row. */
  let won: string | null = null;
  if (beats) {
    const inside = curve.xs.map((x, i) => ({ x, y: curve.ys[i] })).filter((p) => (beats === "low" ? p.x > mine : p.x < mine));
    const at = { x: mine, y: heightAt(mine) };
    const run = beats === "low" ? [at, ...inside] : [...inside, at];
    if (run.length >= 2) won = `M${sx(run[0].x).toFixed(1)} ${base} ${run.map((p) => `L${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ")} L${sx(run[run.length - 1].x).toFixed(1)} ${base} Z`;
  }
  const mid = medianOf(sorted);
  const xm = sx(mid);
  const xy = sx(mine);
  const side = (x: number): "start" | "middle" | "end" => (x < w * 0.3 ? "start" : x > w * 0.7 ? "end" : "middle");
  /* The middle's name sits on the side away from the row, where it fits. */
  const midText = `MIDDLE ${fmt(mid)}`.toUpperCase();
  const midW = midText.length * 5.6;
  const midAnchor: "start" | "end" = xm <= xy ? (xm - midW > 0 ? "end" : "start") : xm + midW < w ? "start" : "end";
  const midX = midAnchor === "end" ? xm - 4 : xm + 4;
  const tf = tick ?? fmt;
  const marks = ticks(lo, hi, 4).filter((v) => v >= lo && v <= hi);
  return (
    <View style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 10 }}>
        <Text style={mono(10, true, C.ink, 0.12)}>{name}</Text>
        <Text style={mono(9, false, C.gray, 0.1)}>{word}</Text>
      </View>
      <Svg width={w} height={H + 16} accessibilityLabel={`${name}. ${stand}`}>
        {won ? <Path d={won} fill={C.accent} opacity={0.16} /> : null}
        <Path d={fill} fill={C.line} opacity={0.55} />
        <Path d={line} stroke={C.soft} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
        <Line x1={0} x2={w} y1={base} y2={base} stroke={C.ink} strokeWidth={2} />
        {sorted.map((v, i) => (
          <Line key={i} x1={sx(v)} x2={sx(v)} y1={base + 3} y2={base + 11} stroke={C.soft} strokeWidth={1} opacity={0.45} />
        ))}
        <Line x1={xm} x2={xm} y1={Math.min(sy(heightAt(mid)), base - 8)} y2={base} stroke={C.gray} strokeWidth={1.2} strokeDasharray="3 3" />
        <Lab x={midX} y={26} anchor={midAnchor} color={C.soft}>
          {midText}
        </Lab>
        <Line x1={xy} x2={xy} y1={15} y2={base} stroke={C.accent} strokeWidth={2.5} />
        <Circle cx={xy} cy={sy(heightAt(mine))} r={4} fill={C.accent} />
        <Lab x={xy} y={10} anchor={side(xy)} color={C.accent} bold>
          {`YOU ${fmt(mine)}`.toUpperCase()}
        </Lab>
        {marks.map((v) => (
          <Lab key={v} x={sx(v)} y={H + 12} anchor={sx(v) < 16 ? "start" : sx(v) > w - 16 ? "end" : "middle"}>
            {tf(v)}
          </Lab>
        ))}
      </Svg>
      <Text style={{ fontFamily: F.black, fontSize: 17, lineHeight: 22, color: C.ink, marginTop: 6 }}>{stand}</Text>
    </View>
  );
}
