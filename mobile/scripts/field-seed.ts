/* A FIELD TO BE COMPARED AGAINST, in the LOCAL sandbox database only (it
 * refuses any database that is not on localhost, as dev-app-ghosts-seed.ts
 * does).
 *
 *   node scripts/dev-app-db.mjs            (leave it running)
 *   node scripts/dev-app-db.mjs --field    (runs this with the local address)
 *
 * The sandbox's recordings are ticks and nothing else (the ghost seed), so
 * the second card of every chart on a row's analytics (AGAINST EVERYONE,
 * src/screens/Field.tsx; api/row100k/app/field) has nobody in it.
 * This gives:
 *   - nine sample rowers one to three WHOLE recordings each (strokes, force
 *     curves, splits), every rower with a manner of their own: how far each
 *     stroke goes, how much the split wanders and fades, the rate, where
 *     the push peaks;
 *   - the account named on the command line one whole recording tied to a
 *     logged row of its own, so there is a row to open and read.
 * The recordings are the simulator's, bent. They are marked real (the field
 * leaves simulated ones out) and titled "field seed"; a run clears the last
 * run's first, so it can be run again. --look only says what is there.
 *
 * It lives here and not in the site's scripts/ because it runs the app's own
 * decoder (src/erg/model.ts), and the site's build never sees mobile/. */
import { PrismaClient, type Prisma } from "@prisma/client";
import { CHALLENGE_DEMO } from "../../src/lib/row100k";
import { createLive } from "../src/erg/model";
import { columnsFrom, type TelemetryDoc } from "../src/pm5/session";
import { createPm5Sim } from "../src/pm5/simulate";

const url = process.env.POSTGRES_URL ?? "";
if (!/@(localhost|127\.0\.0\.1):/.test(url)) {
  console.error("field-seed: POSTGRES_URL is not a local database. Stopping.");
  process.exit(1);
}

const db = new PrismaClient();
const NOTE = "field seed";

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* How one rower rows. */
type Manner = {
  /* Every distance times this: a longer or a shorter stroke. */
  reach: number;
  /* The split from start to finish, as a share of itself: 0.05 is a piece
   * that ends 5% slower than it began. */
  drift: number;
  /* How far a stroke's split strays from the one before, as a share. */
  wobble: number;
  /* Strokes a minute added to every stroke. */
  rate: number;
  /* The work in a stroke from start to finish, as a share of itself. */
  fade: number;
  /* Where the push peaks: under 1 is earlier, over 1 later. */
  late: number;
};

/* One recording off the simulator, bent to a rower's manner. */
function record(meters: number, seed: number, m: Manner): TelemetryDoc {
  const live = createLive();
  const sim = createPm5Sim({ distanceM: meters, seed });
  while (!sim.done) for (const p of sim.step(1000)) live.feed(p);
  const doc = live.toDoc("PM5 430000002", false);
  const rnd = prng(seed * 7 + 1);
  /* The clock, bent with the split: a piece that drifts slower covers its
   * first half in less than half its time, and ends on the same total. */
  const total = Math.max(1, doc.totals.tenths * 10);
  const part = (hundredths: number) => Math.max(0, Math.min(1, hundredths / total));
  const clock = (hundredths: number) => Math.round(hundredths + (m.drift * total * (part(hundredths) ** 2 - part(hundredths))) / 2);
  doc.strokes = doc.strokes.map((s) => {
    const u = part(s.elapsedHundredths);
    const bend = (1 + m.drift * (u - 0.5)) * (1 + m.wobble * (rnd() - 0.5) * 2);
    return {
      ...s,
      elapsedHundredths: clock(s.elapsedHundredths),
      distanceTenths: Math.round(s.distanceTenths * m.reach),
      spm: Math.max(14, Math.round(s.spm + m.rate + (rnd() - 0.5) * (1 + m.wobble * 40))),
      workTenthsJ: Math.round(s.workTenthsJ * m.reach * (1 + m.fade * (u - 0.5))),
      ...(s.pace ? { pace: Math.round((s.pace / m.reach) * bend) } : {}),
    };
  });
  doc.samples = doc.samples.map((s) => ({ ...s, elapsedHundredths: clock(s.elapsedHundredths), distanceTenths: Math.round(s.distanceTenths * m.reach), paceHundredths: Math.round((s.paceHundredths / m.reach) * (1 + m.drift * (part(s.elapsedHundredths) - 0.5))), avgPaceHundredths: Math.round(s.avgPaceHundredths / m.reach) }));
  /* The curve, pushed earlier or later along the drive. */
  doc.forceCurves = doc.forceCurves.map((c) => {
    const last = c.points.length - 1;
    if (last < 2) return c;
    return {
      ...c,
      points: c.points.map((_, i) => {
        const t = Math.pow(i / last, m.late) * last;
        const j = Math.min(last - 1, Math.floor(t));
        return Math.round(c.points[j] + (c.points[j + 1] - c.points[j]) * (t - j));
      }),
    };
  });
  doc.totals = { ...doc.totals, meters: Math.round(doc.totals.meters * m.reach), avgPaceTenths: doc.totals.avgPaceTenths ? Math.round(doc.totals.avgPaceTenths / m.reach) : null, avgSpm: doc.totals.avgSpm ? Math.round(doc.totals.avgSpm + m.rate) : null };
  /* The monitor's own splits are for the piece before it was bent. */
  doc.splits = [];
  doc.summary = { s39: null, s3a: null, s3c: null };
  return doc;
}

const MANNERS: Manner[] = [
  { reach: 1.18, drift: 0.0, wobble: 0.004, rate: -6, fade: -0.02, late: 0.8 },
  { reach: 1.1, drift: 0.02, wobble: 0.008, rate: -4, fade: -0.05, late: 0.9 },
  { reach: 1.04, drift: 0.05, wobble: 0.012, rate: -2, fade: -0.1, late: 1.0 },
  { reach: 1.0, drift: -0.02, wobble: 0.006, rate: -3, fade: 0.02, late: 1.1 },
  { reach: 0.97, drift: 0.07, wobble: 0.02, rate: 0, fade: -0.14, late: 1.25 },
  { reach: 0.93, drift: 0.03, wobble: 0.015, rate: 1, fade: -0.07, late: 1.4 },
  { reach: 0.9, drift: 0.09, wobble: 0.028, rate: 2, fade: -0.18, late: 1.6 },
  { reach: 1.07, drift: 0.01, wobble: 0.01, rate: -5, fade: -0.03, late: 0.95 },
  { reach: 0.86, drift: 0.04, wobble: 0.022, rate: 3, fade: -0.09, late: 1.15 },
];

async function look() {
  const rows = await db.rowTelemetry.findMany({ select: { title: true, simulated: true, entryId: true, data: true } });
  const by = new Map<string, number>();
  for (const r of rows) {
    const d = r.data as { strokes?: unknown[]; forceCurves?: unknown[] } | null;
    const k = `${r.title.slice(0, 28) || "(no title)"} · ${r.simulated ? "simulated" : "real"} · ${d?.strokes?.length ? "strokes" : "ticks only"} · ${r.entryId ? "tied to a row" : "loose"}`;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  console.log(`${rows.length} recordings`);
  for (const [k, n] of by) console.log(`  ${n} × ${k}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--look")) return look();
  const email = args.find((a) => a.includes("@")) ?? "mikianmusser@gmail.com";
  const gone = await db.rowTelemetry.deleteMany({ where: { title: NOTE } });
  await db.rowEntry.deleteMany({ where: { challenge: CHALLENGE_DEMO, note: NOTE } });
  if (gone.count) console.log(`cleared ${gone.count} from the last run`);

  const user = await db.photographer.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`no account ${email}: run dev-app-db.mjs --seed first`);
  const me = await db.rowParticipant.findFirst({ where: { challenge: CHALLENGE_DEMO, userId: user.id }, select: { id: true, rowerNumber: true } });
  if (!me) throw new Error(`${email} has no rower on the sample board`);
  const others = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE_DEMO, id: { not: me.id } }, orderBy: { rowerNumber: "asc" }, take: MANNERS.length, select: { id: true, rowerNumber: true } });

  const save = (doc: TelemetryDoc, who: { id: string; rowerNumber: number }, userId: string | null, entryId: string | null, daysAgo: number) => {
    const c = columnsFrom(doc);
    const startedAt = new Date(Date.now() - daysAgo * 86400_000);
    return db.rowTelemetry.create({
      data: { challenge: CHALLENGE_DEMO, participantId: who.id, rowerNumber: who.rowerNumber, userId, device: "PM5 430000002", simulated: false, startedAt, endedAt: new Date(startedAt.getTime() + c.tenths * 100), meters: c.meters, tenths: c.tenths, strokes: c.strokes, avgPaceTenths: c.avgPaceTenths, avgWatts: c.avgWatts, avgSpm: c.avgSpm, dragFactor: c.dragFactor, title: NOTE, entryId, data: doc as unknown as Prisma.InputJsonValue },
    });
  };

  let made = 0;
  for (const [i, o] of others.entries()) {
    for (let k = 0; k < 1 + (i % 3); k++) {
      await save(record(k === 1 ? 5000 : 2000, 100 + i * 10 + k, MANNERS[i]), o, null, null, 3 + i + k * 9);
      made++;
    }
  }
  console.log(`${made} recordings for ${others.length} sample rowers`);

  /* The account's own: a 5,000 m that went out quick and came home slower,
   * with a late push, tied to a logged row of today. */
  const mine = record(5000, 4242, { reach: 1.02, drift: 0.06, wobble: 0.01, rate: -3, fade: -0.08, late: 1.5 });
  const c = columnsFrom(mine);
  const day = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
  const entry = await db.rowEntry.create({ data: { challenge: CHALLENGE_DEMO, participantId: me.id, day, meters: c.meters, seconds: Math.round(c.tenths / 10), title: "Field seed 5K", note: NOTE } });
  await save(mine, me, user.id, entry.id, 0);
  console.log(`one recording for ${email}, tied to row ${entry.id}`);
  await look();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
