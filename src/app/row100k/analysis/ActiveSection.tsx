import { ActiveSvg, ChartBox } from "./charts";
import { fmtInt } from "./fmt";
import type { ActiveModel } from "./active";

/* DAILY ACTIVE ROWERS section of the numbers page (owner, 2026-09-25: "a
 * daily active rower chart on the dev numbers page for now"). The plain
 * product metric, first on the page: four tiles, one chart, one note. No
 * hooks, no state — the JSON arrives computed from the server and this
 * renders the same on both sides. */

/* 38.3, or 4 rather than 4.0 — an average of people a day. */
const avg = (v: number) => (Number.isFinite(v) ? String(+v.toFixed(1)) : "—");

export function ActiveSection({ a }: { a: ActiveModel }) {
  const n = a.days.length;
  const has = n > 0 && a.yMax > 0 && a.peak !== null;
  const take = a.peak
    ? `TODAY ${fmtInt(a.today)} · 7-DAY AVERAGE ${avg(a.avg7Now)} · BEST ${fmtInt(a.peak.active)} ON ${a.peak.label.toUpperCase()}`
    : undefined;

  return (
    <section>
      <div className="wrap">
        <div className="sec-head">
          <h2>Daily active rowers</h2>
          <span className="mono">
            SINCE {a.since.toUpperCase()} · {n} {n === 1 ? "DAY" : "DAYS"}
          </span>
        </div>
        {has ? (
          <>
            <div className="an-tiles an-four">
              <div className="an-tile">
                <div className="n">{fmtInt(a.today)}</div>
                <div className="d">rowers today</div>
              </div>
              <div className="an-tile">
                <div className="n">{avg(a.avg7Now)}</div>
                <div className="d">rowers a day · last 7 days</div>
              </div>
              <div className="an-tile">
                <div className="n">{avg(a.avg30Now)}</div>
                <div className="d">rowers a day · last 30 days</div>
              </div>
              <div className="an-tile">
                <div className="n">{a.peak ? fmtInt(a.peak.active) : "—"}</div>
                <div className="d">best day · {a.peak ? a.peak.label : "—"}</div>
              </div>
            </div>
            <ChartBox title="Rowers each day — distinct rowers who logged a row that day, every day since the start" take={take}>
              <ActiveSvg a={a} />
            </ChartBox>
            <p className="an-note">
              A rower counts once a day however many rows they log · days on the challenge clock, Pacific · the blue line is
              the trailing seven-day average, the ink bar is today.
            </p>
          </>
        ) : (
          <p className="an-empty">Nobody has logged a row yet — the days draw themselves as the first rows land.</p>
        )}
      </div>
    </section>
  );
}
