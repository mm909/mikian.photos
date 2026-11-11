import type { Course } from "@/components/foodrelay/types";
import { I5, LAKES, LAND, RIVERS } from "./baseData";

/* THE STRIP — Seattle to Portland on one tall sheet, north at the top.
 * The route is three and a half times as tall as it is wide, so the chart
 * is too: on a phone it fills the width and scrolls, on a desktop it
 * stands beside the list of legs, which is about as long.
 *
 * Under the line, faint: Puget Sound, Lake Washington, the Columbia and
 * its rivers, and Interstate 5 (scripts/food-relays/build-northwest.mjs).
 * The shoreline is Natural Earth's, drawn for a map of a continent: a
 * sketch at this size, there so the line reads as a place. The street map
 * lower on the page is the one to navigate by.
 *
 * The line is the page's first colour in Washington and its second in
 * Oregon: emerald out of the Emerald City, rose into the Rose City. It
 * changes on the Interstate Bridge, where the state does. (A fade down
 * the whole sheet was tried first: green into rose goes through grey.)
 *
 * Server-rendered SVG, 1000 units wide whatever the screen. Type is sized
 * in look.ts and drawn big at every width, so the label offsets below
 * hold on a phone. */

const K = Math.cos((46.57 * Math.PI) / 180);
const W = 1000;
/* Room for the names: every label sits to the right of its dot. */
const PAD = { l: 92, r: 336, t: 112, b: 150 };
const MI_IN_DEG_LAT = 1609.344 / 110540;

/* A label's nudge from its default seat, right of the dot. */
export type Nudge = { dx?: number; dy?: number };

const RIVER_W: Record<string, number> = { Columbia: 12, Willamette: 6, Cowlitz: 4 };

export function StripMap({ course, label, nudge = {} }: { course: Course; label: string; nudge?: Record<number, Nudge> }) {
  const lons = course.line.map((p) => p[0]);
  const lats = course.line.map((p) => p[1]);
  const lonMin = Math.min(...lons);
  const lonMax = Math.max(...lons);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const S = (W - PAD.l - PAD.r) / ((lonMax - lonMin) * K);
  const H = Math.round((latMax - latMin) * S + PAD.t + PAD.b);
  const px = (lon: number) => PAD.l + (lon - lonMin) * K * S;
  const py = (lat: number) => PAD.t + (latMax - lat) * S;
  const f = (n: number) => n.toFixed(1);
  const pts = (line: number[][]) => line.map(([lon, lat]) => `${f(px(lon))},${f(py(lat))}`).join(" ");
  const seen = (line: number[][]) => line.some(([lon, lat]) => px(lon) > -60 && px(lon) < W + 60 && py(lat) > -60 && py(lat) < H + 60);

  const last = course.stops.length;
  const scaleLen = 10 * MI_IN_DEG_LAT * S;

  /* The state line, on this course, is the Columbia under the Interstate
   * Bridge: the last stop in Washington and the first in Oregon stand on
   * either bank. The line changes colour between them. */
  const firstOr = course.stops.find((s) => s.city.endsWith("OR"));
  const lastWa = firstOr ? course.stops[firstOr.n - 2] : undefined;
  const turn = firstOr && lastWa ? (latMax - (firstOr.lat + lastWa.lat) / 2) / (latMax - latMin) : 1;

  /* The freeway's badge sits on the freeway, at the latitude where it
   * runs furthest from the route (the Nisqually flats, north of Olympia). */
  const shield = I5.flat().reduce((a, b) => (Math.abs(b[1] - 47.06) < Math.abs(a[1] - 47.06) ? b : a), [0, 0]);

  /* Mount St. Helens is on the sheet. Mount Rainier is just off its right
   * edge, so it gets a pointer instead of a wrong position. */
  const helens = { x: px(-122.1956), y: py(46.1914) };
  const rainierY = py(46.8523);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="sp-fade" gradientUnits="userSpaceOnUse" x1="0" y1={f(py(latMax))} x2="0" y2={f(py(latMin))}>
          <stop offset="0" style={{ stopColor: "var(--a)" }} />
          <stop offset={(turn - 0.004).toFixed(4)} style={{ stopColor: "var(--a)" }} />
          <stop offset={(turn + 0.004).toFixed(4)} style={{ stopColor: "var(--b)" }} />
          <stop offset="1" style={{ stopColor: "var(--b)" }} />
        </linearGradient>
        <clipPath id="sp-sheet">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath="url(#sp-sheet)">
        <rect className="s-water" x="0" y="0" width={W} height={H} />
        {LAND.filter(seen).map((ring, i) => (
          <polygon key={i} className="s-land" points={pts(ring)} />
        ))}
        {LAKES.filter((l) => seen(l.ring)).map((l, i) => (
          <polygon key={i} className="s-lake" points={pts(l.ring)} />
        ))}
        {RIVERS.filter((r) => seen(r.line)).map((r, i) => (
          <polyline key={i} className="s-river" strokeWidth={RIVER_W[r.name] ?? 3} points={pts(r.line)} />
        ))}
        {I5.filter(seen).map((piece, i) => (
          <polyline key={i} className="s-i5" points={pts(piece)} />
        ))}
        <g className="s-shield" transform={`translate(${f(px(shield[0]))},${f(py(shield[1]))})`} aria-hidden="true">
          <rect x="-19" y="-17" width="38" height="34" rx="9" />
          <text x="0" y="1">
            5
          </text>
        </g>

        <g aria-hidden="true">
          <text className="s-area" x={f(px(-122.42))} y={f(py(46.56))}>
            WASHINGTON
          </text>
          <text className="s-area" x={f(px(-123.05))} y={f(py(45.66))}>
            OREGON
          </text>
          <text className="s-wet" x={f(px(-122.62))} y={f(py(47.5))} textAnchor="middle">
            <tspan x={f(px(-122.62))}>Puget</tspan>
            <tspan x={f(px(-122.62))} dy="27">
              Sound
            </tspan>
          </text>
          <g className="s-peak" transform={`translate(${f(helens.x)},${f(helens.y)})`}>
            <path d="M-36,22 L-6,-24 L2,-17 L9,-25 L38,22 Z" />
            <path className="snow" d="M-15.8,-9 L-6,-24 L2,-17 L9,-25 L19,-9 L10,-13 L2,-5 L-6,-12 Z" />
          </g>
          <text className="s-area sm" x={f(helens.x)} y={f(helens.y + 52)} textAnchor="middle">
            MT ST HELENS
          </text>
          <text className="s-area sm" x={W - 24} y={f(rainierY)} textAnchor="end">
            MT RAINIER →
          </text>
        </g>

        <polyline className="s-case" points={pts(course.line)} />
        <polyline className="s-route" stroke="url(#sp-fade)" points={pts(course.line)} />

        {course.stops.map((s) => {
          const x = px(s.lon);
          const y = py(s.lat);
          const start = s.n === 1;
          const finish = s.n === last;
          const n = nudge[s.n] ?? {};
          const lx = x + (start || finish ? 30 : 24) + (n.dx ?? 0);
          const ly = y + 13 + (n.dy ?? 0);
          return (
            <g key={s.n}>
              <circle className={start ? "s-dot start" : finish ? "s-dot finish" : "s-dot"} cx={f(x)} cy={f(y)} r={start || finish ? 17 : 10}>
                <title>{`${s.name}, ${s.address}. Mile ${s.mi.toFixed(1)}.`}</title>
              </circle>
              <g aria-hidden="true">
                <text className="s-name" x={f(lx)} y={f(ly)}>
                  {s.name.toUpperCase()}
                  {!start && (
                    <tspan className="mi" dx="12">
                      {s.mi.toFixed(0)}
                    </tspan>
                  )}
                </text>
                {(start || finish) && (
                  <text className="s-tag" x={f(lx)} y={f(ly + 31)}>
                    {start ? `START · ${s.address.toUpperCase()}` : `FINISH · ${s.address.toUpperCase()}`}
                  </text>
                )}
              </g>
            </g>
          );
        })}

        <g className="s-scale" transform={`translate(34,${H - 44})`} aria-hidden="true">
          <line x1="0" y1="0" x2={f(scaleLen)} y2="0" />
          <line x1="0" y1="-9" x2="0" y2="9" />
          <line x1={f(scaleLen)} y1="-9" x2={f(scaleLen)} y2="9" />
          <text x={f(scaleLen + 14)} y="9">
            10 MILES
          </text>
        </g>
        <text className="s-key" x={W - 28} y={H - 35} textAnchor="end" aria-hidden="true">
          NUMBERS ARE MILES FROM THE START
        </text>
      </g>
    </svg>
  );
}
