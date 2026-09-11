/* poster/raceData.ts — the race day payload WITH the field count. SERVER
 * ONLY (it reaches racedayData.ts, which reaches the db); never import it
 * from a client component.
 *
 * The ad needs no database: the race is code, so the studio builds its
 * payload on the client straight off the RaceDef (poster/raceAssemble.ts).
 * The one thing only the server knows is how many names are in, and the ad
 * prints that as a single line of social proof once there are enough of
 * them to be worth printing (raceAssemble FIELD_FLOOR). A page that wants
 * it hands the result to PosterStudio as `raceday`; without it the studio
 * builds the same payload with `field: null` and the line simply is not
 * there.
 *
 * Fails OPEN: a race with an unreadable field is still an ad. */

import { currentRace } from "../raceday";
import { listRacers } from "../racedayData";
import { raceDayPoster } from "./raceAssemble";
import type { RaceDayPoster } from "./types";

export async function raceDayPosterData(): Promise<RaceDayPoster> {
  const race = currentRace();
  try {
    // A withdrawal is a fact, not a delete (racedayData.ts), so the count
    // the ad prints is the field as it stands, not as it was.
    const live = (await listRacers(race)).filter((r) => !r.withdrewAt);
    return raceDayPoster(race, {
      racers: live.filter((r) => r.role === "racer").length,
      spectators: live.filter((r) => r.role === "spectator").length,
    });
  } catch (err) {
    console.error("row100k/poster: race day field read failed", err);
    return raceDayPoster(race, null);
  }
}
