import type { Course } from "./types";
import { VEGAS_ROADS } from "./vegasRoads";

/* THE CHART — the course as line art on paper: the valley freeways faint
 * underneath (how anyone in Las Vegas finds themselves on a map), the
 * route in the event colour, a numbered dot per stop. Server-rendered SVG,
 * no tiles and no script. Flat projection at the valley's latitude; at
 * this size the error is under a pixel.
 *
 * Sizes that have to stay readable on a phone (dot radius, type) are set
 * in theme.ts, where a media query can grow them: the chart is 1000 units
 * wide whatever the screen. */

const K = Math.cos((36.15 * Math.PI) / 180);
const W = 1000;
const MI_IN_DEG_LAT = 1609.344 / 110540;

/* Where a stop's label sits, from the middle of its dot. `name` and `tag`
 * replace the two lines the chart would write; null leaves that line off. */
export type LabelPos = {
  dx: number;
  dy: number;
  anchor?: "start" | "middle" | "end";
  name?: string | null;
  tag?: string | null;
};
export type Place = { name: string; lat: number; lon: number };

export function CourseMap({
  course,
  brand,
  label,
  pad = { t: 0.07, r: 0.07, b: 0.07, l: 0.07 },
  names = false,
  labelPos = {},
  areas = [],
  shields = [],
  arrowEvery = 1,
  size = "regular",
}: {
  course: Course;
  brand: string;
  /** What a screen reader hears instead of the drawing. */
  label: string;
  /** Margin around the route, as a fraction of its longer side. */
  pad?: { t: number; r: number; b: number; l: number };
  /** Write the name and mile mark beside each dot, or beside the listed
   * stop numbers only. */
  names?: boolean | number[];
  labelPos?: Record<number, LabelPos>;
  areas?: Place[];
  shields?: Place[];
  /** One direction arrow per this many hops. */
  arrowEvery?: number;
  /** "large" draws dots and type big at every width (theme.ts): for a
   * chart that names a handful of stops. */
  size?: "regular" | "large";
}) {
  const us = course.line.map((p) => p[0] * K);
  const vs = course.line.map((p) => p[1]);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const span = Math.max(uMax - uMin, vMax - vMin);
  const u0 = uMin - pad.l * span;
  const u1 = uMax + pad.r * span;
  const v0 = vMin - pad.b * span;
  const v1 = vMax + pad.t * span;
  const S = W / (u1 - u0);
  const H = Math.round((v1 - v0) * S);
  const px = (lon: number) => (lon * K - u0) * S;
  const py = (lat: number) => (v1 - lat) * S;
  const f = (n: number) => n.toFixed(1);
  const inBox = (lon: number, lat: number, m = 0) => {
    const x = px(lon);
    const y = py(lat);
    return x > -m && x < W + m && y > -m && y < H + m;
  };

  const P = course.line.map(([lon, lat]) => [px(lon), py(lat)]);
  const routePts = P.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
  const roads = VEGAS_ROADS.filter((piece) => piece.some(([lon, lat]) => inBox(lon, lat, 40)));

  /* Direction arrows at the middle of a hop, found by mile mark along the
   * drawn line (the drawn length tracks the miles closely enough to put an
   * arrow mid-hop). */
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const drawn = cum[cum.length - 1];
  const at = (mi: number) => {
    const target = (mi / course.totalMi) * drawn;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const t = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    /* Aim along a longer chord than one segment, so a jog at a corner
     * does not spin the arrow. */
    const a = P[Math.max(0, i - 3)];
    const b = P[Math.min(P.length - 1, i + 2)];
    return {
      x: P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t,
      y: P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t,
      deg: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
    };
  };
  const ends = course.stops.map((s) => s.mi).concat(course.loop ? [course.totalMi] : []);
  const arrows = ends
    .slice(1)
    .map((mi, i) => ({ mid: (ends[i] + mi) / 2, i }))
    .filter(({ i }) => i % arrowEvery === Math.floor(arrowEvery / 2))
    .map(({ mid }) => at(mid));

  const last = course.stops.length;
  const scaleLen = 5 * MI_IN_DEG_LAT * S;

  /* Two stores a few blocks apart would print one dot on top of the other
   * (the Strip has three In-N-Outs inside a mile and a half). Dots that
   * overlap are eased apart until they just clear: a nudge of a few
   * hundred meters at most, on a chart nobody navigates by. */
  const R = size === "large" ? 23 : 16;
  const dot = course.stops.map((s) => ({ x: px(s.lon), y: py(s.lat) }));
  for (let pass = 0; pass < 16; pass++)
    for (let i = 0; i < dot.length; i++)
      for (let k = i + 1; k < dot.length; k++) {
        const dx = dot[k].x - dot[i].x;
        const dy = dot[k].y - dot[i].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const need = 2 * R + 2;
        if (d >= need) continue;
        const push = (need - d) / 2;
        dot[i].x -= (dx / d) * push;
        dot[i].y -= (dy / d) * push;
        dot[k].x += (dx / d) * push;
        dot[k].y += (dy / d) * push;
      }

  return (
    <svg className={`m-${size}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <rect className="m-bg" x="0" y="0" width={W} height={H} />
      {roads.map((piece, i) => (
        <polyline key={i} className="m-road" points={piece.map(([lon, lat]) => `${f(px(lon))},${f(py(lat))}`).join(" ")} />
      ))}
      {areas
        .filter((a) => inBox(a.lon, a.lat))
        .map((a) => (
          <text key={a.name} className="m-area" x={f(px(a.lon))} y={f(py(a.lat))}>
            {a.name.toUpperCase()}
          </text>
        ))}
      {shields
        .filter((s) => inBox(s.lon, s.lat))
        .map((s, i) => {
          const w = 14 + s.name.length * 9;
          return (
            <g key={i} className="m-shield" transform={`translate(${f(px(s.lon))},${f(py(s.lat))})`}>
              <rect x={-w / 2} y={-11} width={w} height={22} rx={6} />
              <text x="0" y="0.5">
                {s.name}
              </text>
            </g>
          );
        })}
      <polyline className="m-case" points={routePts} />
      <polyline className="m-route" points={routePts} />
      {arrows.map((a, i) => (
        <path key={i} className="m-arrow" d={size === "large" ? "M-12,-11 L12,0 L-12,11 Z" : "M-9,-8 L9,0 L-9,8 Z"} transform={`translate(${f(a.x)},${f(a.y)}) rotate(${f(a.deg)})`} />
      ))}
      {/* Drawn last to first so stop 1 sits on top where dots crowd. */}
      {[...course.stops].reverse().map((s) => {
        const { x, y } = dot[s.n - 1];
        const end = s.n === 1 || (!course.loop && s.n === last);
        const lp: LabelPos = labelPos[s.n] ?? { dx: 26, dy: 0, anchor: "start" };
        const tag =
          s.n === 1 ? (course.loop ? "START + FINISH" : "START") : !course.loop && s.n === last ? `FINISH · MILE ${s.mi.toFixed(1)}` : `MILE ${s.mi.toFixed(1)}`;
        return (
          <g key={s.n}>
            <g className={end ? "m-stop end" : "m-stop"}>
              <title>{`${s.n}. ${brand} ${s.name}, ${s.address}. Mile ${s.mi.toFixed(1)}.`}</title>
              <circle cx={f(x)} cy={f(y)} r="16" />
              <text x={f(x)} y={f(y + 1)}>
                {s.n}
              </text>
            </g>
            {(names === true || (Array.isArray(names) && names.includes(s.n))) && (
              <g textAnchor={lp.anchor ?? "start"} aria-hidden="true">
                {lp.name !== null && (
                  <text className="m-name" x={f(x + lp.dx)} y={f(y + lp.dy - 4)}>
                    {(lp.name ?? s.name).toUpperCase()}
                  </text>
                )}
                {lp.tag !== null && (
                  <text
                    className="m-mile"
                    x={f(x + lp.dx)}
                    y={f(y + lp.dy + (lp.name === null ? 8 : size === "large" ? 27 : 22))}
                  >
                    {lp.tag ?? tag}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
      <g className="m-scale" transform={`translate(28,${H - 30})`} aria-hidden="true">
        <line x1="0" y1="0" x2={f(scaleLen)} y2="0" />
        <line x1="0" y1="-7" x2="0" y2="7" />
        <line x1={f(scaleLen)} y1="-7" x2={f(scaleLen)} y2="7" />
        <text x={f(scaleLen + 12)} y="6">
          5 MILES
        </text>
      </g>
    </svg>
  );
}
