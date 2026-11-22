import { fmtDay } from "@/lib/row100k";
import { pacificDayKey } from "@/lib/rowPeriod";
import { listRacers } from "@/app/row100k/racedayData";
import { resolvedRace } from "@/app/row100k/racedaySettings";
import { fmtRaceTime } from "@/app/row100k/raceresults/types";
import { no, yes } from "../social";

/* RACE DAY, EVERY RESULT, for the phone app (owner, 2026-11-21: "when we
 * click on the race day 5K for the best, we can just show all the results
 * from race day. It can be, it's okay if it's a little different than all
 * the other ones"). The finished racers in order of time, both brackets,
 * with each one's place in their own bracket.
 *
 * A race time is public and was never masked (the site's results page is
 * open to everybody), so this route is too. Whole seconds, floored, as on
 * every race surface (raceresults/types.ts fmtRaceTime). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const race = await resolvedRace();
    const done = (await listRacers(race))
      .filter((r) => r.role === "racer" && !r.withdrewAt && r.status === "finished" && r.tenths !== null)
      .sort((a, b) => (a.tenths as number) - (b.tenths as number));
    const seen = new Map<string, number>();
    const results = done.map((r, i) => {
      const inBracket = (seen.get(r.division) ?? 0) + 1;
      seen.set(r.division, inBracket);
      return {
        place: i + 1,
        rowerNumber: r.rowerNumber,
        name: r.name,
        division: r.division,
        bracket: race.brackets.find((b) => b.key === r.division)?.label ?? "",
        bracketPlace: inBracket,
        time: fmtRaceTime((r.tenths as number) / 10),
        wave: r.wave,
      };
    });
    return yes({ title: race.title, dayStr: fmtDay(pacificDayKey(race.firstWaveAt)), results });
  } catch (err) {
    console.error("row app: failed to read the race day results", err);
    return no("That could not be read just now.", 500);
  }
}
