import { useRef, type ReactNode } from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { C, F } from "../theme";

/* THE ART OF 159 (owner, 2026-11-24: "a line-art briefcase with a
 * graffiti-style 159 sticker on it, and a flip-dot display, black and
 * yellow dots, that shows 159 in the app's bold numerals and then morphs
 * into the rower's current pace").
 *
 * The flip dots are black and yellow in the dark look and the light: they
 * are a thing in the room, not the page. Everything else is in the look's
 * own ink. */

export const DOT_ON = "#FFD21F";
const DOT_OFF = "#2A2A2A";
const PANEL = "#0E0E0E";

/* THE NUMERALS, five dots by seven, the strokes two dots thick so they read
 * as the app's black numerals do and not as a thin clock. */
const GLYPH: Record<string, string[]> = {
  "0": [".###.", "##.##", "##.##", "##.##", "##.##", "##.##", ".###."],
  "1": ["..##.", ".###.", "..##.", "..##.", "..##.", "..##.", ".####"],
  "2": [".###.", "##.##", "...##", "..##.", ".##..", "##...", "#####"],
  "3": ["####.", "...##", "...##", ".###.", "...##", "...##", "####."],
  "4": ["...##", "..###", ".#.##", "#..##", "#####", "...##", "...##"],
  "5": ["#####", "##...", "####.", "...##", "...##", "##.##", ".###."],
  "6": [".###.", "##...", "##...", "####.", "##.##", "##.##", ".###."],
  "7": ["#####", "...##", "..##.", "..##.", ".##..", ".##..", ".##.."],
  "8": [".###.", "##.##", "##.##", ".###.", "##.##", "##.##", ".###."],
  "9": [".###.", "##.##", "##.##", ".####", "...##", "...##", ".###."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};
const COLON = [".", ".", "#", ".", "#", ".", "."];

/* "1:59" as columns of seven dots: a numeral, a gap, the colon, a gap, two
 * numerals with a gap between. */
function bitmap(text: string): boolean[][] {
  const cols: boolean[][] = [];
  const glyph = (ch: string) => {
    const g = GLYPH[ch] ?? GLYPH[" "];
    for (let x = 0; x < 5; x++) cols.push(g.map((row) => row[x] === "#"));
  };
  const gap = () => cols.push(new Array(7).fill(false));
  const [mm, ss] = text.split(":");
  glyph(mm?.slice(-1) ?? " ");
  gap();
  cols.push(COLON.map((c) => c === "#"));
  gap();
  glyph(ss?.[0] ?? " ");
  gap();
  glyph(ss?.[1] ?? " ");
  return cols;
}
export const DOT_COLS = 19;

/* A split as the dots show it: whole seconds, "1:59". */
export function dotClock(pace: number): string {
  if (!(pace > 0 && pace < 600)) return "-:--";
  const s = Math.round(pace);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* THE FLIP DOTS. When the text changes each dot that changes turns over,
 * column by column from the left, as a real board's do: for a moment it is
 * edge on (a thin line), and then it shows its other face. `t` is the
 * wall's seconds; the owner of this redraws it every frame while it moves. */
export function FlipDots({ text, width, t }: { text: string; width: number; t: number }) {
  const PADC = 1.2;
  const cols = DOT_COLS + PADC * 2;
  const rows = 7 + PADC * 2;
  const cell = width / cols;
  const height = cell * rows;
  /* What each dot shows, and since when it has been turning to it. */
  const was = useRef<{ text: string; on: boolean[][]; flip: number[][] } | null>(null);
  const want = bitmap(text);
  if (!was.current) was.current = { text, on: want, flip: want.map((c) => c.map(() => -1)) };
  const w = was.current;
  if (w.text !== text) {
    const flip = want.map((c, x) => c.map((v, y) => (v !== w.on[x][y] ? t + x * 0.028 + ((x * 7 + y * 13) % 5) * 0.012 : w.flip[x][y])));
    /* A dot still turning to its last face is turned from wherever it was. */
    was.current = { text, on: want, flip };
  }
  const FLIP = 0.11;
  const dots: ReactNode[] = [];
  const r = cell * 0.4;
  for (let x = 0; x < DOT_COLS; x++) {
    for (let y = 0; y < 7; y++) {
      const on = was.current.on[x][y];
      const at = was.current.flip[x][y];
      const k = at < 0 ? 1 : (t - at) / FLIP;
      const cx = (x + PADC + 0.5) * cell;
      const cy = (y + PADC + 0.5) * cell;
      /* Before it turns it shows its old face; half way it is edge on. */
      const face = k < 0.5 ? !on : on;
      const squash = k >= 0 && k < 1 ? Math.abs(Math.cos(Math.PI * Math.max(0, k))) : 1;
      const showOld = k < 0;
      const lit = showOld ? !on : face;
      dots.push(<Ellipse key={`${x}-${y}`} cx={cx} cy={cy} rx={r} ry={Math.max(0.6, r * squash)} fill={lit ? DOT_ON : DOT_OFF} />);
    }
  }
  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={cell * 0.8} fill={PANEL} stroke="#3A3A3A" strokeWidth={1} />
      {dots}
    </Svg>
  );
}

/* Whether any dot of the board is still turning at `t`. */
export const FLIP_S = 0.11 + DOT_COLS * 0.028 + 0.06;

/* THE BRIEFCASE, line art in the look's ink, with the sticker slapped on it
 * crooked: 159 in the black face, yellow with a thick black edge, a drip and
 * a spark. `pop` 0 to 1 is how far it has come up. */
export function Briefcase({ width, pop = 1, t = 0 }: { width: number; pop?: number; t?: number }) {
  const H = width * 0.78;
  const ink = C.ink;
  const s = Math.max(0.001, pop);
  const swing = (1 - pop) * 8 * Math.sin(t * 12);
  return (
    <Svg width={width} height={H} viewBox="0 0 200 156">
      <G scale={s} origin="100, 90" rotation={swing}>
        {/* The handle. */}
        <Path d="M74 34 V22 Q74 12 84 12 H116 Q126 12 126 22 V34" stroke={ink} strokeWidth={6} fill="none" strokeLinejoin="round" />
        <Rect x={64} y={30} width={14} height={8} rx={2} fill={C.paper} stroke={ink} strokeWidth={3} />
        <Rect x={122} y={30} width={14} height={8} rx={2} fill={C.paper} stroke={ink} strokeWidth={3} />
        {/* The case: its body, the seam and the two latches. */}
        <Rect x={14} y={38} width={172} height={110} rx={12} fill={C.paper} stroke={ink} strokeWidth={4.5} />
        <Line x1={14} y1={66} x2={186} y2={66} stroke={ink} strokeWidth={3} />
        <Rect x={40} y={58} width={22} height={16} rx={3} fill={C.paper} stroke={ink} strokeWidth={3} />
        <Rect x={138} y={58} width={22} height={16} rx={3} fill={C.paper} stroke={ink} strokeWidth={3} />
        <Circle cx={51} cy={66} r={2.6} fill={ink} />
        <Circle cx={149} cy={66} r={2.6} fill={ink} />
        <Line x1={26} y1={134} x2={60} y2={134} stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
        {/* The sticker, crooked. */}
        <G rotation={-9} origin="104, 108">
          <Path d="M52 84 Q100 76 154 86 L150 132 Q98 140 56 130 Z" fill="#FFFFFF" stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
          <SvgText x={104} y={124} fontFamily={F.black} fontSize={44} textAnchor="middle" stroke="#111111" strokeWidth={9} strokeLinejoin="round" fill="#111111" letterSpacing={-1}>
            159
          </SvgText>
          <SvgText x={104} y={124} fontFamily={F.black} fontSize={44} textAnchor="middle" fill={DOT_ON} letterSpacing={-1}>
            159
          </SvgText>
          {/* A drip off the 5, and a spark. */}
          <Path d="M106 124 q1.5 6 0 10 q-1.5 3 -3 0 q-1 -4 0 -10" fill={DOT_ON} stroke="#111111" strokeWidth={1.6} />
          <Path d="M146 82 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill="#FF4FA3" stroke="#111111" strokeWidth={1.4} strokeLinejoin="round" />
        </G>
      </G>
    </Svg>
  );
}

/* Black and yellow, the board's colours, across the top of the title card. */
export function Hazard({ width, height, t = 0 }: { width: number; height: number; t?: number }) {
  const step = height * 1.4;
  const off = ((t * 40) % step) - step;
  const n = Math.ceil(width / step) + 3;
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={DOT_ON} />
      {Array.from({ length: n }, (_, i) => {
        const x = off + i * step;
        return <Path key={i} d={`M${x} ${height} L${x + height} 0 L${x + height + step / 2} 0 L${x + step / 2} ${height}Z`} fill="#111111" />;
      })}
    </Svg>
  );
}
