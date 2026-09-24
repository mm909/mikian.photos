import { ChartBox, MonthsSvg } from "./charts";
import { fmtInt, fmtK, fmtM, signed } from "./fmt";
import { atDay, type MonthsModel } from "./months";

/* THE MONTHS section of the numbers page (owner, 2026-09-25: "a comparison
 * between months — on the third day of the month we had this many meters,
 * but this month we have this many; same for number of sessions and daily
 * active users. Graphed on the month scale"). Three charts on one
 * day-of-month axis, then the same comparison as numbers: every month at
 * today's day number, so the sentence the owner said can be read off a
 * row. No hooks, no state — the JSON arrives computed from the server and
 * this renders the same on both sides. */

/* Axis meters: 2K … 750K, then 1M, 2.5M, 8M — a community month runs to
 * millions, and 8000K is not a number anyone says. */
const abbr = (v: number) => (Math.abs(v) >= 1_000_000 ? `${+(v / 1_000_000).toFixed(2)}M` : fmtK(v).replace(" k", "K"));
const count = (v: number) => String(Math.round(v));

export function MonthsSection({ m }: { m: MonthsModel }) {
  const now = m.lines.find((l) => l.current) ?? null;
  const past = m.lines.filter((l) => !l.current);
  const prev = past.length ? past[past.length - 1] : null;
  const nowM = now ? atDay(now.meters, m.today) : null;
  const prevM = prev ? atDay(prev.meters, m.today) : null;
  const take =
    nowM !== null && prevM !== null && prevM > 0
      ? `BY ${m.todayLabel.toUpperCase()} THIS MONTH IS AT ${fmtM(nowM).toUpperCase()}, ${signed(((nowM - prevM) / prevM) * 100, 0)} % ON ${prev?.short} AT THE SAME DAY`
      : nowM !== null
        ? `BY ${m.todayLabel.toUpperCase()} THIS MONTH IS AT ${fmtM(nowM).toUpperCase()} — THE FIRST MONTH THERE IS NOTHING TO COMPARE IT WITH YET`
        : undefined;

  return (
    <section>
      <div className="wrap">
        <div className="sec-head">
          <h2>The months</h2>
          <span className="mono">
            {m.lines.length} {m.lines.length === 1 ? "MONTH" : "MONTHS"} · SAME DAY, SIDE BY SIDE
          </span>
        </div>
        {/* The key, once for all three charts: the current month in blue,
          * the months before it in greys that fade with age. */}
        <div className="an-mo-key">
          {m.lines.map((l, i) => (
            <span key={l.key} className={l.current ? "now" : undefined} style={l.current ? undefined : { opacity: 0.35 + (past.length > 1 ? (0.65 * i) / (past.length - 1) : 0.65) }}>
              <i /> {l.label.toUpperCase()}
            </span>
          ))}
        </div>

        {m.yMeters > 0 ? (
          <ChartBox title="Meters so far — cumulative by day of the month, one line per month" take={take}>
            <MonthsSvg m={m} pick={(l) => l.meters} yMax={m.yMeters} fmt={abbr} label="Cumulative meters" />
          </ChartBox>
        ) : (
          <p className="an-empty">Not a meter logged yet — the months draw themselves as rows land.</p>
        )}
        {m.ySessions > 0 ? (
          <ChartBox title="Sessions so far — cumulative by day of the month">
            <MonthsSvg m={m} pick={(l) => l.sessions} yMax={m.ySessions} fmt={count} label="Cumulative sessions" />
          </ChartBox>
        ) : null}
        {m.yActive > 0 ? (
          <ChartBox title="Rowers each day — distinct rowers who logged that day, not cumulative">
            <MonthsSvg m={m} pick={(l) => l.active} yMax={m.yActive} fmt={count} label="Rowers each day" />
          </ChartBox>
        ) : null}

        <MonthsTable m={m} />
        <p className="an-note">
          Every month read at day {m.today}, today&rsquo;s day number, so the comparison is like for like · a 30-day month
          has no day 31 and prints a dash there · rowers that day = distinct rowers with a row logged on that one day ·
          the current month stops at today.
        </p>
      </div>
    </section>
  );
}

/* Every month at today's day number, oldest first, this month last and in
 * the blue. Meters carry the change on the month before, at the same day,
 * so the owner's sentence — this many then, this many now — is the row. */
function MonthsTable({ m }: { m: MonthsModel }) {
  if (!m.lines.length) return null;
  return (
    <div className="an-fc an-mo">
      <table className="board">
        <thead>
          <tr>
            <th>Month</th>
            <th className="num">Meters, day {m.today}</th>
            <th className="num">Sessions, day {m.today}</th>
            <th className="num">Rowers, day {m.today}</th>
            <th className="num">Month total</th>
          </tr>
        </thead>
        <tbody>
          {m.lines.map((l, i) => {
            const meters = atDay(l.meters, m.today);
            const sessions = atDay(l.sessions, m.today);
            const active = atDay(l.active, m.today);
            const before = i > 0 ? atDay(m.lines[i - 1].meters, m.today) : null;
            const delta = meters !== null && before !== null && before > 0 ? ((meters - before) / before) * 100 : null;
            const total = l.meters.length ? l.meters[l.meters.length - 1] : 0;
            return (
              <tr key={l.key} className={l.current ? "now" : undefined}>
                <td className="who">
                  {l.label}
                  {l.current ? <span className="an-dv">SO FAR</span> : null}
                </td>
                <td className="num">
                  {meters === null ? "—" : fmtM(meters)}
                  {delta !== null ? <span className="an-band">{signed(delta, 0)} % on {m.lines[i - 1].short}</span> : null}
                </td>
                <td className="num">{sessions === null ? "—" : fmtInt(sessions)}</td>
                <td className="num">{active === null ? "—" : fmtInt(active)}</td>
                <td className="num">
                  {fmtM(total)}
                  <span className="an-band">
                    {fmtInt(l.rowers)} {l.rowers === 1 ? "rower" : "rowers"}
                    {l.current ? ` · ${l.meters.length} of ${l.days} days` : ""}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
