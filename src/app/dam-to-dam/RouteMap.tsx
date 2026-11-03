import type { View } from "./look";
import { CHARTS, WAYPOINTS, hatchPath, linePath } from "./map";

/* THE CHART — the real river (map.ts) in the viewer's chosen projection,
 * drawn twice on the main page: bare in the hero, with the simulated dot
 * under WATCH LIVE. Pure server SVG: the crawl of the dashes is CSS
 * (theme.ts dd-flow), the pulse of the dot is SMIL, so nothing here ships
 * JavaScript. Every color is a --m- variable from theme.ts, so the
 * palette never touches this file.
 *
 * The iso view carries the 3D (owner, 2026-11-03: "a little
 * 3d/isometric"): each shoreline drawn three times — a rim lifted off the
 * ground plane, vertical hatching down to the waterline — high walls in
 * the canyon, low banks on the lake. The top view is the flat chart. */

const CANYON_H = 18;
const SHORE_H = 7;

export function RouteMap({ view, live }: { view: View; live?: number }) {
  const c = CHARTS[view];
  const iso = view === "iso";
  const dot = live === undefined ? null : c.pointAtMeters(live);
  const hv = c.river[0];
  const dv = c.river[c.river.length - 1];
  const canyonLabel = c.pointAtMeters(8_000);
  const lakeLabel = c.pointAtMeters(iso ? 70_000 : 62_000);

  return (
    <svg
      className="dd-map"
      viewBox={`0 0 ${c.vb.w} ${c.vb.h}`}
      role="img"
      aria-label={
        dot
          ? `The route chart with a simulated live position at ${live!.toLocaleString("en-US")} meters.`
          : "A line-art chart of the route: the Colorado River from Hoover Dam through Black Canyon and down Lake Mohave to Davis Dam, 100,000 meters."
      }
    >
      {/* Lake Mohave, then Black Canyon: in iso a rim, cliff hatching and
        * the waterline; flat waterlines in the top view. */}
      {iso && (
        <>
          <path d={linePath(c.shore, true)} fill="none" stroke="var(--m-rim)" strokeWidth={1} transform={`translate(0,${-SHORE_H})`} />
          <path d={hatchPath(c.shore, SHORE_H, 4)} stroke="var(--m-hatch)" strokeWidth={0.8} />
        </>
      )}
      <path d={linePath(c.shore, true)} fill="none" stroke="var(--m-shore)" strokeWidth={1.2} strokeLinejoin="round" />
      {iso && (
        <>
          <path d={linePath(c.canyon, true)} fill="none" stroke="var(--m-rim)" strokeWidth={1} transform={`translate(0,${-CANYON_H})`} />
          <path d={hatchPath(c.canyon, CANYON_H, 2)} stroke="var(--m-hatch)" strokeWidth={0.8} />
        </>
      )}
      <path d={linePath(c.canyon, true)} fill="none" stroke="var(--m-wall)" strokeWidth={1.2} strokeLinejoin="round" />

      {/* The route: 100,000 m, crawling (theme.ts dd-flow). */}
      <path
        className="dd-route"
        d={linePath(c.river)}
        fill="none"
        stroke="var(--m-route)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray="7 9"
      />

      {/* The dams: a bar across each end of the line. */}
      <path d={c.damBar("start")} stroke="var(--m-strong)" strokeWidth={5} />
      <path d={c.damBar("finish")} stroke="var(--m-strong)" strokeWidth={5} />
      {iso ? (
        <>
          <text x={hv[0] - 14} y={hv[1] - 30} fill="var(--m-strong)" fontSize={12} fontWeight={700} letterSpacing={2}>
            HOOVER DAM
          </text>
          <text x={hv[0] - 14} y={hv[1] - 16} fill="var(--m-dim)" fontSize={10}>
            START · 0 m
          </text>
          <text x={dv[0] + 18} y={dv[1] - 2} fill="var(--m-strong)" fontSize={12} fontWeight={700} letterSpacing={2}>
            DAVIS DAM
          </text>
          <text x={dv[0] + 18} y={dv[1] + 12} fill="var(--m-dim)" fontSize={10}>
            FINISH · 100,000 m
          </text>
        </>
      ) : (
        <>
          <text x={hv[0] + 24} y={hv[1] + 2} fill="var(--m-strong)" fontSize={12} fontWeight={700} letterSpacing={2}>
            HOOVER DAM
          </text>
          <text x={hv[0] + 24} y={hv[1] + 16} fill="var(--m-dim)" fontSize={10}>
            START · 0 m
          </text>
          <text x={dv[0] + 24} y={dv[1] + 2} fill="var(--m-strong)" fontSize={12} fontWeight={700} letterSpacing={2}>
            DAVIS DAM
          </text>
          <text x={dv[0] + 24} y={dv[1] + 16} fill="var(--m-dim)" fontSize={10}>
            FINISH · 100,000 m
          </text>
        </>
      )}

      {/* The water names. */}
      {iso ? (
        <>
          <text x={canyonLabel[0] + 30} y={canyonLabel[1] - 60} fill="var(--m-mute)" fontSize={10} letterSpacing={2}>
            BLACK CANYON
          </text>
          <text x={lakeLabel[0] - 40} y={lakeLabel[1] + 78} textAnchor="middle" fill="var(--m-mute)" fontSize={10} letterSpacing={2}>
            LAKE MOHAVE
          </text>
        </>
      ) : (
        <>
          <text x={canyonLabel[0] - 70} y={canyonLabel[1] + 4} textAnchor="end" fill="var(--m-mute)" fontSize={10} letterSpacing={2}>
            BLACK CANYON
          </text>
          <text x={lakeLabel[0] + 90} y={lakeLabel[1] + 4} fill="var(--m-mute)" fontSize={10} letterSpacing={2}>
            LAKE MOHAVE
          </text>
        </>
      )}

      {/* The named stops, hung off their real meters — the same scale the
        * live dot reads, so the chart never argues with the tracker. */}
      {WAYPOINTS.map((wp) => {
        const p = c.pointAtMeters(wp.m);
        if (iso) {
          const ly = p[1] + (wp.dy > 0 ? 46 : -40);
          return (
            <g key={wp.name}>
              <circle cx={p[0]} cy={p[1]} r={2.5} fill="none" stroke="var(--m-strong)" strokeWidth={1} />
              <path
                d={`M${p[0]} ${p[1] + (wp.dy > 0 ? 5 : -5)} L${p[0]} ${ly + (wp.dy > 0 ? -13 : 7)}`}
                stroke="var(--m-rim)"
                strokeWidth={0.7}
              />
              <text x={p[0]} y={ly} textAnchor="middle" fill="var(--m-waypt)" fontSize={10} letterSpacing={1}>
                {wp.name} · {wp.km} km
              </text>
            </g>
          );
        }
        const lx = p[0] + wp.dx * 26;
        return (
          <g key={wp.name}>
            <circle cx={p[0]} cy={p[1]} r={2.5} fill="none" stroke="var(--m-strong)" strokeWidth={1} />
            <path d={`M${p[0] + wp.dx * 6} ${p[1]} L${lx - wp.dx * 6} ${p[1]}`} stroke="var(--m-rim)" strokeWidth={0.7} />
            <text x={lx} y={p[1] + 3.5} textAnchor={wp.dx > 0 ? "start" : "end"} fill="var(--m-waypt)" fontSize={10} letterSpacing={1}>
              {wp.name} · {wp.km} km
            </text>
          </g>
        );
      })}

      {/* Chart furniture: true north on this sheet, and 10 km of it. */}
      <path d={`M${c.vb.w - 60} 70 l${c.north[0].toFixed(1)} ${c.north[1].toFixed(1)}`} stroke="var(--m-furn)" strokeWidth={1.2} />
      <text x={c.vb.w - 60 + c.north[0] * 1.4} y={70 + c.north[1] * 1.4} textAnchor="middle" fill="var(--m-furn)" fontSize={10}>
        N
      </text>
      <path
        d={`M40 ${c.vb.h - 30} l0 8 m0 -4 l${c.scale10k.toFixed(1)} 0 m0 -4 l0 8`}
        stroke="var(--m-furn)"
        strokeWidth={1}
        fill="none"
      />
      <text x={40 + c.scale10k / 2} y={c.vb.h - 14} textAnchor="middle" fill="var(--m-furn)" fontSize={9} letterSpacing={2}>
        10 KM
      </text>

      {/* The dot — simulated today, the boat on race day. SMIL pulse so
        * the demo breathes without a byte of script. */}
      {dot && live !== undefined && (
        <g>
          <circle cx={dot[0]} cy={dot[1]} r={6} fill="none" stroke="var(--m-dot)" strokeWidth={1.2} opacity={0.7}>
            <animate attributeName="r" values="6;17" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={dot[0]} cy={dot[1]} r={4.5} fill="var(--m-dot)" />
          {iso ? (
            <>
              <path d={`M${dot[0]} ${dot[1] - 7} L${dot[0]} ${dot[1] - 22}`} stroke="var(--m-leader)" strokeWidth={0.8} />
              <text x={dot[0]} y={dot[1] - 41} textAnchor="middle" fill="var(--m-dot)" fontSize={9} letterSpacing={3}>
                LIVE
              </text>
              <text x={dot[0]} y={dot[1] - 28} textAnchor="middle" fill="var(--m-meters)" fontSize={11}>
                {live.toLocaleString("en-US")} m
              </text>
            </>
          ) : (
            <>
              <text x={dot[0] - 16} y={dot[1] - 6} textAnchor="end" fill="var(--m-dot)" fontSize={9} letterSpacing={3}>
                LIVE
              </text>
              <text x={dot[0] - 16} y={dot[1] + 8} textAnchor="end" fill="var(--m-meters)" fontSize={11}>
                {live.toLocaleString("en-US")} m
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}
