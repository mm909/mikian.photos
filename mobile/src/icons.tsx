import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { C, F } from "./theme";

/* THE APP'S GLYPHS (owner, 2026-11-21: "down at the bottom here, I'm
 * thinking we try with some icons instead of the labels"; then, of a first
 * set drawn square and abstract: "I don't really like these icons ... not
 * really sure what it's meant"; "I really want to just copy this Instagram
 * nav bar ... everything's nice and rounded").
 *
 * So: the pictures a phone has taught everybody. A house for the feed, a
 * glass for search, a podium for the board, a line going up for the stats,
 * a person for the profile. One weight of line (2 on a 24 grid), round ends
 * and round corners. Each takes the colour it is given. */

type P = { color?: string; size?: number };
const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24" });
const line = (color: string, w = 2) => ({ stroke: color, strokeWidth: w, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

/* THE FEED: home. */
export function FeedIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M3.5 11 L12 3.5 L20.5 11 V20 a1 1 0 0 1 -1 1 H14.5 V15 H9.5 V21 H4.5 a1 1 0 0 1 -1 -1 Z" {...line(color)} />
    </Svg>
  );
}

export function SearchIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={10.5} cy={10.5} r={6.5} {...line(color)} />
      <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} {...line(color)} />
    </Svg>
  );
}

/* THE BOARD: a podium, first place in the middle. */
export function BoardIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M3 20.5 V13.5 H9 V7.5 H15 V16 H21 V20.5 Z" {...line(color)} />
      <Line x1={9} y1={13.5} x2={9} y2={20.5} {...line(color)} />
      <Line x1={15} y1={16} x2={15} y2={20.5} {...line(color)} />
    </Svg>
  );
}

/* THE STATS: a line going up. */
export function StatsIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M3.5 17.5 L9 11.5 L13 15 L20.5 6.5" {...line(color)} />
      <Path d="M15.5 6.5 H20.5 V11.5" {...line(color)} />
    </Svg>
  );
}

export function ProfileIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={12} cy={8} r={4} {...line(color)} />
      <Path d="M4.5 20.5 a7.5 6.5 0 0 1 15 0" {...line(color)} />
    </Svg>
  );
}

export function PlusIcon({ color = C.ink, size = 26 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={12} y1={4.5} x2={12} y2={19.5} {...line(color, 2.4)} />
      <Line x1={4.5} y1={12} x2={19.5} y2={12} {...line(color, 2.4)} />
    </Svg>
  );
}

export function BackIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M11 5 L4 12 L11 19" {...line(color)} />
      <Line x1={4.5} y1={12} x2={20} y2={12} {...line(color)} />
    </Svg>
  );
}

export function CloseIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={5.5} y1={5.5} x2={18.5} y2={18.5} {...line(color, 2.2)} />
      <Line x1={18.5} y1={5.5} x2={5.5} y2={18.5} {...line(color, 2.2)} />
    </Svg>
  );
}

/* Out of a box, upward: hand this to another app. */
export function ShareIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M12 15 V3.5 M7.5 8 L12 3.5 L16.5 8" {...line(color)} />
      <Path d="M5 12 V19 a1.5 1.5 0 0 0 1.5 1.5 H17.5 a1.5 1.5 0 0 0 1.5 -1.5 V12" {...line(color)} />
    </Svg>
  );
}

/* Three lines: the menu on a rower's own profile. */
export function MenuIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Line x1={4} y1={6.5} x2={20} y2={6.5} {...line(color)} />
      <Line x1={4} y1={12} x2={20} y2={12} {...line(color)} />
      <Line x1={4} y1={17.5} x2={20} y2={17.5} {...line(color)} />
    </Svg>
  );
}

/* Three dots: what can be done about a rower, a row, a photo. */
export function DotsIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={5} cy={12} r={1.8} fill={color} />
      <Circle cx={12} cy={12} r={1.8} fill={color} />
      <Circle cx={19} cy={12} r={1.8} fill={color} />
    </Svg>
  );
}

/* THE BELL (owner, 2026-11-21: "I don't like the square used for the
 * number. Maybe just make the bell, the inside of it, blue with the number
 * inside of the blue bell"). An outline when nothing waits; filled with the
 * blue, the count in white inside it, when something does. */
export function BellIcon({ count = 0, color = C.ink, size = 28 }: P & { count?: number }) {
  const full = count > 0;
  const ink = full ? C.accent : color;
  return (
    <View style={{ width: size, height: size }}>
      <Svg {...box(size)}>
        <Path d="M5 17.5 V11 a7 7 0 0 1 14 0 V17.5 Z" stroke={ink} strokeWidth={2} strokeLinejoin="round" fill={full ? C.accent : "none"} />
        <Line x1={3.5} y1={17.5} x2={20.5} y2={17.5} {...line(ink)} />
        <Line x1={10.5} y1={21} x2={13.5} y2={21} {...line(ink)} />
      </Svg>
      {full ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: size * 0.27, alignItems: "center" }}>
          <Text style={{ fontFamily: F.monoBold, fontSize: count > 9 ? size * 0.32 : size * 0.38, lineHeight: size * 0.42, color: "#fff" }}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* Kept for anything still drawing a plain rule in a box. */
export function Square({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Rect x={4} y={4} width={16} height={16} {...line(color)} />
    </Svg>
  );
}
