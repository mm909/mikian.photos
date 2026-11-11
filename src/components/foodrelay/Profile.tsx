import type { Course } from "./types";

/* THE PROFILE — ground height along the course, a dot at every stop. The
 * heights come from a 90 m terrain model (scripts/food-relays/
 * build-courses.mjs), so this shows the shape of the day: where it climbs,
 * where it lets you go. It is not a climb total. */

const W = 1000;
const H = 210;
const TOP = 34;
const BOTTOM = 30;

export function Profile({ course, numbers = true, step = 10 }: { course: Course; numbers?: boolean; step?: number }) {
  const lo = course.lowFt - 60;
  const hi = course.highFt + 60;
  const x = (mi: number) => (mi / course.totalMi) * W;
  const y = (ft: number) => TOP + (1 - (ft - lo) / (hi - lo)) * (H - TOP - BOTTOM);
  const f = (n: number) => n.toFixed(1);
  const base = H - BOTTOM;
  const pts = course.profile.map(([mi, ft]) => `${f(x(mi))},${f(y(ft))}`);
  const ftAt = (mi: number) => course.profile.reduce((a, b) => (Math.abs(b[0] - mi) < Math.abs(a[0] - mi) ? b : a))[1];
  const last = course.stops.length;
  const marks = course.stops
    .map((s) => ({ n: s.n, mi: s.mi, end: s.n === 1 || (!course.loop && s.n === last) }))
    .concat(course.loop ? [{ n: 1, mi: course.totalMi, end: true }] : []);
  const ticks: number[] = [];
  for (let m = 0; m < course.totalMi - step * 0.35; m += step) ticks.push(m);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Elevation along the course, from ${course.lowFt.toLocaleString("en-US")} to ${course.highFt.toLocaleString("en-US")} feet.`}>
      <polygon className="p-area" points={`0,${base} ${pts.join(" ")} ${W},${base}`} />
      {marks.map((m, i) => (
        <line key={i} className="p-tick" x1={f(x(m.mi))} y1={f(y(ftAt(m.mi)))} x2={f(x(m.mi))} y2={base} />
      ))}
      <polyline className="p-line" points={pts.join(" ")} />
      <line className="p-base" x1="0" y1={base} x2={W} y2={base} />
      {marks.map((m, i) => (
        <g key={i}>
          <circle className={m.end ? "p-dot end" : "p-dot"} cx={f(x(m.mi))} cy={f(y(ftAt(m.mi)))} r={numbers ? 11 : 6} />
          {numbers && (
            <text className={m.end ? "p-num end" : "p-num"} x={f(x(m.mi))} y={f(y(ftAt(m.mi)) + 0.5)}>
              {m.n}
            </text>
          )}
        </g>
      ))}
      {ticks.map((m) => (
        <text key={m} className="p-ax" x={f(x(m) + (m === 0 ? 0 : -8))} y={H - 6}>
          {m === 0 ? "MILE 0" : m}
        </text>
      ))}
      <text className="p-ax" x={W} y={H - 6} textAnchor="end">
        {course.totalMi.toFixed(1)}
      </text>
    </svg>
  );
}
