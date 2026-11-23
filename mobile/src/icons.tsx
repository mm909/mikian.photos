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

/* A LIKE: a heart, an outline until it is given, then whole. */
export function HeartIcon({ color = C.ink, size = 24, full }: P & { full?: boolean }) {
  return (
    <Svg {...box(size)}>
      <Path d="M12 20.5 C5.5 15.8 3 12.6 3 9.2 A4.7 4.7 0 0 1 12 7.3 A4.7 4.7 0 0 1 21 9.2 C21 12.6 18.5 15.8 12 20.5 Z" {...line(color)} fill={full ? color : "none"} />
    </Svg>
  );
}

/* A COMMENT: a round speech bubble with its tail at the foot. */
export function CommentIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M20.5 11.5 a8.5 8 0 0 1 -12.4 7.1 L3.5 20 L4.9 15.7 A8.5 8 0 1 1 20.5 11.5 Z" {...line(color)} />
    </Svg>
  );
}

/* SEND: an arrow going up (owner, 2026-11-22: "instead of the post
 * button ... just an arrow that says up"). */
export function SendIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M12 19 V5.5 M6 11.5 L12 5.5 L18 11.5" {...line(color, 2.4)} />
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

/* THE QUESTIONS behind the stats (owner, 2026-11-21: "a little FAQ
 * button"): a question mark in a ring. */
export function QuestionIcon({ color = C.ink, size = 26 }: P) {
  return (
    <Svg {...box(size)}>
      <Circle cx={12} cy={12} r={9} {...line(color)} />
      <Path d="M9.4 9.6 a2.7 2.7 0 1 1 4.1 2.3 c-.9 .6 -1.5 1.1 -1.5 2.2" {...line(color)} />
      <Circle cx={12} cy={17.1} r={1.15} fill={color} />
    </Svg>
  );
}

/* THE BELL ON ONE ROWER, beside FOLLOWING: an outline while it is off,
 * filled once it is on. */
export function RingIcon({ on, color = C.ink, size = 22 }: P & { on: boolean }) {
  const ink = on ? C.accent : color;
  return (
    <Svg {...box(size)}>
      <Path d="M5 17.5 V11 a7 7 0 0 1 14 0 V17.5 Z" stroke={ink} strokeWidth={2} strokeLinejoin="round" fill={on ? C.accent : "none"} />
      <Line x1={3.5} y1={17.5} x2={20.5} y2={17.5} {...line(ink)} />
      <Line x1={10.5} y1={21} x2={13.5} y2={21} {...line(ink)} />
    </Svg>
  );
}

/* THE BLACK CHECK (owner, 2026-11-22: "it's a black verified check mark";
 * "we should denote somewhere here if they are a telemetry subscriber ...
 * definitely never say subscriber ... Strava does the banner thing. That
 * looks weird. I think it should be more like a check mark"). The rosette
 * a phone has taught everybody means the real one, in the ink of the page
 * and not in anybody's blue, the tick cut out of it in the page's own
 * colour. It sits after a rower's name. */
const ROSETTE = "M12.00 1.10 L14.36 3.21 L17.45 2.56 L18.43 5.57 L21.44 6.55 L20.79 9.64 L22.90 12.00 L20.79 14.36 L21.44 17.45 L18.43 18.43 L17.45 21.44 L14.36 20.79 L12.00 22.90 L9.64 20.79 L6.55 21.44 L5.57 18.43 L2.56 17.45 L3.21 14.36 L1.10 12.00 L3.21 9.64 L2.56 6.55 L5.57 5.57 L6.55 2.56 L9.64 3.21 Z";
export function VerifiedIcon({ color = C.ink, size = 15 }: P) {
  return (
    <Svg {...box(size)} accessibilityLabel="Telemetry">
      <Path d={ROSETTE} fill={color} stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M7.9 12.3 L10.7 15.1 L16.2 9.2" stroke={C.paper} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* THE GRID: nine squares, the first tab of a profile. */
export function GridIcon({ color = C.ink, size = 24 }: P) {
  const at = [4, 10.25, 16.5];
  return (
    <Svg {...box(size)}>
      {at.flatMap((y) => at.map((x) => <Rect key={`${x}-${y}`} x={x} y={y} width={3.5} height={3.5} rx={0.6} fill={color} />))}
    </Svg>
  );
}

/* THE MENU A HELD ROW OPENS (ui.tsx HoldMenu). Two arrows, one each way:
 * the other photo. */
export function SwapIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M4 8.5 H19 M15.5 5 L19 8.5 L15.5 12" {...line(color)} />
      <Path d="M20 15.5 H5 M8.5 12 L5 15.5 L8.5 19" {...line(color)} />
    </Svg>
  );
}

/* Two links of a chain: an address to send. */
export function LinkIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M10.2 13.8 a4 4 0 0 0 5.7 0 l3 -3 a4 4 0 0 0 -5.7 -5.7 l-1.4 1.4" {...line(color)} />
      <Path d="M13.8 10.2 a4 4 0 0 0 -5.7 0 l-3 3 a4 4 0 0 0 5.7 5.7 l1.4 -1.4" {...line(color)} />
    </Svg>
  );
}

/* A square with a corner peeled up: a sticker. */
export function StickerIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M20 13 V6.5 A2.5 2.5 0 0 0 17.5 4 H6.5 A2.5 2.5 0 0 0 4 6.5 V17.5 A2.5 2.5 0 0 0 6.5 20 H13 Z" {...line(color)} />
      <Path d="M13 20 V15.5 A2.5 2.5 0 0 1 15.5 13 H20" {...line(color)} />
    </Svg>
  );
}

/* Four corners pulled apart: the photo whole. */
export function ExpandIcon({ color = C.ink, size = 24 }: P) {
  return (
    <Svg {...box(size)}>
      <Path d="M4.5 9.5 V4.5 H9.5 M14.5 4.5 H19.5 V9.5 M19.5 14.5 V19.5 H14.5 M9.5 19.5 H4.5 V14.5" {...line(color)} />
    </Svg>
  );
}
