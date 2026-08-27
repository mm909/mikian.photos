/**
 * Seed a fake 100K September board — 100 rowers, two-thirds of the way
 * through the month — so the boards, records, curve, heatmap and profile
 * pages can be worked on with realistic data instead of an empty table.
 *
 *   npm run row100k:demo          # seed (wipes and rebuilds the demo rows)
 *   npm run row100k:demo:clear    # remove every demo row
 *
 * SAFETY — the site is live and this points at the live database.
 * Every row written here carries `challenge = CHALLENGE_DEMO`
 * ("row100k-sep-2026-demo"), a namespace nothing in production reads: the
 * app only resolves CHALLENGE to the demo slug on a dev server (or Vercel
 * preview) with NEXT_PUBLIC_ROW100K_DEMO=1 (see src/lib/row100k.ts). The
 * deletes below are scoped to
 * that slug and the script refuses to run if the slug isn't demo-suffixed,
 * so real September rows are never touched. It prints the live-namespace
 * counts before and after as proof.
 *
 * Flags:
 *   --clear          delete the demo rows and stop
 *   --through=N      seed days Sep 1..N (default 20 — two-thirds of 30)
 *   --rowers=N       how many participants (default 100)
 *   --me=email       give one mid-pack rower a real Photographer.id, so
 *                    signing in as that account lands on the dashboard with
 *                    a month of rows already logged (default: OWNER_EMAIL)
 *   --seed=N         PRNG seed (default 100926) — same seed, same board
 *
 * The generated month is deterministic: rerunning produces byte-identical
 * rows, so a screenshot from yesterday still matches today's board.
 */
import { PrismaClient } from "@prisma/client";
import {
  CHALLENGE_DEMO,
  CHALLENGE_LIVE,
  GOAL_METERS,
  RECORD_TOLERANCE,
  fmtMeters,
} from "../src/lib/row100k";

const db = new PrismaClient();

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string, fallback: string) =>
  argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const THROUGH_DAY = Math.min(30, Math.max(1, Number(opt("through", "20"))));
const ROWERS = Math.min(999, Math.max(1, Number(opt("rowers", "100"))));
/* Comma-separated: every account listed gets its own rower, so signing in as
 * any of them lands on a populated dashboard instead of the join form. */
const ME_EMAILS = opt("me", `${process.env.OWNER_EMAIL || "mikian.photos@gmail.com"},mikianmusser@gmail.com`)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const SEED = Number(opt("seed", "100926"));

/* ------------------------------------------------------------- utilities */

/* mulberry32 — small, fast, deterministic. The board must be reproducible. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const intBetween = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;

/* ---------------------------------------------------------------- people */

const FIRST = [
  "Avery", "Blake", "Camila", "Dante", "Elise", "Finn", "Greta", "Hugo", "Imani", "Jonas",
  "Kira", "Luca", "Maren", "Noor", "Otto", "Priya", "Quinn", "Rosa", "Silas", "Tessa",
  "Uma", "Viktor", "Wren", "Xiomara", "Yusuf", "Zara", "Adrian", "Bianca", "Cyrus", "Delia",
  "Emmett", "Farah", "Gideon", "Hana", "Isaac", "Juno", "Kai", "Lena", "Mateo", "Nadia",
  "Oscar", "Paloma", "Rafael", "Simone", "Theo", "Vera", "Wesley", "Yara", "Zeke", "Marisol",
];
const LAST = [
  "Alvarez", "Bell", "Carr", "Duval", "Ellery", "Frost", "Gallo", "Hayes", "Ibarra", "Janssen",
  "Keller", "Lindqvist", "Moreau", "Nakamura", "Okafor", "Petrov", "Quill", "Reyes", "Salas",
  "Toth", "Ueda", "Vance", "Whitlock", "Yoon", "Zhao", "Brennan", "Castille", "Ferreira",
  "Marchetti", "Ostrom", "Abbott", "Bianchi", "Cortez", "Dunlap", "Eriksen", "Fairbanks",
  "Guerrero", "Holloway", "Iversen", "Jimenez", "Kowalski", "Larkin", "Mbeki", "Novak",
  "Ortega", "Pham", "Radcliffe", "Sandoval", "Tremblay", "Vasquez",
];

/* Female-leaning first names in the pool above — used only to keep the demo
 * board's names and division columns from reading as random noise. */
const FEMININE = new Set([
  "Camila", "Elise", "Greta", "Imani", "Kira", "Maren", "Noor", "Priya", "Rosa", "Tessa",
  "Uma", "Wren", "Xiomara", "Zara", "Bianca", "Delia", "Farah", "Hana", "Juno", "Lena",
  "Nadia", "Paloma", "Simone", "Vera", "Yara", "Marisol",
]);

/* -------------------------------------------------------------- shaping */

/* Where the field sits at two-thirds of the month. `share` is a fraction of
 * the pace line (66,667 m by day 20), so the mix stays honest if --through
 * moves. Counts are scaled to --rowers. */
const PACE_METERS = (THROUGH_DAY / 30) * GOAL_METERS;

const ARCHETYPES = [
  /* Out front — two or three already past 100k, which lights up the
   * "100K CLUB" tag and the community `finished` counter. */
  { key: "machine", weight: 6, share: [1.3, 1.78], spread: [0.8, 0.95], split: [98, 112], piece: [6000, 12000] },
  /* On the line — the group the curve is drawn for. */
  { key: "onpace", weight: 22, share: [0.9, 1.18], spread: [0.6, 0.85], split: [108, 124], piece: [4500, 8000] },
  /* Grinding — behind but live. */
  { key: "grinder", weight: 28, share: [0.55, 0.9], spread: [0.45, 0.7], split: [116, 134], piece: [3500, 6500] },
  /* Behind — the honest middle-back of any challenge. */
  { key: "behind", weight: 22, share: [0.22, 0.55], spread: [0.3, 0.5], split: [124, 146], piece: [2500, 5000] },
  /* Faded — a strong first week, then nothing. Tests stale-streak states. */
  { key: "faded", weight: 14, share: [0.06, 0.24], spread: [0.3, 0.5], split: [120, 150], piece: [2000, 5000] },
  /* Signed up, barely rowed — zero-meter rows must render, not crash. */
  { key: "ghost", weight: 8, share: [0, 0.05], spread: [0.1, 0.2], split: [130, 160], piece: [1000, 3000] },
] as const;

/* Distances people actually pull. The record boards key off 1k/5k/10k, so
 * those stay exact most of the time; a fifth of pieces get a small overshoot
 * to exercise the ±2% record tolerance. */
const PIECES = [1000, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000];

/* Feed/testing flavor — about a third of demo sessions carry one. */
const PHOTO_COLORS = ["#0077B6", "#15171A", "#2E8B57", "#B8860B", "#4d9fc9", "#7A7A74"];

const TITLES = [
  "Sunrise meters",
  "Lunch break erg",
  "Steady state grind",
  "Negative split attempt",
  "Post-leg-day shuffle",
  "Rowing off the coffee",
  "Quiet 30 before work",
  "Race pace pieces",
];

const NOTES = [
  "", "", "", "", "", "", "",
  "easy steady state", "morning row", "felt awful, did it anyway", "2k test",
  "intervals: 4x1k", "lunch break", "with the crew", "erg is in the garage now",
  "negative split", "legs cooked", "sunrise on the water", "last one before the trip",
];

type Participant = {
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: "M" | "F";
  userId: string;
  archetype: string;
  entries: { day: string; meters: number; seconds: number; note: string; title: string; photos: string[] }[];
};

function buildField(): Participant[] {
  // Expand the archetype weights into one slot per rower, then shuffle so
  // rower numbers (join order) don't correlate with how fast they are.
  const slots: string[] = [];
  for (const a of ARCHETYPES) {
    const n = Math.round((a.weight / 100) * ROWERS);
    for (let i = 0; i < n; i++) slots.push(a.key);
  }
  while (slots.length < ROWERS) slots.push("grinder");
  slots.length = ROWERS;
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const usedHandles = new Set<string>();
  return slots.map((key, i) => {
    const a = ARCHETYPES.find((x) => x.key === key)!;
    const first = FIRST[(i * 7 + Math.floor(rand() * 3)) % FIRST.length];
    const last = LAST[(i * 11 + Math.floor(rand() * 5)) % LAST.length];
    const displayName = `${first} ${last}`;

    // ".demo" suffix so a stray click on the board can't land on a real
    // Instagram account belonging to someone uninvolved.
    let handle = `${first}.${last}.demo`.toLowerCase().slice(0, 30);
    let n = 2;
    while (usedHandles.has(handle)) handle = `${first}${n++}.demo`.toLowerCase();
    usedHandles.add(handle);

    const division: "M" | "F" = FEMININE.has(first) ? "F" : "M";
    const target = PACE_METERS * between(a.share[0], a.share[1]);
    const entries = buildMonth(target, a);

    return {
      rowerNumber: i + 1,
      displayName,
      instagram: handle,
      division,
      userId: `demo-${CHALLENGE_DEMO}-${String(i + 1).padStart(3, "0")}`,
      archetype: key,
      entries,
    };
  });
}

/* One rower's September: sessions drawn until they reach their target, laid
 * onto days with rest days between and the odd doubled-up day. */
function buildMonth(target: number, a: (typeof ARCHETYPES)[number]) {
  const entries: { day: string; meters: number; seconds: number; note: string; title: string; photos: string[] }[] = [];
  // Half the ghosts never log anything — a signed-up rower sitting on zero
  // meters has to render everywhere (board, profile, records) without a hole.
  if (target < 500 || (a.key === "ghost" && rand() < 0.5)) return entries;

  const baseSplit = between(a.split[0], a.split[1]);
  const lastDay = a.key === "faded" ? Math.min(THROUGH_DAY, intBetween(5, 9)) : THROUGH_DAY;
  const perDay = new Map<number, number>();

  let total = 0;
  let guard = 0;
  while (total < target && guard++ < 200) {
    // One session in eight is a tested piece — an exact 1k/5k/10k gone after
    // at race pace. Without these the record boards fill up with whoever
    // happened to stop near a round number, so the fastest 1k ends up slower
    // than the fastest 10k.
    const isTest = rand() < 0.13;
    let meters: number;
    if (isTest) {
      meters = pick([1000, 1000, 5000, 5000, 10000]);
    } else {
      // Bias the piece length toward this archetype's usual session.
      const wanted = between(a.piece[0], a.piece[1]);
      meters = PIECES.reduce((best, p) =>
        Math.abs(p - wanted) < Math.abs(best - wanted) * between(0.7, 1.6) ? p : best,
      PIECES[0]);
      // A fifth of pieces are "water rows" — a hair over the round number.
      if (rand() < 0.2) meters = Math.round(meters * between(1.001, RECORD_TOLERANCE - 0.002));
    }

    // Longer pieces run slower; short pieces get pushed; tests get emptied out.
    const effort = meters <= 2000 ? between(-9, -3) : meters >= 10000 ? between(2, 8) : between(-3, 4);
    const test = isTest ? between(-9, -4) - (meters === 1000 ? 4 : 0) : 0;
    // Floor scaled to the rower (nobody drops 16% under their own base) and
    // jittered, so hard-clamped sessions can't tie for a record at the exact
    // same time — three identical 3:10.0 1ks read as fake immediately.
    const floor = Math.max(92 + between(0, 8), baseSplit * 0.88);
    const split = Math.max(floor, baseSplit + effort + test + between(-4, 4));
    const seconds = Math.round((meters / 500) * split);

    // Place it: prefer a fresh day, allow a second session ~1 day in 6.
    let d = intBetween(1, lastDay);
    let tries = 0;
    while ((perDay.get(d) ?? 0) >= (rand() < 0.16 ? 2 : 1) && tries++ < 12) d = intBetween(1, lastDay);
    if ((perDay.get(d) ?? 0) >= 2) continue;
    perDay.set(d, (perDay.get(d) ?? 0) + 1);

    const note = isTest && meters % 1000 === 0 && rand() < 0.5 ? `${meters / 1000}k test` : pick(NOTES);
    const title = rand() < 0.35 ? pick(TITLES) : "";
    /* About a third of demo sessions carry sample photos — flat color
     * squares, so the feed's photo view has something to show without R2.
     * "demo:" keys are rendered as inline SVG by the feed and are never
     * presigned; they exist only in the demo namespace. */
    const photos =
      rand() < 0.35 ? [`demo:${pick(PHOTO_COLORS)}`, `demo:${pick(PHOTO_COLORS)}`] : [];
    entries.push({ day: day(d), meters, seconds, note, title, photos });
    total += meters;
  }

  entries.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  return entries;
}

/* ------------------------------------------------------------------ main */

async function liveCounts() {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.count({ where: { challenge: CHALLENGE_LIVE } }),
    db.rowEntry.count({ where: { challenge: CHALLENGE_LIVE } }),
  ]);
  return { participants, entries };
}

async function clearDemo() {
  // Belt and braces: the slug this script deletes by must be the demo one.
  // (Widened to string — the literal types can't be compared directly, but
  // the check exists to survive someone editing those constants later.)
  const slug: string = CHALLENGE_DEMO;
  if (slug === (CHALLENGE_LIVE as string) || !slug.endsWith("-demo")) {
    throw new Error(`refusing to delete: "${CHALLENGE_DEMO}" is not a demo namespace`);
  }
  const entries = await db.rowEntry.deleteMany({ where: { challenge: CHALLENGE_DEMO } });
  const participants = await db.rowParticipant.deleteMany({ where: { challenge: CHALLENGE_DEMO } });
  return { entries: entries.count, participants: participants.count };
}

async function main() {
  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0] ?? "unknown";
  console.log(`database: ${host}`);
  console.log(`namespace: ${CHALLENGE_DEMO}   (live "${CHALLENGE_LIVE}" is never written)`);

  const before = await liveCounts();
  console.log(`live rows before: ${before.participants} participants / ${before.entries} entries`);

  const removed = await clearDemo();
  if (removed.participants || removed.entries) {
    console.log(`cleared demo: ${removed.participants} participants, ${removed.entries} entries`);
  }
  if (flag("clear")) {
    const after = await liveCounts();
    console.log(`live rows after:  ${after.participants} participants / ${after.entries} entries`);
    return;
  }

  const field = buildField();

  // Real account ids, so signing in as one of these lands on a populated
  // dashboard instead of the join form. Mid-pack on purpose — the interesting
  // states (a rank, a delta, meters still to go) live in the middle of the
  // board — and the busiest logs in that band, so there's something to see.
  const claimable = field
    .filter((p) => p.archetype === "grinder" || p.archetype === "onpace")
    .sort((a, b) => b.entries.length - a.entries.length);
  let claimed = 0;
  for (const email of ME_EMAILS) {
    const account = await db.photographer
      .findUnique({ where: { email }, select: { id: true, name: true } })
      .catch(() => null);
    if (!account) {
      console.log(`no Photographer row for ${email} — sign in once, then rerun to claim a rower`);
      continue;
    }
    const mine = claimable[claimed++];
    if (!mine) break;
    mine.userId = account.id;
    mine.displayName = account.name || mine.displayName;
    mine.instagram = "mikian_";
    console.log(
      `${email} → rower ${String(mine.rowerNumber).padStart(3, "0")} · ${mine.entries.length} sessions`,
    );
  }

  // Joins ramp over the two weeks before Sep 1, in rower-number order.
  const joinStart = Date.UTC(2026, 7, 18, 16, 0, 0);
  await db.rowParticipant.createMany({
    data: field.map((p) => ({
      challenge: CHALLENGE_DEMO,
      userId: p.userId,
      rowerNumber: p.rowerNumber,
      displayName: p.displayName,
      instagram: p.instagram,
      division: p.division,
      createdAt: new Date(joinStart + p.rowerNumber * 3.1 * 3600_000),
    })),
  });

  const rows = await db.rowParticipant.findMany({
    where: { challenge: CHALLENGE_DEMO },
    select: { id: true, rowerNumber: true },
  });
  const idByNumber = new Map(rows.map((r) => [r.rowerNumber, r.id]));

  const entryData = field.flatMap((p) => {
    // Logged the evening of the row; a second session that day lands an hour
    // later, because the boards sort on createdAt within a day.
    const seen = new Map<string, number>();
    return p.entries.map((e, i) => {
      const k = seen.get(e.day) ?? 0;
      seen.set(e.day, k + 1);
      return {
        challenge: CHALLENGE_DEMO,
        participantId: idByNumber.get(p.rowerNumber)!,
        day: e.day,
        meters: e.meters,
        seconds: e.seconds,
        note: e.note,
        // Same default the rows API applies: untitled rows get numbered.
        title: e.title || `Rowtember #${i + 1}`,
        photos: e.photos,
        createdAt: new Date(`${e.day}T${String(19 + Math.min(k, 3)).padStart(2, "0")}:20:00Z`),
      };
    });
  });
  for (let i = 0; i < entryData.length; i += 500) {
    await db.rowEntry.createMany({ data: entryData.slice(i, i + 500) });
  }

  const totalMeters = entryData.reduce((s, e) => s + e.meters, 0);
  const perRower = new Map<string, number>();
  for (const e of entryData) perRower.set(e.participantId, (perRower.get(e.participantId) ?? 0) + e.meters);
  const finished = [...perRower.values()].filter((m) => m >= GOAL_METERS).length;
  const silent = field.filter((p) => p.entries.length === 0).length;

  console.log("");
  console.log(`seeded ${field.length} rowers · ${entryData.length} sessions · ${fmtMeters(totalMeters)}`);
  console.log(`through Sep ${THROUGH_DAY} · ${finished} past 100k · ${silent} yet to log a meter`);

  const after = await liveCounts();
  console.log(`live rows after:  ${after.participants} participants / ${after.entries} entries`);
  if (after.participants !== before.participants || after.entries !== before.entries) {
    throw new Error("live namespace changed — this should be impossible; investigate before shipping");
  }

  console.log("");
  console.log("to see it:  npm run dev:row100k     → http://localhost:3000/row100k");
  console.log(`  (sets NEXT_PUBLIC_ROW100K_DEMO=1 + NEXT_PUBLIC_ROW100K_NOW=${day(THROUGH_DAY)}T19:00:00Z)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
