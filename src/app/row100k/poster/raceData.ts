/* poster/raceData.ts — the race day payload. SERVER ONLY (it reaches
 * racedayData.ts and racedaySettings.ts, which reach the db); never import
 * it from a client component.
 *
 * THE ADS ARE BUILT HERE AND NOWHERE ELSE (review, 2026-09-11). They used to
 * be built off currentRace() — the code default — on the theory that the
 * race is code and a browser can assemble its own ad. It stopped being true
 * the day the console got a settings row: the photograph the owner picks,
 * and any door or first wave he moves, live in RowRaceSettings, so an ad
 * built off the definition drew a race nobody was running and a picture he
 * had not chosen. resolvedRace() is the race AS IT STANDS, and every surface
 * that draws an ad now takes its payload from this function.
 *
 * Three reads, then: (a) the race with its overrides folded in, (b) how many
 * names are in — the ad prints that as a single line of social proof once
 * there are enough of them to be worth printing (raceAssemble FIELD_FLOOR) —
 * and (c) the PHOTOGRAPH, which is a gallery key until somebody with the R2
 * base turns it into a URL (poster/racePhoto.ts).
 *
 * Fails OPEN, all three: an unreadable settings row leaves the code default
 * standing (racedaySettings.ts), and a race with an unreadable field or an
 * unreachable bucket is still an ad. */

import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import type { RaceDef } from "../raceday";
import { listRacers } from "../racedayData";
import { resolvedRace } from "../racedaySettings";
import { raceDayPoster, raceFieldOf, type RaceField } from "./raceAssemble";
import { racePhoto } from "./racePhoto";
import type { RaceDayPoster } from "./types";

/* The counts the bill prints and, since 2026-09-16, the START LIST the
 * field artwork prints (owner: "a poster showing what racers are coming to
 * race day"). raceFieldOf is pure and does the ordering; this is only the
 * read. A withdrawal is a fact, not a delete (racedayData.ts), so the field
 * is as it stands, not as it was.
 *
 * listRacers fails open on its own — a signup read that throws comes back
 * as the SAME empty list a field nobody has joined does — and the one
 * thing a start list must never do is say nobody is coming because the
 * database hiccuped (review, 2026-09-16). So an empty list is asked one
 * more question before it is believed: a count of the signup rows. A count
 * that throws, or that finds rows the list did not, is a failed read, and
 * the null it becomes is what disables the field chip in the studio; a
 * count of zero is an honest NOBODY IN YET. A list with names in it is
 * never re-asked. */
async function raceField(race: RaceDef): Promise<RaceField | null> {
  try {
    const racers = await listRacers(race);
    if (racers.length === 0) {
      const n = await db.rowRaceSignup.count({ where: { challenge: CHALLENGE, race: race.slug } });
      if (n > 0) throw new Error(`the signup list came back empty for ${n} rows`);
    }
    return raceFieldOf(race, racers);
  } catch (err) {
    console.error("row100k/poster: race day field read failed", err);
    return null;
  }
}

export async function raceDayPosterData(): Promise<RaceDayPoster> {
  // The settings row FIRST: the photograph and the hours the rest of this
  // reads are the ones the console set, not the ones the deploy shipped.
  const race = await resolvedRace();
  // The bucket and the database are unrelated failures; one must not take
  // the other down with it.
  const [field, photo] = await Promise.all([raceField(race), racePhoto(race)]);
  return raceDayPoster(race, field, photo);
}
