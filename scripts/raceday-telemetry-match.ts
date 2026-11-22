/* WHOSE RECORDING IS WHOSE, from race day (owner, 2026-11-22: "we have a
 * ton of telemetry data from race day ... there are probably many there
 * that you can infer who they belong to by cross-referencing date and time
 * and how long it took them, and their name ... so we can probably assign
 * a lot of these to those rowers").
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/raceday-telemetry-match.ts
 *   npx dotenv -e .env.local -- npx tsx scripts/raceday-telemetry-match.ts --write
 *
 * The room's monitors saved their recordings under the laptop's account,
 * with a rower on them only where one had been assigned on the console,
 * while the result each monitor posted went to the race's own table with
 * the rower's number and the time to the tenth. So a recording with no
 * rower is matched to the one racer whose posted time is within two
 * tenths of its own and whom no other recording already has. One racer and
 * no more, or it is left alone and listed as unmatched.
 *
 * WITHOUT --write IT ONLY READS AND PRINTS. With it, the matched
 * recordings get that rower's participantId and rowerNumber, and nothing
 * else in the row changes: no recording is deleted or moved, and a
 * recording that already has a rower is never touched. The race page of
 * the phone's monitor (api/row100k/app/ghosts) replays the ones that carry
 * a rower. */
import { PrismaClient } from "@prisma/client";

const RACE = "raceday-2026-09-27";
const DAY = "2026-09-27";
const METERS = 5000;
const WITHIN = 2;

const db = new PrismaClient();
const write = process.argv.includes("--write");
const clock = (tenths: number) => `${Math.floor(tenths / 600)}:${String(Math.floor((tenths % 600) / 10)).padStart(2, "0")}.${tenths % 10}`;

async function main() {
  const from = new Date(`${DAY}T07:00:00Z`);
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  const recs = await db.rowTelemetry.findMany({
    where: { meters: METERS, simulated: false, tenths: { gt: 0 }, startedAt: { gte: from, lt: to } },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, tenths: true, device: true, participantId: true, rowerNumber: true },
  });
  const signups = await db.rowRaceSignup.findMany({ where: { race: RACE, tenths: { not: null } }, select: { participantId: true, rowerNumber: true, tenths: true, wave: true } });

  const have = new Set(recs.filter((r) => r.participantId).map((r) => r.participantId as string));
  const open = recs.filter((r) => !r.participantId);
  const taken = new Set<string>();
  const matched: { rec: (typeof recs)[number]; who: (typeof signups)[number] }[] = [];
  const unmatched: (typeof recs)[number][] = [];
  for (const rec of open) {
    const near = signups.filter((s) => s.tenths !== null && Math.abs(s.tenths - rec.tenths) <= WITHIN && !have.has(s.participantId) && !taken.has(s.participantId));
    if (near.length === 1) {
      taken.add(near[0].participantId);
      matched.push({ rec, who: near[0] });
    } else unmatched.push(rec);
  }

  console.log(`race day recordings over ${METERS} m: ${recs.length}`);
  console.log(`  already carry a rower: ${recs.length - open.length}`);
  console.log(`  matched to one racer by time: ${matched.length}`);
  console.log(`  left unmatched: ${unmatched.length}`);
  console.log(`racers with a posted time: ${signups.length}`);
  for (const { rec, who } of matched) console.log(`  match  ${clock(rec.tenths)}  ${rec.device.padEnd(16)}  -> rower ${who.rowerNumber} (posted ${clock(who.tenths ?? 0)}, wave ${who.wave ?? "-"})`);
  for (const rec of unmatched) console.log(`  none   ${clock(rec.tenths)}  ${rec.device.padEnd(16)}  started ${rec.startedAt.toISOString()}`);

  if (!write) {
    console.log("\nRead only. Nothing was changed. --write assigns the matched ones.");
    return;
  }
  for (const { rec, who } of matched) await db.rowTelemetry.update({ where: { id: rec.id }, data: { participantId: who.participantId, rowerNumber: who.rowerNumber } });
  console.log(`\nAssigned ${matched.length} recordings.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
