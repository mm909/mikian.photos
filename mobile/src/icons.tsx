import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { C, F } from "./theme";

/* THE APP'S GLYPHS (owner, 2026-11-21: "down at the bottom here, I'm
 * thinking we try with some icons instead of the labels"; "the Log a row
 * button can be condensed into just a plus, like Instagram has it").
 *
 * The website has no icons to bring over: it is all words. So these are
 * drawn to sit with its type instead of beside it: one weight of line (2 on
 * a 24 grid), square ends and mitred corners like Archivo Black, no curves
 * that are not circles. Each takes the colour it is given, so the one on
 * the blue square can turn white. */

type P = { color?: string; size?: number };
const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24" });
const line = (color: string) => ({ stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "square" as const, strokeLinejoin: "miter" as const });

/* THE FEED: two posts, one over the other. */
export function FeedIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Rect x={4} y={3} width={16} height={8} {...line(color)} />
      <Rect x={4} y={15} width={16} height={6} {...line(color)} />
    </Svg>
  );
}

export function SearchIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={10.5} cy={10.5} r={6.5} {...line(color)} />
      <Line x1={15.5} y1={15.5} x2={21} y2={21} {...line(color)} />
    </Svg>
  );
}

/* THE BOARD: its rows, each a bar as long as its metres, longest on top. */
export function BoardIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={4} y1={5.5} x2={20} y2={5.5} stroke={color} strokeWidth={3} />
      <Line x1={4} y1={12} x2={15} y2={12} stroke={color} strokeWidth={3} />
      <Line x1={4} y1={18.5} x2={10} y2={18.5} stroke={color} strokeWidth={3} />
    </Svg>
  );
}

/* THE STATS: a line climbing over its two axes. */
export function StatsIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M4 3 V20 H21" {...line(color)} />
      <Path d="M8 15 L12 10 L15 13 L20 6" {...line(color)} strokeLinecap="butt" />
    </Svg>
  );
}

export function ProfileIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={12} cy={8} r={4} {...line(color)} />
      <Path d="M4 21 V19 a8 6 0 0 1 16 0 V21" {...line(color)} />
    </Svg>
  );
}

export function PlusIcon({ color = C.ink, size = 26 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={2.6} />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={2.6} />
    </Svg>
  );
}

export function BackIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M11 5 L4 12 L11 19" {...line(color)} />
      <Line x1={5} y1={12} x2={21} y2={12} {...line(color)} />
    </Svg>
  );
}

/* Three lines: the menu on a rower's own profile. */
export function MenuIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={3} y1={6} x2={21} y2={6} {...line(color)} />
      <Line x1={3} y1={12} x2={21} y2={12} {...line(color)} />
      <Line x1={3} y1={18} x2={21} y2={18} {...line(color)} />
    </Svg>
  );
}

/* Three dots: what can be done about somebody else. Squares, not circles. */
export function DotsIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Rect x={3} y={10.5} width={3} height={3} fill={color} />
      <Rect x={10.5} y={10.5} width={3} height={3} fill={color} />
      <Rect x={18} y={10.5} width={3} height={3} fill={color} />
    </Svg>
  );
}

/* THE BELL (owner, 2026-11-21: "I don't like the square used for the
 * number. Maybe just make the bell, the inside of it, blue with the number
 * inside of the blue bell"). An outline when nothing waits; filled with the
 * blue, the count in white inside it, when something does. `on` draws it
 * filled with no count (the per-rower switch on a profile). */
export function BellIcon({ count = 0, on, color = C.ink, size = 28 }: P & { count?: number; on?: boolean }) {
  const full = count > 0 || !!on;
  const ink = full ? C.accent : color;
  return (
    <View style={{ width: size, height: size }}>
      <Svg {...box(size)}>
        <Path d="M4.5 18 V10.5 a7.5 7.5 0 0 1 15 0 V18 Z" stroke={ink} strokeWidth={2} strokeLinejoin="miter" fill={full ? C.accent : "none"} />
        <Line x1={2.5} y1={18} x2={21.5} y2={18} stroke={ink} strokeWidth={2} />
        <Line x1={10} y1={21.5} x2={14} y2={21.5} stroke={ink} strokeWidth={2} />
      </Svg>
      {count > 0 ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: size * 0.26, alignItems: "center" }}>
          <Text style={{ fontFamily: F.monoBold, fontSize: count > 9 ? size * 0.34 : size * 0.4, lineHeight: size * 0.44, color: "#fff" }}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </View>
  );
}
