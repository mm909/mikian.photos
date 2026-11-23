/* SOMEBODY ROWING RIGHT NOW, in the LOCAL sandbox database only (it refuses
 * any database that is not on localhost, as the other sandbox seeds do).
 *
 *   node scripts/dev-app-db.mjs                    (leave it running)
 *   node scripts/dev-app-db.mjs --live             (runs this with the local address)
 *   node scripts/dev-app-db.mjs --live --speed=10  (as fast as the app's demo row)
 *
 * The race page of the phone's monitor can show the rowers who are on the
 * water this minute (api/row100k/app/live, mobile/src/erg/liveRace.ts), and
 * in a sandbox nobody is. This rows two sample rowers over 5,000 m, one a
 * little quicker than the app's demo row and one a little slower, and says
 * so to the RowLive table every second, exactly as two phones would. The
 * app puts a live rower where they are this second, so START THE APP'S ROW
 * FIRST AND THIS WITHIN A FEW SECONDS OF IT: the two come up marked LIVE,
 * one a little ahead and one a little behind. Started a minute apart they
 * are a minute up the course and off the water, as they would be.
 *
 * The site has to be told the live race is on: ROW_LIVE_RACE=1 in
 * .env.development.local (git-ignored) beside this folder's .env.local.
 * It clears its two lines when it ends or is stopped. */
import { PrismaClient } from "@prisma/client";
import { CHALLENGE_DEMO } from "../src/lib/row100k";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error("dev-app-live: POSTGRES_URL is not a local database. Stopping.");
  process.exit(1);
}

const db = new PrismaClient();
const METERS = 5000;
const speedFlag = process.argv.find((a) => a.startsWith("--speed="));
const SPEED = Math.max(1, Math.min(40, Number(speedFlag?.slice(8)) || 1));

/* Two rowers: the seconds each takes, and how their split wanders. */
const PLAN = [
  { seconds: 1164, wander: 0.003 },
  { seconds: 1181, wander: -0.002 },
];

async function main() {
  const rowers = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE_DEMO, userId: { not: "" } }, orderBy: { rowerNumber: "desc" }, take: 40, select: { id: true, displayName: true, rowerNumber: true } });
  /* Not the accounts a person signs in to the sandbox with. */
  const two = rowers.filter((r) => !/^(Mikian|Sandbox)/.test(r.displayName)).slice(0, PLAN.length);
  if (two.length < PLAN.length) throw new Error("No sample rowers: seed the board first (node scripts/dev-app-db.mjs --seed).");
  const ids = two.map((r) => r.id);
  const clear = () => db.$executeRaw`DELETE FROM "RowLive" WHERE "participantId" = ANY(${ids})`;
  await clear();
  let stop = false;
  process.on("SIGINT", () => {
    stop = true;
  });
  console.log(`live: ${two.map((r) => r.displayName).join(" and ")} over ${METERS} m, ${SPEED}x`);

  const began = Date.now();
  const marks: number[][] = PLAN.map(() => []);
  for (;;) {
    const t = ((Date.now() - began) / 1000) * SPEED;
    let all = true;
    for (const [i, p] of PLAN.entries()) {
      /* Where this rower is at t: an even pace, bent a little so that the
       * first half and the second are not the same split. */
      const at = (s: number) => {
        const x = Math.min(1, s / p.seconds);
        return METERS * (x + p.wander * Math.sin(Math.PI * 2 * x));
      };
      const ended = t >= p.seconds;
      const elapsed = ended ? p.seconds : t;
      const m = ended ? METERS : at(t);
      if (!ended) all = false;
      for (let line = (marks[i].length + 1) * 100; line <= m; line += 100) {
        /* The second it crossed the line, found by halving. */
        let lo = marks[i][marks[i].length - 1] ?? 0;
        let hi = elapsed;
        for (let k = 0; k < 30; k++) {
          const mid = (lo + hi) / 2;
          if (at(mid) < line) lo = mid;
          else hi = mid;
        }
        marks[i].push(Math.round(hi * 10) / 10);
      }
      await db.$executeRaw`INSERT INTO "RowLive" ("participantId", "challenge", "meters", "elapsed", "distance", "spm", "marks", "ended", "startedAt", "updatedAt")
        VALUES (${ids[i]}, ${CHALLENGE_DEMO}, ${METERS}, ${elapsed}, ${m}, ${26 + i}, ${JSON.stringify(marks[i])}::jsonb, ${ended}, ${new Date(began)}, NOW())
        ON CONFLICT ("participantId") DO UPDATE SET "challenge" = EXCLUDED."challenge", "meters" = EXCLUDED."meters", "elapsed" = EXCLUDED."elapsed", "distance" = EXCLUDED."distance", "spm" = EXCLUDED."spm", "marks" = EXCLUDED."marks", "ended" = EXCLUDED."ended", "startedAt" = EXCLUDED."startedAt", "updatedAt" = NOW()`;
    }
    if (stop || all) break;
    /* The app reads how old a line is in the clock's seconds: at ten times
     * a clock, a line a second old is forty meters out. */
    await new Promise((r) => setTimeout(r, Math.max(100, 1000 / SPEED)));
  }
  /* A finished line stays on another rower's water for half an hour; a
   * sandbox run is cleared a minute after, or at once when stopped. */
  if (!stop) await new Promise((r) => setTimeout(r, 60_000));
  await clear();
  console.log("live: cleared");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
