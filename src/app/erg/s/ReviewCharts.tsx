import { fmtSplit, type AnalysisForce, type AnalysisSplit, type AnalysisStroke, type AnalysisTrend } from "@/lib/pm5/analysis";

/* THE REVIEW CHARTS (owner, 2026-09-17: the post hoc analysis screen).
 * Four pictures of a finished piece, inline SVG, no library and no client
 * JavaScript at all — these are server components, so the page arrives
 * drawn.
 *
 * MONOCHROME PLUS THE ONE BLUE, the way the sheet next door sets it up:
 * blue is this piece, grey dashed is whatever it is being measured
 * against — the average, the trend, the best piece saved before it.
 *
 * The scales live here rather than in analysis.ts because they are
 * drawing decisions, not facts about the row. Everything they are handed
 * is already worked out. */

const W = 520;
const PAD = { l: 48, r: 14, t: 16, b: 30 };

/* About four round labels on an axis. */
function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function Panel({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={wide ? "rv-panel rv-wide" : "rv-panel"}>
      <div className="rv-ptitle">
        <b>{title}</b>
        {note ? <span>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ height, text }: { height: number; text: string }) {
  return (
    <svg className="rv-svg" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={text}>
      <text className="empty" x={W / 2} y={height / 2} textAnchor="middle">
        {text}
      </text>
    </svg>
  );
}

/* ---- split by split --------------------------------------------------- */

/* TALLER IS SLOWER. The bars are splits, so the axis is upside down by
 * nature: a tall bar is time spent. The baseline is not zero and the axis
 * says so — every tick is a split, and the dashed rule is the average of
 * the piece. */
export function SplitBars({ splits, avgTenths, derived }: { splits: AnalysisSplit[]; avgTenths: number | null; derived: boolean }) {
  const pts = splits.filter((s) => typeof s.paceTenths === "number" && (s.paceTenths as number) > 0);
  const note = derived ? `${pts.length} · cut from the tick stream` : `${pts.length} · as the monitor recorded them`;
  if (pts.length < 2) {
    return (
      <Panel title="Split by split" note={note} wide>
        <Empty height={200} text="NO SPLITS ON THIS PIECE" />
      </Panel>
    );
  }

  const H = 210;
  const values = pts.map((s) => s.paceTenths as number);
  const avg = avgTenths ?? values.reduce((a, b) => a + b, 0) / values.length;
  const rawLo = Math.min(...values, avg);
  const rawHi = Math.max(...values, avg);
  const span = Math.max(rawHi - rawLo, 10);
  const lo = rawLo - span * 0.45;
  const hi = rawHi + span * 0.25;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const slot = pw / pts.length;
  const barW = Math.max(3, slot * 0.66);
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;
  const label = pts.length <= 14 ? 1 : Math.ceil(pts.length / 10);

  return (
    <Panel title="Split by split" note={note} wide>
      <svg className="rv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Every split of the piece, taller is slower">
        {ticks(lo, hi, 4).map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="ax" x={PAD.l - 6} y={sy(v) + 3} textAnchor="end">
              {fmtSplit(v)}
            </text>
          </g>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />

        {pts.map((s, i) => {
          const x = PAD.l + i * slot + slot / 2;
          const y = sy(s.paceTenths as number);
          const slower = (s.paceTenths as number) > avg;
          return (
            <g key={`${s.n}-${s.endMeters}`}>
              <rect className={slower ? "bar bar-hi" : "bar"} x={x - barW / 2} y={y} width={barW} height={H - PAD.b - y} />
              {i % label === 0 ? (
                <>
                  <text className="barlab" x={x} y={y - 4} textAnchor="middle">
                    {fmtSplit(s.paceTenths)}
                  </text>
                  <text className="ax" x={x} y={H - PAD.b + 11} textAnchor="middle">
                    {s.endMeters.toLocaleString("en-US")}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={sy(avg)} y2={sy(avg)} />
        <text className="axl" x={W - PAD.r} y={sy(avg) - 4} textAnchor="end">
          Average {fmtSplit(avg)}
        </text>
        <text className="axl" x={W - PAD.r} y={H - 4} textAnchor="end">
          Metres
        </text>
        <text className="axl" x={PAD.l} y={PAD.t - 5} textAnchor="start">
          Split per 500 m · taller is slower
        </text>
      </svg>
    </Panel>
  );
}

/* ---- rate against length ---------------------------------------------- */

/* Two things on one picture because they are one thing: rate solid on the
 * left axis, metres per stroke dashed on the right. A piece that holds
 * its speed by shortening and rating up shows here as the lines crossing
 * away from each other. */
export function RateLength({ series }: { series: AnalysisStroke[] }) {
  const rate = series.filter((s) => s.counted && typeof s.spm === "number").map((s) => ({ x: s.n, y: s.spm as number }));
  const len = series.filter((s) => s.counted && typeof s.mps === "number").map((s) => ({ x: s.n, y: s.mps as number }));
  if (rate.length < 3 && len.length < 3) {
    return (
      <Panel title="Rate and length" note="strokes a minute · metres a stroke">
        <Empty height={200} text="NOT ENOUGH STROKES" />
      </Panel>
    );
  }

  const H = 200;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const all = [...rate, ...len];
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x), x0 + 1);
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;

  const band = (vals: number[], pad = 0.12) => {
    if (!vals.length) return { lo: 0, hi: 1 };
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi === lo) {
      lo -= 1;
      hi += 1;
    }
    const air = (hi - lo) * pad;
    return { lo: lo - air, hi: hi + air };
  };
  const rb = band(rate.map((p) => p.y));
  const lb = band(len.map((p) => p.y));
  const syR = (v: number) => PAD.t + (1 - (v - rb.lo) / (rb.hi - rb.lo)) * ph;
  const syL = (v: number) => PAD.t + (1 - (v - lb.lo) / (lb.hi - lb.lo)) * ph;
  const path = (pts: { x: number; y: number }[], sy: (v: number) => number) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

  return (
    <Panel title="Rate and length" note="rate solid · length dashed">
      <svg className="rv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stroke rate and metres per stroke through the piece">
        {ticks(rb.lo, rb.hi, 4).map((v) => (
          <g key={`r${v}`}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={syR(v)} y2={syR(v)} />
            <text className="ax" x={PAD.l - 6} y={syR(v) + 3} textAnchor="end">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        {ticks(lb.lo, lb.hi, 4).map((v) => (
          <text key={`l${v}`} className="ax" x={W - PAD.r + 3} y={syL(v) + 3} textAnchor="start">
            {v.toFixed(1)}
          </text>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {rate.length > 1 ? <path className="ln" d={path(rate, syR)} /> : null}
        {len.length > 1 ? <path className="ln2" d={path(len, syL)} /> : null}
        {ticks(x0, x1, 4).map((v) => (
          <text key={`x${v}`} className="ax" x={sx(v)} y={H - PAD.b + 11} textAnchor="middle">
            {Math.round(v)}
          </text>
        ))}
        <text className="axl" x={PAD.l} y={PAD.t - 5} textAnchor="start">
          Strokes a minute
        </text>
        <text className="axl" x={W - PAD.r} y={PAD.t - 5} textAnchor="end">
          Metres a stroke
        </text>
        <text className="axl" x={W - PAD.r} y={H - 4} textAnchor="end">
          Stroke
        </text>
      </svg>
    </Panel>
  );
}

/* ---- the force curve --------------------------------------------------- */

/* THE AVERAGE STROKE of the piece, filled, with the peak marked and said
 * in words: where it sits along the drive is the number that moves when
 * the legs come in earlier. The dashed curve behind it, when there is
 * one, is the best piece already saved at this distance — the same axis,
 * because both are stretched onto their own drive. */
export function ForceCurves({ force, compare }: { force: AnalysisForce | null; compare: { title: string; force: AnalysisForce } | null }) {
  if (!force) {
    return (
      <Panel title="Force curve" note="average stroke">
        <Empty height={200} text="NO FORCE CURVES ON THIS PIECE" />
      </Panel>
    );
  }
  const H = 200;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const hi = Math.max(force.peakLbf, compare?.force.peakLbf ?? 0, 1) * 1.12;
  const sx = (i: number, n: number) => PAD.l + (i / (n - 1)) * pw;
  const sy = (v: number) => PAD.t + (1 - v / hi) * ph;
  const line = (pts: number[]) => pts.map((v, i) => `${i ? "L" : "M"}${sx(i, pts.length).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  const n = force.points.length;
  const area = `${line(force.points)} L${sx(n - 1, n).toFixed(1)} ${sy(0).toFixed(1)} L${sx(0, n).toFixed(1)} ${sy(0).toFixed(1)} Z`;
  const px = sx(force.peakIndex, n);
  const py = sy(force.peakLbf);
  const right = px > W * 0.55;

  return (
    <Panel title="Force curve" note={`${force.curves} strokes averaged`}>
      <svg className="rv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average force curve of the piece">
        {ticks(0, hi, 4).map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="ax" x={PAD.l - 6} y={sy(v) + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {compare ? <path className="ln2" d={line(compare.force.points)} /> : null}
        <path className="area" d={area} />
        <path className="ln" d={line(force.points)} />
        <circle className="dot" cx={px} cy={py} r={3.4} />
        <text className="peak" x={px + (right ? -7 : 7)} y={py - 7} textAnchor={right ? "end" : "start"}>
          Peak {force.peakLbf.toFixed(0)} lbf at {force.peakPct.toFixed(0)}% of the drive
        </text>
        {[0, 25, 50, 75, 100].map((p) => (
          <text key={p} className="ax" x={PAD.l + (p / 100) * pw} y={H - PAD.b + 11} textAnchor="middle">
            {p}
          </text>
        ))}
        <text className="axl" x={PAD.l} y={PAD.t - 5} textAnchor="start">
          Pounds of force
        </text>
        <text className="axl" x={W - PAD.r} y={H - 4} textAnchor="end">
          Percent of the drive
        </text>
        {compare ? (
          <text className="axl" x={W - PAD.r} y={PAD.t - 5} textAnchor="end">
            Dashed: {compare.title}
          </text>
        ) : null}
      </svg>
    </Panel>
  );
}

/* ---- work per stroke --------------------------------------------------- */

/* One dot a stroke and the least squares line through them. A piece that
 * held together is a flat line; one that came apart slopes. */
export function WorkPerStroke({ series, trend }: { series: AnalysisStroke[]; trend: AnalysisTrend | null }) {
  const pts = series.filter((s) => s.counted && typeof s.workJ === "number").map((s) => ({ x: s.n, y: s.workJ as number }));
  if (pts.length < 3) {
    return (
      <Panel title="Work per stroke" note="joules">
        <Empty height={200} text="NOT ENOUGH STROKES" />
      </Panel>
    );
  }
  const H = 200;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const x0 = pts[0].x;
  const x1 = Math.max(pts[pts.length - 1].x, x0 + 1);
  let lo = Math.min(...pts.map((p) => p.y));
  let hi = Math.max(...pts.map((p) => p.y));
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const air = (hi - lo) * 0.14;
  lo -= air;
  hi += air;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;
  const dot = Math.max(1.2, Math.min(2.6, 220 / pts.length));

  return (
    <Panel title="Work per stroke" note={trend ? `${trend.first.toFixed(0)} J to ${trend.last.toFixed(0)} J on the trend` : "joules"}>
      <svg className="rv-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Work per stroke through the piece with its trend">
        {ticks(lo, hi, 4).map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="ax" x={PAD.l - 6} y={sy(v) + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {pts.map((p) => (
          <circle key={p.x} className="dots" cx={sx(p.x)} cy={sy(p.y)} r={dot} />
        ))}
        {trend ? <path className="trend" d={`M${sx(x0).toFixed(1)} ${sy(trend.first).toFixed(1)} L${sx(x1).toFixed(1)} ${sy(trend.last).toFixed(1)}`} /> : null}
        {ticks(x0, x1, 4).map((v) => (
          <text key={`x${v}`} className="ax" x={sx(v)} y={H - PAD.b + 11} textAnchor="middle">
            {Math.round(v)}
          </text>
        ))}
        <text className="axl" x={PAD.l} y={PAD.t - 5} textAnchor="start">
          Joules a stroke
        </text>
        <text className="axl" x={W - PAD.r} y={H - 4} textAnchor="end">
          Stroke
        </text>
      </svg>
    </Panel>
  );
}
