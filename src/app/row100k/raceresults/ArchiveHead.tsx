import { Fragment, type ReactNode } from "react";

import type { RaceDef } from "../raceday";

/* THE ARCHIVE HEADER (owner, 2026-10-01: "at the top the race name, the
 * date, the place, and the two sponsors — the room and the sponsor — in
 * one ruled header"). One block between a thick rule and a 2px one.
 *
 * CUT TO A THIRD (owner, later the same night, reading it on his phone:
 * "the ticket takes too much room"). What it was: the name at poster size
 * with the day flush right, the piece and the place on a mono line, and
 * the two marks on a ruled line of their own. What it is: the name one
 * step above the section words, the share control flush right of it, and
 * ONE mono line under both — the day, the house, the room and the piece,
 * dotted together, wrapping on a phone but never stacking as blocks. The
 * house mark is gone from the page altogether (the venue stays as words);
 * the sponsor mark went to the foot of the sheet, small, under a RACE DAY
 * SPONSOR label (ArchiveFoot below).
 *
 * `act` is the one control the header carries — SHARE YOUR TIME
 * (ShareTime.tsx), handed in by the page because it reads the board and
 * this header reads the race. It lands in the top right of the ticket by
 * grid area, where the profile and the stats page keep their SHARE, and
 * the list it opens spans the ticket under the mono line (rrCss.ts
 * .rr-arch).
 *
 * Reads the race, never the board: the board knows a dateLine and a
 * placeLine as strings, and the header wants the pieces apart. Server
 * only (it takes a RaceDef). */
const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function ArchiveHead({ race, act }: { race: RaceDef; act?: ReactNode }) {
  /* Noon UTC on race day, so the day never slides a zone either way. */
  const day = new Date(`${race.day}T12:00:00Z`);
  const stamp = `${DOW[day.getUTCDay()]} · ${MON[day.getUTCMonth()]} ${day.getUTCDate()} · ${day.getUTCFullYear()}`;
  /* One line of mono, four cells. Each cell is kept whole with the dot
   * that follows it (.rr-archp span is nowrap, the dot rides on a
   * no-break space), so a phone breaks the line after a dot and never
   * inside THE STRIP BARBELL or with a dot leading a line. */
  const cells = [stamp, race.venue, race.room, race.sub];
  const last = cells.length - 1;

  return (
    <header className="rr-arch">
      <h1 className="rr-archt">{race.title}</h1>
      <p className="rr-archp">
        {cells.map((c, i) => (
          <Fragment key={c}>
            <span>
              {c}
              {i < last ? " ·" : null}
            </span>
            {i < last ? " " : null}
          </Fragment>
        ))}
      </p>
      {act}
    </header>
  );
}

/* THE SPONSOR, at the foot of the sheet (owner, 2026-10-01: the Las Vegas
 * Sports and Spine Center mark leaves the header for the bottom of the
 * page; later the same day: "remove the copy RACE DAY SPONSOR and just put
 * the logo centered in the bottom middle of the page"). The white mark,
 * centred, nothing else. Nothing when the race has no sponsor. */
export function ArchiveFoot({ race }: { race: RaceDef }) {
  if (!race.sponsor) return null;
  const m = race.sponsor.mark;
  return (
    <p className="rr-spon">
      <a href={race.sponsor.url} target="_blank" rel="noopener noreferrer">
        <img src={m.src} alt={m.alt} width={1000} height={Math.round(1000 / m.ratio)} />
      </a>
    </p>
  );
}
