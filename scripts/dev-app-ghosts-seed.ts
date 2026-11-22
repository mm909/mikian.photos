/* A FIELD TO RACE, in the LOCAL sandbox database only (it refuses any
 * database that is not on localhost, as dev-app-db-accounts.ts does).
 *
 *   node scripts/dev-app-db.mjs                         (leave it running)
 *   npx dotenv -v POSTGRES_URL=<the local url> -- npx tsx scripts/dev-app-ghosts-seed.ts you@example.com
 *
 * scripts/dev-app-db.mjs --ghosts runs it with the right address.
 *
 * The sample board has rows but no recordings and no follows, so the race
 * page of the phone's monitor (mobile/src/screens/GhostRace.tsx) would
 * open on an empty lake. This gives the account named on the command line:
 *   - forty 5,000 m rows of its own over the last five months, a third of
 *     them with a recording (a tick a second: a quick start, a sag, a
 *     finish, each a little different), the rest logged by hand;
 *   - eight sample rowers to follow, each with three 5,000 m rows, half of
 *     them recorded;
 *   - six recordings dated race day for other sample rowers.
 * Every row it makes carries the note "ghost seed" and a run of it clears
 * the last run's first, so it can be run again. */
import { PrismaClient } from "@prisma/client";
import { CHALLENGE_DEMO } from "../src/lib/row100k";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error("dev-app-ghosts-seed: POSTGRES_URL is not a local database. Stopping.");
  process.exit(1);
}

const db = new PrismaClient();
const NOTE = "ghost seed";
const METERS = 5000;
const RACE_DAY = "2026-09-27";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* A recording's ticks for a 5,000 m row finished in `seconds`: one a
 * second, the split quick off the start, sagging through the middle and
 * lifting to the finish, by amounts that differ row to row. */
function samples(seconds: number, rnd: () => number) {
  const start = 2 + rnd() * 5;
  const sag = 0.5 + rnd() * 3;
  const kick = 1 + rnd() * 7;
  const shape = (u: number) => 1 / (1 + (sag * Math.sin(Math.PI * u) - start * Math.exp(-u / 0.04) - kick * Math.pow(Math.max(0, (u - 0.86) / 0.14), 1.5)) / 118);
  /* Speed along the row, then scaled so the distance comes out exact. */
  const n = Math.round(seconds);
  let sum = 0;
  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    v.push(shape((i + 0.5) / n));
    sum += v[i];
  }
  const out: { elapsedHundredths: number; distanceTenths: number; paceHundredths: number; avgPaceHundredths: number; spm: number; hr: null; watts: null; drag: number }[] = [];
  let d = 0;
  for (let i = 0; i < n - 1; i++) {
    const step = (v[i] / sum) * METERS;
    d += step;
    out.push({ elapsedHundredths: (i + 1) * 100, distanceTenths: Math.round(d * 10), paceHundredths: Math.round((500 / step) * 100), avgPaceHundredths: Math.round((((i + 1) / d) * 500) * 100), spm: 24, hr: null, watts: null, drag: 120 });
  }
  return out;
}

const dayBack = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Name the account: tsx scripts/dev-app-ghosts-seed.ts you@example.com");
  const user = await db.photographer.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`No account ${email} in this database. Run dev-app-db.mjs --seed first.`);
  const me = await db.rowParticipant.findUnique({ where: { challenge_userId: { challenge: CHALLENGE_DEMO, userId: user.id } }, select: { id: true, rowerNumber: true } });
  if (!me) throw new Error(`${email} has no rower in the sample board.`);

  /* The last run's rows go first. */
  const old = await db.rowEntry.findMany({ where: { challenge: CHALLENGE_DEMO, note: NOTE }, select: { id: true } });
  await db.rowTelemetry.deleteMany({ where: { title: NOTE } });
  await db.rowEntry.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });

  const rnd = prng(20261122);
  let rows = 0;
  let recs = 0;
  const row = async (participantId: string, rowerNumber: number, day: string, seconds: number, recorded: boolean) => {
    const e = await db.rowEntry.create({ data: { challenge: CHALLENGE_DEMO, participantId, day, meters: METERS, seconds: Math.round(seconds), note: NOTE, title: "5K" } });
    rows++;
    if (!recorded) return;
    const startedAt = new Date(`${day}T15:00:00Z`);
    await db.rowTelemetry.create({
      data: { challenge: CHALLENGE_DEMO, participantId, rowerNumber, userId: user.id, device: "PM5 430000000", simulated: false, startedAt, endedAt: new Date(startedAt.getTime() + seconds * 1000), meters: METERS, tenths: Math.round(seconds * 10), strokes: Math.round((seconds / 60) * 24), avgPaceTenths: Math.round(seconds), avgSpm: 22 + Math.floor(rnd() * 6), title: NOTE, entryId: e.id, data: { schema: "pm5-telemetry/1", samples: samples(seconds, rnd) } },
    });
    recs++;
  };

  /* The account's own forty, around 20:00. */
  for (let i = 0; i < 40; i++) await row(me.id, me.rowerNumber, dayBack(2 + i * 4), 1168 + rnd() * 80, i % 3 === 0);

  /* Eight to follow, three rows each, a little either side of that. */
  const others = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE_DEMO, id: { not: me.id } }, orderBy: { rowerNumber: "asc" }, take: 14, select: { id: true, rowerNumber: true } });
  for (const [k, o] of others.slice(0, 8).entries()) {
    await db.rowFollow.upsert({ where: { followerId_followeeId: { followerId: me.id, followeeId: o.id } }, create: { challenge: CHALLENGE_DEMO, followerId: me.id, followeeId: o.id, status: "accepted", acceptedAt: new Date() }, update: { status: "accepted" } });
    for (let i = 0; i < 3; i++) await row(o.id, o.rowerNumber, dayBack(5 + k * 3 + i * 11), 1150 + rnd() * 120, (k + i) % 2 === 0);
  }

  /* Six from race day, a recording and no logged row, as the room's
   * monitors left them. */
  for (const o of others.slice(8, 14)) {
    const seconds = 1140 + rnd() * 130;
    const startedAt = new Date(`${RACE_DAY}T17:00:00Z`);
    await db.rowTelemetry.create({
      data: { challenge: CHALLENGE_DEMO, participantId: o.id, rowerNumber: o.rowerNumber, userId: user.id, device: "PM5 430000001", simulated: false, startedAt, endedAt: new Date(startedAt.getTime() + seconds * 1000), meters: METERS, tenths: Math.round(seconds * 10), strokes: Math.round((seconds / 60) * 26), avgPaceTenths: Math.round(seconds), avgSpm: 24 + Math.floor(rnd() * 6), title: NOTE, data: { schema: "pm5-telemetry/1", samples: samples(seconds, rnd) } },
    });
    recs++;
  }
  console.log(`ghost seed: ${rows} rows, ${recs} recordings, 8 follows for rower ${me.rowerNumber}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
