/* THE RACE TAGS, AUDITED (owner, 2026-10-01: "people who clearly rowed
 * their fastest 5K on the night are not marked"). Reads the race as it
 * stands and prints every finisher with the baseline the board measured
 * them against — every row dated before race day, all time, with the
 * asterisk for a prorated one — the race time, and the tag the sheet gives
 * it (PR / FIRST 5K / none). READ ONLY: nothing here writes.
 *
 * Run: npx dotenv -e .env.local -- tsx scripts/row100k-race-tags.ts */
import { resolvedRace } from "../src/app/row100k/racedaySettings";
import { resultBoard } from "../src/app/row100k/raceResults";
import { bracketView, fmtRaceTime, fmtSeed, raceTag } from "../src/app/row100k/raceresults/types";

async function main() {
  const race = await resolvedRace();
  const board = await resultBoard(race, { final: true });
  console.log(`${race.title} · ${race.day} · ${board.ergs} lanes · ${board.waves.length} waves`);
  for (const key of ["M", "F"] as const) {
    const view = bracketView(board, key);
    console.log(`\n${view.label.toUpperCase()} (${view.ranked.length})`);
    console.log("pl  name                              baseline   race    tag");
    view.ranked.forEach((r, i) => {
      const seed = fmtSeed(r.best5k) ?? "—";
      console.log(
        `${String(i + 1).padStart(2)}  ${r.name.padEnd(32).slice(0, 32)}  ${seed.padEnd(9)}  ${fmtRaceTime(r.seconds ?? 0).padEnd(6)}  ${raceTag(r) ?? ""}`,
      );
    });
  }
  process.exit(0);
}

void main();
