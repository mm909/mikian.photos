import { fmtRowerNumber } from "@/lib/row100k";
import type { RaceDef } from "../raceday";
import type { Racer } from "../racedayData";

/* THE RACERS: the field as ONE board table, the bracket marked on the row
 * (owner, 2026-09-11: "we do not need to separate out men and women — we
 * can mark it on the table, but we do not need to separate them into
 * children tables"). One list ranks the whole field against each other,
 * which is what a start list looks like; the bracket is a column, and the
 * brackets are still scored apart on the day.
 *
 * A row is number, name, bracket, fastest 5k, and the wave once one is
 * assigned. NOT meters: a 5k TIME is public even for one of the elite under
 * a blackout, their total is not, so the field prints the clock and never
 * the number that would have to be masked.
 *
 * RACERS ONLY (owner, 2026-09-11): a spectator has no wave and no erg, so
 * they have no line on a start list. The page filters them off before it
 * calls this and counts them beside the head instead; the filter is here
 * too, because a start list that could ever print somebody who is not
 * racing is worse than a redundant line of code.
 *
 * Its own file so the markup can be rendered against a made-up field
 * without a database (scratchpad/raceday-render.tsx) — the page itself is
 * an async server component and cannot be. */

/* THE FIELD STAYS PRIVATE UNTIL IT IS A FIELD (owner, 2026-09-11: "let us
 * not show the racers until ten people have signed up"). Three names on a
 * start list reads as nobody came; the page simply does not carry the
 * section until there are enough to look like a race. Ten RACERS: people
 * who signed up to watch do not pad the start list into existence. */
export const FIELD_SHOWS_AT = 10;

/* The field ranks on the one number it cares about: the fastest 5k on the
 * board right now. A rower who has not rowed one is not slow, they are
 * untimed — they sit at the foot in the order they signed up. */
export function rankField(rows: Racer[]): Racer[] {
  const timed = rows.filter((r) => r.best5k !== null);
  timed.sort((a, b) => (a.best5k?.seconds ?? 0) - (b.best5k?.seconds ?? 0));
  return [...timed, ...rows.filter((r) => r.best5k === null)];
}

/* "M" / "W" — the bracket in one letter, off the race's own labels so a
 * race with different brackets marks itself correctly. A rower carrying
 * neither still races and still needs a wave: they get a dash, never a
 * dropped row. */
function bracketMark(race: RaceDef, division: string): string {
  const b = race.brackets.find((x) => x.key === division);
  return b ? b.label.slice(0, 1).toUpperCase() : "—";
}

export function Field({ race, field }: { race: RaceDef; field: Racer[] }) {
  const racers = field.filter((r) => r.role === "racer");
  const rows = rankField(racers);
  // The wave column only appears once waves exist; before that it would be
  // a column of dashes.
  const showWave = racers.some((r) => r.wave !== null);

  if (rows.length === 0) {
    return <p className="board-empty">Nobody here yet.</p>;
  }

  return (
    <table className="board rd-t">
      <thead>
        <tr>
          <th className="rk">No.</th>
          <th>Rower</th>
          <th>Bracket</th>
          <th className="num">Fastest 5k</th>
          {showWave && <th className="num">Wave</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="rk">{fmtRowerNumber(r.rowerNumber)}</td>
            <td className="who">
              <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
            </td>
            <td className="br mono">{bracketMark(race, r.division)}</td>
            <td className="num t5">{r.best5k ? r.best5k.text : <span className="none">—</span>}</td>
            {showWave && (
              <td className="num wv">{r.wave === null ? <span className="none">—</span> : r.wave}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
