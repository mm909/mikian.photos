import type { ReactNode } from "react";
import { dayTicks } from "@/lib/row100k";
import { fmtClock, fmtInt, fmtK } from "./fmt";
import type {
  DayChart,
  DayYou,
  DriftChart,
  DriftYou,
  DurChart,
  DurYou,
  EcdfChart,
  EcdfYou,
  FanChart,
  FanYou,
  FitLine,
  GrindChart,
  GrindYou,
  HistChart,
  HistYou,
  HourChart,
  HourYou,
  KdeChart,
  KdeYou,
  LadderChart,
  LadderYou,
  PaceChart,
  PaceYou,
  ResidChart,
  ResidYou,
} from "./model";

/* Hand-drawn SVG, the /row100k frame throughout (660×250, L56 R16 T14 B30,
 * mono 10px axis text, ink baseline, dashed gridlines). No hooks, no
 * library: every chart is a pure function of the JSON the server computed,
 * so it renders identically on the server and inside the client toggle.
 *
 * Colour contract (spec, 2026-09-05, review compromise): field marks are
 * grey and ink, field FILLS (bars, bands, areas) are the pale water tint
 * every other /row100k chart uses, and solid water-blue is the viewer and
 * nothing else — so the page sits in the family without the EVERYONE | YOU
 * chip losing its meaning. Every YOU mark sits in a group with class you.
 * Every chart returns null rather than a frame with NaN in it when its
 * data is too thin. */

const W = 660;
const H = 250;
const L = 56;
const R = 16;
const T = 14;
const B = 30;
const PW = W - L - R;
const PH = H - T - B;
const MONO = "var(--row-mono), monospace";
const INK = "#15171a";
const GRAY = "#8a8a85";
const GRID = "#dddbd2";
const FIELD = "rgba(0,119,182,0.16)";
const FIELD_EDGE = "#9a9a95";
const BAND = "rgba(0,119,182,0.10)";
const BAND2 = "rgba(0,119,182,0.06)";
const WATER = "#0077B6";
/* Bins and bars under this many sessions are drawn dashed and unlabelled —
 * a cell of four is close enough to a person to be a person. */
const SMALL = 5;

const r = (v: number) => Math.round(v * 10) / 10;
const pad2 = (n: number) => String(n).padStart(2, "0");

function Lbl({
  x,
  y,
  a = "middle",
  size = 10,
  fill = GRAY,
  bold = false,
  children,
}: {
  x: number;
  y: number;
  a?: "start" | "middle" | "end";
  size?: number;
  fill?: string;
  bold?: boolean;
  children: ReactNode;
}) {
  return (
    <text x={r(x)} y={r(y)} textAnchor={a} fontSize={size} fontWeight={bold ? 700 : undefined} fill={fill} fontFamily={MONO}>
      {children}
    </text>
  );
}

/* A bold one-line tag beside a mark; flips to the other side of the mark
 * when it would run off the right edge. */
function Tag({ x, y, blue = false, children }: { x: number; y: number; blue?: boolean; children: ReactNode }) {
  const right = x > L + PW * 0.6;
  return (
    <Lbl x={right ? x - 5 : x + 5} y={y} a={right ? "end" : "start"} bold fill={blue ? WATER : INK}>
      {children}
    </Lbl>
  );
}

function GridY({ yMax, fmt }: { yMax: number; fmt: (v: number) => string }) {
  const y = (v: number) => T + (1 - v / yMax) * PH;
  return (
    <>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={r(y(yMax * f))} y2={r(y(yMax * f))} stroke={GRID} strokeWidth="1" strokeDasharray={f === 1 ? undefined : "3 4"} />
          <Lbl x={L - 8} y={y(yMax * f) + 3} a="end">
            {fmt(yMax * f)}
          </Lbl>
        </g>
      ))}
    </>
  );
}

function Base({ y0 = T + PH }: { y0?: number }) {
  return <line x1={L} x2={W - R} y1={r(y0)} y2={r(y0)} stroke={INK} strokeWidth="2" />;
}

/* Rug ticks under the axis: the field short and grey, the viewer taller and
 * blue, so both can share a baseline. */
function Rug({ xs, x, y0 = T + PH, blue = false }: { xs: number[]; x: (v: number) => number; y0?: number; blue?: boolean }) {
  const lo = L - 0.5;
  const hi = W - R + 0.5;
  return (
    <g className={blue ? "you" : undefined}>
      {xs.map((v, i) => {
        const px = x(v);
        if (px < lo || px > hi) return null;
        return (
          <line
            key={i}
            x1={r(px)}
            x2={r(px)}
            y1={r(y0 + 2)}
            y2={r(y0 + (blue ? 9 : 5))}
            stroke={blue ? WATER : FIELD_EDGE}
            strokeWidth={blue ? 1.5 : 1}
            opacity={blue ? 1 : 0.7}
          />
        );
      })}
    </g>
  );
}

function VLine({ x, dash, blue = false, faint = false }: { x: number; dash?: string; blue?: boolean; faint?: boolean }) {
  return (
    <line
      x1={r(x)}
      x2={r(x)}
      y1={T}
      y2={T + PH}
      stroke={blue ? WATER : INK}
      strokeWidth={blue ? 1.5 : 1}
      strokeDasharray={dash}
      opacity={faint ? 0.6 : 1}
    />
  );
}

/* 1 / 2 / 2.5 / 5 / 10 × 10ⁿ — the repo's nice axis top for meters. */
function niceMax(max: number): number {
  if (!(max > 0)) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * pow) return m * pow;
  return 10 * pow;
}

const signedTick = (t: number) => (t > 0 ? `+${t}` : t < 0 ? `−${Math.abs(t)}` : "0");

/* The ink-bordered box every chart sits in, with its one takeaway line. */
export function ChartBox({
  title,
  take,
  foot,
  footYou,
  children,
}: {
  title: string;
  take?: string;
  foot?: string | null;
  footYou?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="curve an-chart">
      <div className="t">{title}</div>
      {children}
      {take ? (
        <div className="an-take">
          <b>TAKEAWAY</b> · {take}
        </div>
      ) : null}
      {foot ? <div className="an-foot">{foot}</div> : null}
      {footYou ? <div className="an-foot you">{footYou}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ 1 · hist */
export function HistSvg({ c, you }: { c: HistChart; you: HistYou | null }) {
  if (!c.bins.length || !(c.yMax > 0) || !(c.xMax > c.xMin)) return null;
  const x = (v: number) => L + ((v - c.xMin) / (c.xMax - c.xMin)) * PW;
  const y = (v: number) => T + (1 - v / c.yMax) * PH;
  const y0 = y(0);
  const bL = Math.max(c.xMin, c.mean - c.sd);
  const bR = Math.min(c.xMax, c.mean + c.sd);
  const meanRight = c.mean >= c.median;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of meters per session with the mean ± 1 SD band">
      {bR > bL && <rect x={r(x(bL))} y={T} width={r(x(bR) - x(bL))} height={PH} fill={BAND} />}
      <GridY yMax={c.yMax} fmt={(v) => String(Math.round(v))} />
      {c.bins.map((bin, i) => {
        if (bin.n <= 0) return null;
        const bx = x(bin.x0) + 1;
        const bw = Math.max(1, x(bin.x1) - x(bin.x0) - 2);
        const bh = Math.max(y0 - y(bin.n), 2);
        return bin.n < SMALL ? (
          <rect key={i} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill="none" stroke={FIELD_EDGE} strokeWidth="1" strokeDasharray="2 2" />
        ) : (
          <rect key={i} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill={FIELD}>
            <title>{`${fmtInt(bin.x0)}–${fmtInt(bin.x1)} m · ${bin.n} sessions`}</title>
          </rect>
        );
      })}
      <VLine x={x(c.median)} />
      <Lbl x={x(c.median) + (meanRight ? -4 : 4)} y={T + 10} a={meanRight ? "end" : "start"} size={9} fill={INK}>
        MED
      </Lbl>
      <VLine x={x(c.mean)} dash="2 3" />
      <Lbl x={x(c.mean) + (meanRight ? 4 : -4)} y={T + 10} a={meanRight ? "start" : "end"} size={9} fill={INK}>
        MEAN
      </Lbl>
      {c.beyond > 0 && (
        <Lbl x={W - R} y={T + 22} a="end">
          +{c.beyond} BEYOND →
        </Lbl>
      )}
      <Base />
      {c.ticks.map((t) => (
        <Lbl key={t} x={x(t)} y={H - 8}>
          {fmtK(t)}
        </Lbl>
      ))}
      {you && (
        <g className="you">
          <Rug xs={you.rug} x={x} blue />
          {you.line >= c.xMin && you.line <= c.xMax && <VLine x={x(you.line)} dash="5 4" blue />}
          <Tag x={Math.min(Math.max(x(you.line), L), W - R)} y={T + 34} blue>
            {you.tag}
          </Tag>
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------- 2 · kde */
export function KdeSvg({ c, you }: { c: KdeChart; you: KdeYou | null }) {
  if (c.xs.length < 2 || c.xs.length !== c.ys.length || !(c.xMax > c.xMin)) return null;
  const top = Math.max(...c.ys);
  if (!(top > 0)) return null;
  const x = (v: number) => L + ((v - c.xMin) / (c.xMax - c.xMin)) * PW;
  const y = (d: number) => T + (1 - d / (top * 1.08)) * PH;
  const y0 = y(0);
  const line = c.xs.map((v, i) => `${i ? "L" : "M"}${r(x(v))},${r(y(c.ys[i]))}`).join("");
  const area = `${line}L${r(x(c.xs[c.xs.length - 1]))},${r(y0)}L${r(x(c.xs[0]))},${r(y0)}Z`;
  const inBand = c.xs.map((v, i) => [v, c.ys[i]] as const).filter(([v]) => v >= c.mean - c.sd && v <= c.mean + c.sd);
  const band =
    inBand.length >= 2
      ? `M${r(x(inBand[0][0]))},${r(y0)}${inBand.map(([v, d]) => `L${r(x(v))},${r(y(d))}`).join("")}L${r(x(inBand[inBand.length - 1][0]))},${r(y0)}Z`
      : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Kernel density of split per 500 m across every session">
      {c.ticks.map((t) => (
        <g key={t}>
          <line x1={r(x(t))} x2={r(x(t))} y1={T} y2={r(y0)} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
          <Lbl x={x(t)} y={H - 8}>
            {fmtClock(t)}
          </Lbl>
        </g>
      ))}
      <path d={area} fill={BAND2} />
      {band && <path d={band} fill={BAND} />}
      <path d={line} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <VLine x={x(c.median)} />
      <Lbl x={x(c.median) + 4} y={T + 10} a="start" size={9} fill={INK}>
        MED {fmtClock(c.median)}
      </Lbl>
      <Lbl x={L} y={T + 10} a="start" size={9}>
        ← FASTER
      </Lbl>
      <Lbl x={W - R} y={T + 10} a="end" size={9}>
        SLOWER →
      </Lbl>
      <Rug xs={c.rug} x={x} />
      <Base />
      {you && (
        <g className="you">
          <Rug xs={you.rug} x={x} blue />
          {you.best >= c.xMin && you.best <= c.xMax && <VLine x={x(you.best)} dash="2 3" blue faint />}
          {you.median >= c.xMin && you.median <= c.xMax && <VLine x={x(you.median)} dash="5 4" blue />}
          <Tag x={Math.min(Math.max(x(you.median), L), W - R)} y={T + 24} blue>
            {you.tag}
          </Tag>
          <Tag x={Math.min(Math.max(x(you.best), L), W - R)} y={T + 38} blue>
            {you.bestTag}
          </Tag>
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------ 3a · meters vs seconds */
export function DurSvg({ c, you }: { c: DurChart; you: DurYou | null }) {
  if (c.pts.length < 3 || !(c.xMax > 0) || !(c.yMax > 0)) return null;
  const x = (m: number) => L + (m / c.xMax) * PW;
  const y = (s: number) => T + (1 - s / c.yMax) * PH;
  const fy = (m: number) => c.fit.a + c.fit.b * m;
  const seg = { x1: r(x(0)), y1: r(y(fy(0))), x2: r(x(c.xMax)), y2: r(y(fy(c.xMax))) };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Meters against seconds for every session, with the least-squares line">
      <defs>
        <clipPath id="an-dur-clip">
          <rect x={L} y={T} width={PW} height={PH} />
        </clipPath>
      </defs>
      <GridY yMax={c.yMax} fmt={(v) => `${Math.round(v / 60)} min`} />
      <g clipPath="url(#an-dur-clip)">
        {c.pts.map(([m, s], i) => (
          <circle key={i} cx={r(x(m))} cy={r(y(s))} r="2.4" fill={GRAY} opacity={you ? 0.25 : 0.4} />
        ))}
        <line {...seg} stroke={INK} strokeWidth="2" />
      </g>
      {you && (
        <g className="you">
          {you.pts
            .filter(([m, s]) => m <= c.xMax && s <= c.yMax)
            .map(([m, s], i) => (
              <circle key={i} cx={r(x(m))} cy={r(y(s))} r="3.6" fill={WATER} stroke="#fff" strokeWidth="1" />
            ))}
          <Lbl x={L + 6} y={T + 10} a="start" bold fill={WATER}>
            {you.tag}
          </Lbl>
        </g>
      )}
      <Lbl x={W - R} y={T + 10} a="end">
        {c.corner}
      </Lbl>
      {c.beyond > 0 && (
        <Lbl x={W - R} y={T + 22} a="end">
          +{c.beyond} BEYOND →
        </Lbl>
      )}
      <Base />
      {c.xTicks.map((t) => (
        <Lbl key={t} x={x(t)} y={H - 8}>
          {fmtK(t)}
        </Lbl>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------- 3 · split vs log2 */
export function PaceSvg({ c, you }: { c: PaceChart; you: PaceYou | null }) {
  if (c.pts.length < 3 || !(c.xMax > c.xMin) || !(c.yMax > c.yMin)) return null;
  const x = (lg: number) => L + ((lg - c.xMin) / (c.xMax - c.xMin)) * PW;
  /* Faster UP: a smaller split is a smaller y. */
  const y = (s: number) => T + ((s - c.yMin) / (c.yMax - c.yMin)) * PH;
  const seg = (f: FitLine) => ({
    x1: r(x(c.xMin)),
    y1: r(y(f.a + f.b * c.xMin)),
    x2: r(x(c.xMax)),
    y2: r(y(f.a + f.b * c.xMax)),
  });
  const fy = (lg: number) => c.fit.a + c.fit.b * lg;
  const band = `M${r(x(c.xMin))},${r(y(fy(c.xMin) - c.resSd))}L${r(x(c.xMax))},${r(y(fy(c.xMax) - c.resSd))}L${r(x(c.xMax))},${r(y(fy(c.xMax) + c.resSd))}L${r(x(c.xMin))},${r(y(fy(c.xMin) + c.resSd))}Z`;
  const inY = (s: number) => s >= c.yMin && s <= c.yMax;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Split per 500 m against distance on a log scale, with the least-squares fit">
      <defs>
        <clipPath id="an-pace-clip">
          <rect x={L} y={T} width={PW} height={PH} />
        </clipPath>
      </defs>
      {c.yTicks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={r(y(t))} y2={r(y(t))} stroke={GRID} strokeWidth="1" strokeDasharray="3 4" />
          <Lbl x={L - 8} y={y(t) + 3} a="end">
            {fmtClock(t)}
          </Lbl>
        </g>
      ))}
      <g clipPath="url(#an-pace-clip)">
        <path d={band} fill={BAND} />
        {c.pts.map(([lg, s], i) => (
          <circle key={i} cx={r(x(lg))} cy={r(y(s))} r="2.4" fill={GRAY} opacity={you ? 0.25 : 0.4} />
        ))}
        <line {...seg(c.fit)} stroke={INK} strokeWidth="2" />
        {you?.fit && <line className="you" {...seg(you.fit)} stroke={WATER} strokeWidth="1.5" strokeDasharray="5 4" />}
      </g>
      {you && (
        <g className="you">
          {you.pts
            .filter(([lg, s]) => inY(s) && lg >= c.xMin && lg <= c.xMax)
            .map(([lg, s], i) => (
              <circle key={i} cx={r(x(lg))} cy={r(y(s))} r="3.6" fill={WATER} stroke="#fff" strokeWidth="1" />
            ))}
          <Lbl x={L + 6} y={T + 10} a="start" bold fill={WATER}>
            {you.tag}
          </Lbl>
        </g>
      )}
      <Lbl x={W - R} y={T + 10} a="end">
        {c.corner}
      </Lbl>
      <Base />
      {c.xTicks.map((m) => (
        <Lbl key={m} x={x(Math.log2(m))} y={H - 8}>
          {fmtK(m)}
        </Lbl>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------- 4 · residual */
export function ResidSvg({ c, you }: { c: ResidChart; you: ResidYou | null }) {
  if (!c.bins.length || !(c.yMax > 0) || !(c.xMax > c.xMin)) return null;
  const x = (v: number) => L + ((v - c.xMin) / (c.xMax - c.xMin)) * PW;
  const y = (v: number) => T + (1 - v / c.yMax) * PH;
  const y0 = y(0);
  const bandRect = (k: number, fill: string) => {
    const a = Math.max(c.xMin, -k * c.sd);
    const b = Math.min(c.xMax, k * c.sd);
    return b > a ? <rect x={r(x(a))} y={T} width={r(x(b) - x(a))} height={PH} fill={fill} /> : null;
  };
  const kdeLine =
    c.kdeXs.length === c.kdeYs.length && c.kdeXs.length > 1
      ? c.kdeXs.map((v, i) => `${i ? "L" : "M"}${r(x(v))},${r(y(c.kdeYs[i]))}`).join("")
      : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of split residuals: actual minus the split predicted from distance">
      {c.sd > 0 && bandRect(2, BAND2)}
      {c.sd > 0 && bandRect(1, BAND)}
      <GridY yMax={c.yMax} fmt={(v) => String(Math.round(v))} />
      {c.bins.map((bin, i) => {
        if (bin.n <= 0) return null;
        const bx = x(bin.x0) + 0.5;
        const bw = Math.max(1, x(bin.x1) - x(bin.x0) - 1);
        const bh = Math.max(y0 - y(bin.n), 2);
        return bin.n < SMALL ? (
          <rect key={i} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill="none" stroke={FIELD_EDGE} strokeWidth="1" strokeDasharray="2 2" />
        ) : (
          <rect key={i} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill={FIELD}>
            <title>{`${signedTick(bin.x0)} to ${signedTick(bin.x1)} s · ${bin.n} sessions`}</title>
          </rect>
        );
      })}
      {kdeLine && <path d={kdeLine} fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />}
      <line x1={r(x(0))} x2={r(x(0))} y1={T} y2={r(y0)} stroke={INK} strokeWidth="2" />
      <Lbl x={L + 2} y={T + 10} a="start" size={9}>
        ← FASTER
      </Lbl>
      <Lbl x={W - R - 2} y={T + 10} a="end" size={9}>
        SLOWER →
      </Lbl>
      <Base />
      {c.ticks.map((t) => (
        <Lbl key={t} x={x(t)} y={H - 8}>
          {signedTick(t)}
        </Lbl>
      ))}
      {you && (
        <g className="you">
          <Rug xs={you.rug} x={x} blue />
          {Number.isFinite(you.mean) && you.mean >= c.xMin && you.mean <= c.xMax && <VLine x={x(you.mean)} dash="5 4" blue />}
          <Tag x={Math.min(Math.max(x(you.mean), L), W - R)} y={T + 26} blue>
            {you.tag}
          </Tag>
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------- 5 · ecdf */
export function EcdfSvg({ c, you }: { c: EcdfChart; you: EcdfYou | null }) {
  if (c.steps.length < 2 || !(c.xMax > c.xMin) || !(c.xMin > 0)) return null;
  const lx = (v: number) => Math.log10(Math.max(v, 1));
  const x = (v: number) => L + ((lx(v) - lx(c.xMin)) / (lx(c.xMax) - lx(c.xMin))) * PW;
  const y = (p: number) => T + (1 - p / 100) * PH;
  const y0 = y(0);
  let d = `M${r(x(c.steps[0][0]))},${r(y(c.steps[0][1]))}`;
  for (let i = 1; i < c.steps.length; i++) d += `H${r(x(c.steps[i][0]))}V${r(y(c.steps[i][1]))}`;
  const goalIn = c.goal > c.xMin && c.goal < c.xMax;
  const br = c.bracket;
  const brRight = br ? x(br[1]) > L + PW * 0.6 : false;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative share of rowers at or below each total, log scale">
      <defs>
        <clipPath id="an-ecdf-clip">
          <rect x={L} y={T} width={PW} height={PH} />
        </clipPath>
      </defs>
      {[25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line x1={L} x2={W - R} y1={r(y(p))} y2={r(y(p))} stroke={GRID} strokeWidth="1" strokeDasharray={p === 100 ? undefined : "3 4"} />
          {p < 100 && (
            <Lbl x={L - 8} y={y(p) + 3} a="end">
              {p}
            </Lbl>
          )}
        </g>
      ))}
      {goalIn && (
        <g>
          <line x1={r(x(c.goal))} x2={r(x(c.goal))} y1={T} y2={r(y0)} stroke={GRAY} strokeWidth="1.5" strokeDasharray="5 5" />
          <Lbl x={x(c.goal) - 4} y={T + 10} a="end">
            100 K
          </Lbl>
        </g>
      )}
      {br && br[1] > br[0] && (
        <g>
          <line x1={r(x(br[0]))} x2={r(x(br[1]))} y1={T + 4} y2={T + 4} stroke={INK} strokeWidth="1.5" />
          <line x1={r(x(br[0]))} x2={r(x(br[0]))} y1={T + 1} y2={T + 7} stroke={INK} strokeWidth="1.5" />
          <line x1={r(x(br[1]))} x2={r(x(br[1]))} y1={T + 1} y2={T + 7} stroke={INK} strokeWidth="1.5" />
          <Lbl x={brRight ? x(br[0]) - 6 : x(br[1]) + 6} y={T + 8} a={brRight ? "end" : "start"} size={9}>
            MEAN ± SD · LOG
          </Lbl>
        </g>
      )}
      <g clipPath="url(#an-ecdf-clip)">
        <path d={d} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="miter" />
      </g>
      {c.beyond > 0 && (
        <Lbl x={W - R} y={y0 - 6} a="end">
          +{c.beyond} BEYOND →
        </Lbl>
      )}
      <Base />
      {c.ticks.map((t) => (
        <Lbl key={t} x={x(t)} y={H - 8}>
          {fmtK(t)}
        </Lbl>
      ))}
      {you && Number.isFinite(you.p) && you.x >= c.xMin && you.x <= c.xMax && (
        <g className="you">
          <line x1={L} x2={r(x(you.x))} y1={r(y(you.p))} y2={r(y(you.p))} stroke={WATER} strokeWidth="1.5" strokeDasharray="5 4" />
          <circle cx={r(x(you.x))} cy={r(y(you.p))} r="4.5" fill={WATER} stroke="#fff" strokeWidth="1" />
          <Tag x={x(you.x)} y={y(you.p) - 9} blue>
            {you.tag}
          </Tag>
        </g>
      )}
    </svg>
  );
}

/* -------------------------------------------------------- 6 · grinders */
export function GrindSvg({ c, you }: { c: GrindChart; you: GrindYou | null }) {
  if (c.pts.length < 3 || !(c.xMax > 0) || !(c.yMax > c.yMin) || !(c.yMin > 0)) return null;
  const x = (n: number) => L + (n / c.xMax) * PW;
  const ly = (v: number) => Math.log10(v);
  const y = (v: number) => T + (1 - (ly(v) - ly(c.yMin)) / (ly(c.yMax) - ly(c.yMin))) * PH;
  const y0 = y(c.yMin);
  const iso = c.iso.map((tot) => {
    /* y = total / sessions, drawn only where it crosses the plot. */
    const nLo = Math.max(0.5, tot / c.yMax);
    const nHi = Math.min(c.xMax, tot / c.yMin);
    if (nLo >= nHi) return null;
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const nn = nLo + ((nHi - nLo) * i) / 48;
      pts.push(`${i ? "L" : "M"}${r(x(nn))},${r(y(tot / nn))}`);
    }
    const atRight = nHi >= c.xMax;
    return { tot, d: pts.join(""), lx: atRight ? x(c.xMax) - 3 : x(nHi) - 3, lyy: atRight ? y(tot / c.xMax) - 4 : y0 - 4 };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sessions logged against mean meters per session, one dot per rower">
      {c.yTicks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={r(y(t))} y2={r(y(t))} stroke={GRID} strokeWidth="1" strokeDasharray={t === c.yMax ? undefined : "3 4"} />
          <Lbl x={L - 8} y={y(t) + 3} a="end">
            {fmtK(t)}
          </Lbl>
        </g>
      ))}
      {iso.map((s) =>
        s ? (
          <g key={s.tot}>
            <path d={s.d} fill="none" stroke={GRID} strokeWidth="1.5" strokeDasharray="4 4" />
            <Lbl x={s.lx} y={s.lyy} a="end" size={9}>
              {fmtK(s.tot)}
            </Lbl>
          </g>
        ) : null,
      )}
      {c.pts.map(([n, len], i) =>
        len >= c.yMin && len <= c.yMax ? (
          <circle key={i} cx={r(x(n))} cy={r(y(len))} r="3" fill={GRAY} opacity={you ? 0.3 : 0.5} />
        ) : null,
      )}
      {you && you.pt[1] >= c.yMin && you.pt[1] <= c.yMax && (
        <g className="you">
          <circle cx={r(x(you.pt[0]))} cy={r(y(you.pt[1]))} r="4.5" fill={WATER} stroke="#fff" strokeWidth="1" />
          <Lbl x={L + 6} y={T + 10} a="start" bold fill={WATER}>
            {you.tag}
          </Lbl>
        </g>
      )}
      <Lbl x={W - R} y={T + 10} a="end">
        {c.corner}
      </Lbl>
      <Base y0={y0} />
      {c.xTicks.map((t) => (
        <Lbl key={t} x={x(t)} y={H - 8}>
          {t}
        </Lbl>
      ))}
    </svg>
  );
}

/* --------------------------------------------------------- 7 · hours */
export function HoursSvg({ c, you }: { c: HourChart; you: HourYou | null }) {
  if (c.counts.length !== 24 || !(c.yMax > 0) || !c.counts.some((v) => v > 0)) return null;
  const slot = PW / 24;
  const pos = (h: number) => (((h - c.start) % 24) + 24) % 24;
  const xh = (h: number) => L + (pos(h) / 24) * PW;
  const y = (v: number) => T + (1 - v / c.yMax) * PH;
  const y0 = y(0);
  let peak = 0;
  for (let h = 1; h < 24; h++) if (c.counts[h] > c.counts[peak]) peak = h;
  const kdeLine =
    c.kdeGrid.length === c.kdeYs.length && c.kdeGrid.length > 1
      ? c.kdeGrid.map((g, i) => `${i ? "L" : "M"}${r(L + ((g - c.start) / 24) * PW)},${r(y(c.kdeYs[i]))}`).join("")
      : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sessions logged per hour of the day, Pacific, with a wrapped density">
      <GridY yMax={c.yMax} fmt={(v) => String(Math.round(v))} />
      {Array.from({ length: 24 }, (_, i) => {
        const h = (c.start + i) % 24;
        const v = c.counts[h];
        if (v <= 0) return null;
        const bx = L + i * slot + slot * 0.19;
        const bw = slot * 0.62;
        const bh = Math.max(y0 - y(v), 2);
        return v < SMALL ? (
          <rect key={h} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill="none" stroke={FIELD_EDGE} strokeWidth="1" strokeDasharray="2 2" />
        ) : (
          <rect key={h} x={r(bx)} y={r(y0 - bh)} width={r(bw)} height={r(bh)} fill={FIELD}>
            <title>{`${pad2(h)}:00–${pad2((h + 1) % 24)}:00 · ${v} sessions`}</title>
          </rect>
        );
      })}
      {kdeLine && <path d={kdeLine} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
      {c.counts[peak] >= SMALL && (
        <Lbl x={xh(peak) + slot / 2} y={Math.max(y(c.counts[peak]) - 5, 10)} size={11} bold fill={INK}>
          {c.counts[peak]}
        </Lbl>
      )}
      <Base />
      {[6, 12, 18, 0].map((h) => (
        <Lbl key={h} x={xh(h) + slot / 2} y={H - 8}>
          {pad2(h)}
        </Lbl>
      ))}
      {you && (
        <g className="you">
          <Rug xs={you.rug} x={xh} blue />
          {Number.isFinite(you.mean) && <VLine x={xh(you.mean)} dash="5 4" blue />}
          <Tag x={Number.isFinite(you.mean) ? xh(you.mean) : L} y={T + 24} blue>
            {you.tag}
          </Tag>
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------- 8 · sessions/day */
export function DaysSvg({ c, you }: { c: DayChart; you: DayYou | null }) {
  const span = c.counts.length;
  if (!span || !(c.yMax > 0) || !c.counts.some((v) => v > 0)) return null;
  const slot = PW / span;
  const xc = (i: number) => L + i * slot + slot / 2;
  const barW = slot * 0.62;
  const y = (v: number) => T + (1 - v / c.yMax) * PH;
  const y0 = y(0);
  let biggest = 0;
  for (let i = 1; i < span; i++) if (c.counts[i] > c.counts[biggest]) biggest = i;
  const roll =
    c.rolling.length === span && span > 1 ? c.rolling.map((v, i) => `${i ? "L" : "M"}${r(xc(i))},${r(y(v))}`).join("") : null;
  const byDay = new Map<number, number[]>();
  for (const dot of you?.dots ?? []) {
    const l = byDay.get(dot.day);
    if (l) l.push(dot.meters);
    else byDay.set(dot.day, [dot.meters]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sessions logged per September day with a seven-day rolling mean">
      {c.weekend.map((w, i) =>
        w ? <rect key={i} x={r(L + i * slot)} y={T} width={r(slot)} height={PH} fill={BAND2} /> : null,
      )}
      <GridY yMax={c.yMax} fmt={(v) => String(Math.round(v))} />
      {c.counts.map((v, i) => {
        if (v <= 0) return null;
        const bh = Math.max(y0 - y(v), 2);
        const bx = r(xc(i) - barW / 2);
        return v < SMALL ? (
          <rect key={i} x={bx} y={r(y0 - bh)} width={r(barW)} height={r(bh)} fill="none" stroke={FIELD_EDGE} strokeWidth="1" strokeDasharray="2 2" />
        ) : (
          <rect key={i} x={bx} y={r(y0 - bh)} width={r(barW)} height={r(bh)} fill={FIELD}>
            <title>{`Sept ${i + 1} · ${v} sessions`}</title>
          </rect>
        );
      })}
      {roll && <path d={roll} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
      {c.counts[biggest] >= SMALL && (
        <Lbl x={xc(biggest)} y={Math.max(y(c.counts[biggest]) - 5, 10)} size={11} bold fill={INK}>
          {c.counts[biggest]}
        </Lbl>
      )}
      <line x1={W - R} x2={W - R} y1={T} y2={r(y0)} stroke={INK} strokeWidth="1" strokeDasharray="2 3" />
      <Lbl x={W - R - 4} y={T + 10} a="end" size={9}>
        TODAY
      </Lbl>
      <Base />
      {dayTicks(span).map((d) => (
        <Lbl key={d} x={xc(d - 1)} y={H - 8}>
          {d === 1 ? "SEP 1" : d}
        </Lbl>
      ))}
      {you && (
        <g className="you">
          {[...byDay].map(([day, list]) =>
            list.map((m, j) => {
              const rr = 2 + 3 * Math.max(0, Math.min(1, (m - 1000) / 9000));
              const cx = xc(day - 1) + (j - (list.length - 1) / 2) * 7;
              return <circle key={`${day}-${j}`} cx={r(cx)} cy={r(y0 + 8)} r={r(rr)} fill={WATER} />;
            }),
          )}
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------- 9 · drift */
export function DriftSvg({ c, you }: { c: DriftChart; you: DriftYou | null }) {
  if (c.pts.length < 3 || !(c.yr > 0) || c.days < 1) return null;
  const span = Math.max(1, c.days);
  const slot = PW / span;
  const xd = (d: number) => L + (d - 1) * slot + slot / 2;
  /* Faster UP: −yr sits at the top of the frame. */
  const y = (v: number) => T + ((v + c.yr) / (2 * c.yr)) * PH;
  const wk = c.weekly;
  const band =
    wk.length >= 2
      ? `M${wk.map((p) => `${r(xd(p.x))},${r(y(p.med - p.sd))}`).join("L")}L${[...wk]
          .reverse()
          .map((p) => `${r(xd(p.x))},${r(y(p.med + p.sd))}`)
          .join("L")}Z`
      : null;
  const line = wk.length >= 2 ? wk.map((p, i) => `${i ? "L" : "M"}${r(xd(p.x))},${r(y(p.med))}`).join("") : null;
  const mine = you ? [...you.pts].sort((a, b) => a[0] - b[0]) : [];
  const myLine = mine.length >= 2 ? mine.map(([d, v], i) => `${i ? "L" : "M"}${r(xd(d))},${r(y(v))}`).join("") : null;
  const fitSeg = (f: FitLine) => {
    const d0 = mine[0][0];
    const d1 = mine[mine.length - 1][0];
    return { x1: r(xd(d0)), y1: r(y(f.a + f.b * d0)), x2: r(xd(d1)), y2: r(y(f.a + f.b * d1)) };
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Each session's split against the rower's own average, by day">
      <defs>
        <clipPath id="an-drift-clip">
          <rect x={L} y={T} width={PW} height={PH} />
        </clipPath>
      </defs>
      {[-c.yr, -c.yr / 2, 0, c.yr / 2, c.yr].map((t) => (
        <line key={t} x1={L} x2={W - R} y1={r(y(t))} y2={r(y(t))} stroke={t === 0 ? INK : GRID} strokeWidth={t === 0 ? 2 : 1} strokeDasharray={t === 0 ? undefined : "3 4"} />
      ))}
      {[-c.yr, 0, c.yr].map((t) => (
        <Lbl key={t} x={L - 8} y={y(t) + 3} a="end">
          {signedTick(t)}
        </Lbl>
      ))}
      {/* yr is the 97.5th percentile of the field, not the clip, so the far
       * tail (and a viewer's own outlier) is cut at the frame rather than
       * landing on the day labels. */}
      <g clipPath="url(#an-drift-clip)">
        {c.pts.map(([d, v], i) => (
          <circle key={i} cx={r(xd(d) + ((i % 5) - 2) * 1.6)} cy={r(y(v))} r="2.3" fill={GRAY} opacity={you && mine.length ? 0.2 : 0.35} />
        ))}
        {band && <path d={band} fill={BAND} />}
        {line && <path d={line} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
        {wk.map((p) => (
          <circle key={p.x} cx={r(xd(p.x))} cy={r(y(p.med))} r="3.5" fill={INK} />
        ))}
        {you && (
          <g className="you">
            {myLine && <path d={myLine} fill="none" stroke={WATER} strokeWidth="1.2" opacity="0.8" />}
            {you.fit && mine.length >= 2 && <line {...fitSeg(you.fit)} stroke={WATER} strokeWidth="1.5" strokeDasharray="5 4" />}
            {mine.map(([d, v], i) => (
              <circle key={i} cx={r(xd(d))} cy={r(y(v))} r="3.5" fill={WATER} stroke="#fff" strokeWidth="1" />
            ))}
          </g>
        )}
      </g>
      {you && (
        <g className="you">
          <Lbl x={L + 6} y={T + 10} a="start" bold fill={you.fit ? WATER : GRAY}>
            {you.tag}
          </Lbl>
        </g>
      )}
      <Lbl x={W - R} y={T + 10} a="end">
        {c.corner}
      </Lbl>
      <Lbl x={L - 8} y={T + 8} a="end" size={9}>
        FAST
      </Lbl>
      <Base />
      {dayTicks(span).map((d) => (
        <Lbl key={d} x={xd(d)} y={H - 8}>
          {d === 1 ? "SEP 1" : d}
        </Lbl>
      ))}
    </svg>
  );
}

/* --------------------------------------------------------- 10 · ladder */
export function LadderSvg({ c, you }: { c: LadderChart; you: LadderYou | null }) {
  if (!c.rows.length) return null;
  const ROW = 50;
  const HL = T + c.rows.length * ROW + 22;
  const x = (p: number) => L + (Math.max(0, Math.min(100, p)) / 100) * PW;
  return (
    <svg viewBox={`0 0 ${W} ${HL}`} role="img" aria-label="Six percentile strips: total meters, sessions, session length, split, efficiency, consistency">
      {c.rows.map((row, i) => {
        const top = T + i * ROW;
        const sy = top + 18;
        const p = you?.p[i] ?? null;
        return (
          <g key={row.key}>
            <Lbl x={L} y={top + 11} a="start" size={11} bold fill={INK}>
              {row.label}
            </Lbl>
            {p !== null ? (
              <g className="you">
                <Lbl x={W - R} y={top + 11} a="end" size={12} bold fill={WATER}>
                  P{Math.round(p)}
                </Lbl>
              </g>
            ) : (
              <Lbl x={W - R} y={top + 11} a="end" size={11}>
                —
              </Lbl>
            )}
            <rect x={L} y={r(sy)} width={PW} height={10} fill={BAND} />
            {row.dens.length >= 2 && (
              <path
                d={`M${r(x(0))},${r(sy + 10)}${row.dens
                  .map((dv, k) => `L${r(x((100 * k) / (row.dens.length - 1)))},${r(sy + 10 - 10 * Math.max(0, Math.min(1, dv)))}`)
                  .join("")}L${r(x(100))},${r(sy + 10)}Z`}
                fill={FIELD_EDGE}
                opacity="0.35"
              />
            )}
            {row.ticks.map((t) => (
              <g key={t.label}>
                <line x1={r(x(t.p))} x2={r(x(t.p))} y1={r(sy)} y2={r(sy + 10)} stroke={FIELD_EDGE} strokeWidth="1" />
                <Lbl x={x(t.p)} y={sy + 21} size={9}>
                  {t.label}
                </Lbl>
              </g>
            ))}
            <line x1={r(x(50))} x2={r(x(50))} y1={r(sy - 3)} y2={r(sy + 13)} stroke={INK} strokeWidth="1.5" />
            {p !== null && (
              <g className="you">
                <circle cx={r(x(p))} cy={r(sy + 5)} r="5.5" fill={WATER} stroke="#fff" strokeWidth="1.5" />
              </g>
            )}
          </g>
        );
      })}
      {[0, 50, 100].map((p) => (
        <Lbl key={p} x={x(p)} y={HL - 4} a={p === 0 ? "start" : p === 100 ? "end" : "middle"}>
          P{p}
        </Lbl>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------ 11 · fan */
export function FanSvg({ c, you }: { c: FanChart; you: FanYou | null }) {
  const days = c.days;
  if (days < 2 || [c.p10, c.p25, c.p50, c.p75, c.p90].some((s) => s.length !== days)) return null;
  const span = you?.proj ? 30 : days;
  const x = (d: number) => L + ((d - 1) / (span - 1)) * PW;
  const youTop = you ? Math.max(...you.cum, you.proj ? you.proj[1][1] : 0) : 0;
  const yMax = niceMax(Math.max(c.p90[days - 1], youTop, 1000));
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * PH;
  const y0 = y(0);
  const band = (lo: number[], hi: number[]) =>
    `M${lo.map((v, i) => `${r(x(i + 1))},${r(y(v))}`).join("L")}L${[...hi]
      .map((v, i) => `${r(x(i + 1))},${r(y(v))}`)
      .reverse()
      .join("L")}Z`;
  const med = c.p50.map((v, i) => `${i ? "L" : "M"}${r(x(i + 1))},${r(y(v))}`).join("");
  const abbr = (v: number) => fmtK(v).replace(" k", "K");
  const myLine = you && you.cum.length === days ? you.cum.map((v, i) => `${i ? "L" : "M"}${r(x(i + 1))},${r(y(v))}`).join("") : null;
  const last = you && you.cum.length === days ? you.cum[days - 1] : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumulative meters per rower as percentile bands, day by day">
      <GridY yMax={yMax} fmt={abbr} />
      <path d={band(c.p10, c.p90)} fill={BAND2} />
      <path d={band(c.p25, c.p75)} fill={BAND} />
      <path d={med} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {c.goal <= yMax && (
        <g>
          <line x1={L} x2={W - R} y1={r(y(c.goal))} y2={r(y(c.goal))} stroke={GRAY} strokeWidth="1.5" strokeDasharray="5 5" />
          <Lbl x={W - R - 2} y={y(c.goal) - 5} a="end">
            100 K
          </Lbl>
        </g>
      )}
      {days < 30 && (
        <g>
          <line x1={r(x(days))} x2={r(x(days))} y1={T} y2={r(y0)} stroke={INK} strokeWidth="1" strokeDasharray="2 3" />
          <Lbl x={span > days ? x(days) + 4 : x(days) - 4} y={T + 10} a={span > days ? "start" : "end"} size={9}>
            TODAY
          </Lbl>
        </g>
      )}
      {you && myLine && (
        <g className="you">
          {you.proj && (
            <line
              x1={r(x(you.proj[0][0]))}
              y1={r(y(you.proj[0][1]))}
              x2={r(x(you.proj[1][0]))}
              y2={r(y(you.proj[1][1]))}
              stroke={WATER}
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          )}
          <path d={myLine} fill="none" stroke={WATER} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={r(x(days))} cy={r(y(last))} r="4.5" fill={WATER} />
          <Tag x={x(days)} y={Math.max(y(last) - 10, T + 24)} blue>
            {you.label}
          </Tag>
        </g>
      )}
      <Base />
      {dayTicks(span).map((d) => (
        <Lbl key={d} x={x(d)} y={H - 8}>
          {d === 1 ? "SEP 1" : d}
        </Lbl>
      ))}
    </svg>
  );
}
