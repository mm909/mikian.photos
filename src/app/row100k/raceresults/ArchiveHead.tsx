import type { RaceDef } from "../raceday";

/* THE ARCHIVE HEADER (owner, 2026-10-01: "at the top the race name, the
 * date, the place, and the two sponsors — the room and the sponsor — in
 * one ruled header"). One block between a thick rule and a 2px one: the
 * name in the house face with the day flush right, the piece and the place
 * in mono under it, and the two marks on a line of their own, a hairline
 * between them so they read as two houses and not one lockup — the race
 * day bill's own house row, lifted. White marks on the ink ground, which is
 * what RaceDef already carries for both.
 *
 * Reads the race, never the board: the board knows a dateLine and a
 * placeLine as strings, and the header wants the pieces apart. Server
 * only (it takes a RaceDef). */
const DOW = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function ArchiveHead({ race }: { race: RaceDef }) {
  /* Noon UTC on race day, so the day never slides a zone either way. */
  const day = new Date(`${race.day}T12:00:00Z`);
  const stamp = `${DOW[day.getUTCDay()]} · ${MON[day.getUTCMonth()]} ${day.getUTCDate()} · ${day.getUTCFullYear()}`;
  const marks = [
    race.venueMark ? { ...race.venueMark, href: race.venueUrl } : null,
    race.sponsor ? { ...race.sponsor.mark, href: race.sponsor.url } : null,
  ].filter((m): m is NonNullable<typeof m> => m !== null);

  return (
    <header className="rr-arch">
      <div className="rr-archrow">
        <h1 className="rr-archt">{race.title}</h1>
        <p className="rr-archd">{stamp}</p>
      </div>
      <p className="rr-archp">
        {race.sub} · {race.venue} · {race.room}
      </p>
      {marks.length > 0 && (
        <div className="rr-archm">
          {marks.map((m) => (
            <a key={m.src} href={m.href} target="_blank" rel="noopener noreferrer">
              <img src={m.src} alt={m.alt} width={1000} height={Math.round(1000 / m.ratio)} />
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
