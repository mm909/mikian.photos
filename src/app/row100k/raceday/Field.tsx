import { fmtRowerNumber } from "@/lib/row100k";
import type { RaceDef } from "../raceday";
import type { Racer } from "../racedayData";

/* THE RACERS: the field as a board table, one bracket at a time (owner,
 * 2026-09-10: "there will be a men's and women's bracket"). Both brackets
 * are always drawn, empty or not — an empty one is a bracket somebody could
 * be leading, not a bracket that does not exist.
 *
 * A row is number, name, fastest 5k, and the wave once one is assigned.
 * NOT meters: a 5k TIME is public even for one of the elite under a
 * blackout, their total is not, so the field prints the clock and never the
 * number that would have to be masked.
 *
 * Its own file so the markup can be rendered against a made-up field
 * without a database (scratchpad/raceday-render.tsx) — the page itself is
 * an async server component and cannot be. */

/* Each bracket ranks on the one number the field cares about: the fastest
 * 5k on the board right now. A rower who has not rowed one is not slow,
 * they are untimed — they sit at the foot in the order they signed up. */
export function rankBracket(rows: Racer[]): Racer[] {
  const timed = rows.filter((r) => r.best5k !== null);
  timed.sort((a, b) => (a.best5k?.seconds ?? 0) - (b.best5k?.seconds ?? 0));
  return [...timed, ...rows.filter((r) => r.best5k === null)];
}

export function Field({ race, field }: { race: RaceDef; field: Racer[] }) {
  const groups = race.brackets.map((b) => ({
    key: b.key as string,
    label: b.label,
    rows: rankBracket(field.filter((r) => r.division === b.key)),
  }));
  // A rower carrying neither bracket still races and still needs a wave, so
  // they are listed rather than dropped — and only when there is one.
  const loose = rankBracket(field.filter((r) => !race.brackets.some((b) => b.key === r.division)));
  if (loose.length > 0) groups.push({ key: "X", label: "No bracket", rows: loose });

  // The wave column only appears once waves exist; before that it would be
  // a column of dashes.
  const showWave = field.some((r) => r.wave !== null);

  return (
    <>
      {groups.map((g) => (
        <div className="rd-br" key={g.key}>
          <p className="rec-eyebrow">
            {g.label.toUpperCase()} · {g.rows.length === 0 ? "NOBODY HERE YET" : `${g.rows.length} IN`}
          </p>
          {g.rows.length === 0 ? (
            <p className="board-empty">Nobody here yet. The bracket is open.</p>
          ) : (
            <table className="board rd-t">
              <thead>
                <tr>
                  <th className="rk">No.</th>
                  <th>Rower</th>
                  <th className="num">Fastest 5k</th>
                  {showWave && <th className="num">Wave</th>}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
                    <td className="who">
                      <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
                    </td>
                    <td className="num t5">{r.best5k ? r.best5k.text : <span className="none">—</span>}</td>
                    {showWave && (
                      <td className="num wv">{r.wave === null ? <span className="none">—</span> : r.wave}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </>
  );
}
