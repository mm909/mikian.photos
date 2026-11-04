import { LEGS, legChart, linePath } from "./map";

/* ONE LEG OF THE PLAN (owner, 2026-11-03: "We need to show not tell … break
 * down the route/plan on a map rather than w/ text") — a zoomed detail
 * chart: the leg rotated to its own horizontal, the real fine shoreline
 * (riverDataFine.ts) clipped around it, a tick bar and kilometer label at
 * each end. Pure server SVG, colors from the palette variables. */

function Tick({ p, q, txt, anchor }: { p: [number, number]; q: [number, number]; txt: string; anchor: "start" | "end" }) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const nx = (-(q[1] - p[1]) / L) * 9;
  const ny = ((q[0] - p[0]) / L) * 9;
  /* The label rides above its tick unless that would leave the canvas. */
  const ty = p[1] < 34 ? p[1] + 24 : p[1] - 13;
  return (
    <g>
      <path
        d={`M${(p[0] - nx).toFixed(1)} ${(p[1] - ny).toFixed(1)} L${(p[0] + nx).toFixed(1)} ${(p[1] + ny).toFixed(1)}`}
        stroke="var(--m-strong)"
        strokeWidth={3.5}
      />
      <text x={p[0]} y={ty} textAnchor={anchor} fill="var(--m-strong)" fontSize={10} fontWeight={700} letterSpacing={1}>
        {txt}
      </text>
    </g>
  );
}

export function LegMap({ leg }: { leg: (typeof LEGS)[number] }) {
  const c = legChart(leg.m0, leg.m1, leg.ex);
  const a = c.leg[0];
  const b = c.leg[c.leg.length - 1];
  return (
    <svg
      className="dd-map"
      viewBox={`0 0 ${c.vb.w} ${c.vb.h}`}
      role="img"
      aria-label={`Detail chart of the ${leg.title} leg, ${leg.range}.`}
    >
      {c.segs.map((seg, i) => (
        <path key={i} d={linePath(seg)} fill="none" stroke="var(--m-shore)" strokeWidth={1} strokeLinejoin="round" opacity={0.65} />
      ))}
      <path
        d={linePath(c.leg)}
        fill="none"
        stroke="var(--m-route)"
        strokeWidth={leg.routeW}
        strokeLinecap="round"
        strokeDasharray="7 8"
      />
      <Tick p={a} q={c.leg[1]} txt={leg.start} anchor="start" />
      <Tick p={b} q={c.leg[c.leg.length - 2]} txt={leg.end} anchor="end" />
    </svg>
  );
}
