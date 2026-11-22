import { type ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { G, Line, Text as SvgText } from "react-native-svg";
import type { Pad, XY } from "../erg/reviewGeom";
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
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: BOX_PAD, marginTop: 14, flex: fill ? 1 : undefined }}>
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
