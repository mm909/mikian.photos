import { useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { Kde, KdeYou } from "./api";
import { C, F } from "./theme";

/* THE CHARTS, drawn from what the site's own stats and profile compute
 * (stats/field.ts, stats/distances.ts, the profile's pace points). The
 * server sends the curves; these only draw them, in the site's manner: the
 * field as a pale ground, the rower in the blue, ink for the axis, mono
 * capitals for the words. No colour carries meaning on its own: every mark
 * is named in a line under the chart. */

/* The width a chart has, measured, so SVG coordinates are real points. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

const small = { fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.gray } as const;

function area(xs: number[], ys: number[], sx: (x: number) => number, sy: (y: number) => number, base: number): { line: string; fill: string } {
  let line = "";
  for (let i = 0; i < xs.length; i++) line += `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
  return { line, fill: `${line}L${sx(xs[xs.length - 1]).toFixed(1)} ${base}L${sx(xs[0]).toFixed(1)} ${base}Z` };
}

/* A DENSITY: where the field's rows fall along one measure (length, pace,
 * a 5k time), with one rower's own rows as ticks under it and their middle
 * as a blue line. */
export function Density({ kde, you, fmt, height = 120 }: { kde: Kde; you?: KdeYou | null; fmt: (x: number) => string; height?: number }) {
  const [w, onLayout] = useWidth();
  const H = height;
  const rugH = you ? 10 : 0;
  const top = 6;
  const base = H - rugH - 4;
  const yMax = Math.max(1e-9, ...kde.ys, ...(you?.ys ?? []));
  const sx = (x: number) => ((x - kde.xMin) / (kde.xMax - kde.xMin || 1)) * w;
  const sy = (y: number) => base - (y / yMax) * (base - top);
  const inside = (x: number) => x >= kde.xMin && x <= kde.xMax;
  const f = w ? area(kde.xs, kde.ys, sx, sy, base) : null;
  const y = w && you?.ys ? area(kde.xs, you.ys, sx, sy, base) : null;
  return (
    <View onLayout={onLayout}>
      {w ? (
        <Svg width={w} height={H}>
          {f ? <Path d={f.fill} fill={C.line} opacity={0.55} /> : null}
          {f ? <Path d={f.line} stroke={C.soft} strokeWidth={1.5} fill="none" /> : null}
          {y ? <Path d={y.line} stroke={C.accent} strokeWidth={2.5} fill="none" /> : null}
          <Line x1={0} y1={base} x2={w} y2={base} stroke={C.ink} strokeWidth={2} />
          {you ? you.rug.filter(inside).map((x, i) => <Line key={i} x1={sx(x)} y1={base + 3} x2={sx(x)} y2={base + 3 + rugH} stroke={C.accent} strokeWidth={1.5} opacity={0.7} />) : null}
          {you && inside(you.median) ? <Line x1={sx(you.median)} y1={top} x2={sx(you.median)} y2={base} stroke={C.accent} strokeWidth={2.5} /> : null}
          {you && inside(you.best) ? <Circle cx={sx(you.best)} cy={base} r={4.5} fill={C.ink} /> : null}
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={{ height: 16 }}>
        {w
          ? kde.ticks.filter((_, i) => i % Math.ceil(kde.ticks.length / 5) === 0).map((t, i, shownTicks) => (
              <Text key={t} style={[small, { position: "absolute", left: i === shownTicks.length - 1 && sx(t) > w - 30 ? undefined : Math.max(0, sx(t) - (i === 0 ? 0 : 14)), right: i === shownTicks.length - 1 && sx(t) > w - 30 ? 0 : undefined, top: 2 }]}>
                {fmt(t)}
              </Text>
            ))
          : null}
      </View>
      {you ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, marginTop: 6 }}>
          <Text style={[small, { color: C.accent, fontFamily: F.monoBold }]}>│ {you.tag}</Text>
          <Text style={[small, { color: C.ink, fontFamily: F.monoBold }]}>● {you.bestTag}</Text>
          <Text style={small}>▒ EVERYONE</Text>
        </View>
      ) : null}
    </View>
  );
}

/* THE PACE: the running average split against the metres rowed so far (the
 * line), and each row's own split at the same place (the dots). Faster is
 * up, as the site draws it. */
export function PaceLine({ curve, dots, fmt, height = 150 }: { curve: { m: number; s: number }[]; dots: { m: number; s: number }[]; fmt: (s: number) => string; height?: number }) {
  const [w, onLayout] = useWidth();
  if (curve.length < 2) return null;
  const all = [...curve.map((p) => p.s), ...dots.map((p) => p.s)];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = Math.max(1, (hi - lo) * 0.12);
  const yMin = lo - pad;
  const yMax = hi + pad;
  const xMax = curve[curve.length - 1].m;
  const H = height;
  const sx = (m: number) => 6 + (m / xMax) * (w - 12);
  const sy = (s: number) => 6 + ((s - yMin) / (yMax - yMin)) * (H - 12);
  let d = "";
  curve.forEach((p, i) => (d += `${i ? "L" : "M"}${sx(p.m).toFixed(1)} ${sy(p.s).toFixed(1)}`));
  const last = curve[curve.length - 1];
  return (
    <View onLayout={onLayout}>
      {w ? (
        <Svg width={w} height={H}>
          <Line x1={0} y1={H - 1} x2={w} y2={H - 1} stroke={C.ink} strokeWidth={2} />
          {dots.map((p, i) => (
            <Circle key={i} cx={sx(p.m)} cy={sy(p.s)} r={3} fill={C.soft} opacity={0.45} />
          ))}
          <Path d={d} stroke={C.accent} strokeWidth={3} fill="none" strokeLinejoin="round" />
          <Circle cx={sx(last.m)} cy={sy(last.s)} r={5} fill={C.accent} />
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Text style={small}>FASTEST ROW {fmt(lo)}</Text>
        <Text style={small}>SLOWEST {fmt(hi)}</Text>
      </View>
      <View style={{ flexDirection: "row", columnGap: 14, marginTop: 4 }}>
        <Text style={[small, { color: C.accent, fontFamily: F.monoBold }]}>━ RUNNING AVERAGE {fmt(last.s)}</Text>
        <Text style={small}>● EACH ROW</Text>
      </View>
    </View>
  );
}

/* A MONTH AS A CALENDAR, the site's (Heatmap.tsx): a square a day in four
 * shades of the blue, the day's metres printed in it ("228k"), a day with
 * nothing a dashed empty square, and the scale named under it. `marks` are
 * the metre thresholds between the shades. */
const kilo = (m: number) => (m >= 1000 ? `${Math.round(m / 1000)}k` : `${m}`);
const SHADES = [0.32, 0.55, 0.78, 1];

export function MonthGrid({ month, byDay, today, marks }: { month: { key: string; firstDow: number; days: number }; byDay: Record<string, number>; today?: number; marks: [number, number, number] }) {
  const cells: (number | null)[] = [...Array.from({ length: month.firstDow }, () => null), ...Array.from({ length: month.days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shade = (m: number) => (m <= 0 ? -1 : m < marks[0] ? 0 : m < marks[1] ? 1 : m < marks[2] ? 2 : 3);
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {"SMTWTFS".split("").map((l, i) => (
          <Text key={i} style={[small, { flex: 1, textAlign: "center" }]}>
            {l}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 5, marginBottom: 5 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1.15 }} />;
            const m = byDay[`${month.key}-${String(d).padStart(2, "0")}`] ?? 0;
            const s = shade(m);
            const future = today !== undefined && d > today;
            return (
              <View key={i} accessibilityLabel={`${d}: ${m.toLocaleString("en-US")} metres`} style={{ flex: 1, aspectRatio: 1.15, alignItems: "center", justifyContent: "center", borderWidth: s < 0 ? 1 : 0, borderStyle: "dashed", borderColor: C.line, opacity: future ? 0.5 : 1 }}>
                {s >= 0 ? <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.accent, opacity: SHADES[s] }} /> : null}
                {s >= 0 ? <Text style={{ fontFamily: F.monoBold, fontSize: 11, color: s >= 2 ? "#fff" : C.ink }}>{kilo(m)}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
        <Text style={[small, { marginRight: 4 }]}>LESS</Text>
        <View style={{ width: 12, height: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.line }} />
        {SHADES.map((o) => (
          <View key={o} style={{ width: 12, height: 12, backgroundColor: C.accent, opacity: o }} />
        ))}
        <Text style={[small, { marginLeft: 4 }]}>MORE</Text>
      </View>
    </View>
  );
}

/* THE HOURS: one row a day, one cell an hour, darker the more rows landed
 * in it. Hours run from 3 a.m. so a late night stays on its own day. */
export function HourGrid({ grid, start = 3 }: { grid: number[][]; start?: number }) {
  const [w, onLayout] = useWidth();
  const max = Math.max(1, ...grid.flat());
  const cw = w / 24;
  const ch = 9;
  const order = Array.from({ length: 24 }, (_, i) => (i + start) % 24);
  return (
    <View onLayout={onLayout}>
      {w ? (
        <Svg width={w} height={grid.length * ch}>
          {grid.map((row, r) =>
            order.map((h, c) => {
              const v = row[h] ?? 0;
              return <Rect key={`${r}-${c}`} x={c * cw + 0.5} y={r * ch + 0.5} width={cw - 1} height={ch - 1} fill={v ? C.accent : C.pale} opacity={v ? 0.3 + 0.7 * (v / max) : 1} />;
            }),
          )}
        </Svg>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
        {[0, 6, 12, 18].map((k) => {
          const h = (start + k) % 24;
          return (
            <Text key={k} style={small}>
              {h === 0 ? "12 AM" : h === 12 ? "NOON" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </Text>
          );
        })}
        <Text style={small}>{start} AM</Text>
      </View>
    </View>
  );
}

/* Columns: one value a slot, the tallest named. */
export function Columns({ values, height = 70, accent }: { values: number[]; height?: number; accent?: number }) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 2, borderColor: C.ink }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, height: `${Math.max(v ? 3 : 0, (v / max) * 100)}%`, backgroundColor: i === accent ? C.accent : C.ink }} />
      ))}
    </View>
  );
}
