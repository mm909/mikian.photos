/* poster/fixture.ts — deterministic fake data for /row100k/dev/posters and
 * the offline harnesses (SPEC.md §12). A hundred rowers, thirty days,
 * invented but realistic, the CardPreviews sampleData way — and, unlike
 * that sample, built as TABLES (participants + rows) and pushed through
 * computeBoards → maskBoards → assemble.ts, the exact path the studio's
 * live payload takes. So a masked fixture is masked by the real rule, and
 * the leak test can run on it the way it runs on the live db.
 *
 * Pure: no db, no next, no Dates in the output. Safe to bundle. The one
 * environment read is @/lib/row100k's process.env at module load — a
 * browser harness bundles with esbuild --define:process.env.NODE_ENV and
 * --define:process.env.NEXT_PUBLIC_ROW100K_DEMO (see the report).
 *
 * What the fixture must exercise (SPEC.md §12): an eight-digit community
 * total (final), a 19-character name, an accented name (Sørensen), a rower
 * with no timed rows, a day-1 payload, hours/split null, the run-up
 * (hideLow), and a subject who is one of THE ELITE when masked. */

import type { BlackoutState } from "@/lib/blackout";
import { maskBoards } from "@/lib/blackoutRules";
import { GOAL_METERS, computeBoards, pacificDay, type EntryLite, type ParticipantLite } from "@/lib/row100k";
import { assembleCommunity, assembleRower } from "./assemble";
import type { CommunityPoster, PosterRosterRower, RowerPoster } from "./types";

export type FixtureOpts = {
  /* A window is open; the subject rower is one of the elite. */
  masked?: boolean;
  /* Day 30 read after END_MS: FINAL, the five-row month, the 8-digit total,
   * ~40 club names, a 40-row log. */
  final?: boolean;
  /* The as-of day (1..30); ignored under `final`. Default 12. Day 1 gives
   * the day-1 payload with hours and split null (too few sessions). */
  day?: number;
  /* How many rowers are lifted to the 100K club (default 14, final 40). */
  names?: number;
  /* Rows in the subject's log (default 14, final 40). */
  log?: number;
  /* The run-up: no window yet, three low digits of the elite covered. */
  runup?: boolean;
  /* The subject rower's number (default 23 — one of the top men). */
  rower?: number;
};

export type Fixture = {
  community: CommunityPoster;
  rower: RowerPoster;
  roster: PosterRosterRower[];
};

/* ------------------------------------------------------------ the tables */

/* mulberry32 — a tiny seeded PRNG, so every build of the fixture is the
 * same sheet and a screenshot diff means something. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Avery",
  "Tess",
  "Marcus",
  "Nadia",
  "Jonah",
  "Priya",
  "Elliot",
  "Sofia",
  "Owen",
  "Ingrid",
  "Caleb",
  "Maya",
  "Rafael",
  "Hanna",
  "Theo",
  "Lucia",
  "Desmond",
  "Alma",
  "Felix",
  "Nora",
  "Isaac",
  "Greta",
  "Silas",
  "Yara",
  "Bram",
  "Delia",
  "Ezra",
  "Wren",
  "Otto",
  "Vera",
  "Hugo",
  "Elif",
  "Jasper",
  "Ruth",
  "Kwame",
  "Anouk",
  "Leon",
  "Mira",
  "Nils",
  "Zadie",
  "Pascal",
  "Imani",
  "Reuben",
  "Sasha",
  "Tobias",
  "Uma",
  "Viggo",
  "Willa",
  "Xavier",
  "Yuki",
];
const LAST = [
  "Stone",
  "Vale",
  "Reyes",
  "Okafor",
  "Lindqvist",
  "Nair",
  "Brooks",
  "Marchetti",
  "Hale",
  "Sørensen",
  "Adeyemi",
  "Fischer",
  "Quintero",
  "Park",
  "Castellano",
  "Duarte",
  "Whitfield",
  "Novak",
  "Ibarra",
  "Kim",
  "Moreau",
  "Tanaka",
  "Bergström",
  "Osei",
  "Halloran",
  "Petrov",
  "Abbott",
  "Ferreira",
  "Nakamura",
  "Kowalczyk",
];

/* The subject at 23 is Avery Stone (the SPEC's example rower); 10 wears the
 * accented Sørensen and 30 the 19-character Nathaniel Kowalczyk. */
function nameOf(i: number): string {
  if (i === 9) return "Ingrid Sørensen";
  if (i === 29) return "Nathaniel Kowalczyk";
  if (i === 22) return "Avery Stone";
  return `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`;
}

export type FixtureInputs = {
  participants: ParticipantLite[];
  entries: (EntryLite & { title: string; createdAtMs: number })[];
  blackout: BlackoutState;
  atMs: number;
  dayNumber: number;
  subject: number;
};

/* The fake tables — exported so a check can take the truth (the raw board
 * of these rows) and grep the masked payload for it. */
export function makeFixtureInputs(opts: FixtureOpts = {}): FixtureInputs {
  const final = opts.final === true;
  const dayNumber = final ? 30 : Math.min(30, Math.max(1, Math.floor(opts.day ?? 12)));
  // Nobody is at 100k in the first days of the month; the club grows with
  // the calendar (day 1 has no club, no claim — the null paths).
  const names = opts.names ?? (final ? 40 : dayNumber >= 5 ? Math.min(14, dayNumber + 2) : 0);
  // At most two rows a day in the subject's log (MAX_ENTRIES_PER_DAY is
  // ten, but a 14-row day is not a rower's month).
  const logRows = Math.min(opts.log ?? (final ? 40 : 14), dayNumber * 2);
  const subject = opts.rower ?? 23;
  // Rower 77 never times a row (the untimed path) and rows short pieces,
  // so a 0-second row can never top the fastest boards (validateEntry
  // refuses 0 seconds on the live site — the fixture keeps the boards real).
  const untimed = (i: number) => i === 76;
  const next = rng(20260901);

  // Even numbers row on the men's board, odd on the women's, but for 100,
  // who is division X (the schema allows it: overall boards only).
  const participants: ParticipantLite[] = Array.from({ length: 100 }, (_, i) => ({
    id: `fx-${i + 1}`,
    displayName: nameOf(i),
    division: i === 99 ? "X" : i % 2 === 0 ? "M" : "F",
    rowerNumber: i + 1,
    instagram: i % 3 === 0 ? `${FIRST[i % FIRST.length].toLowerCase()}.rows` : "",
  }));

  // Each rower has an ability (meters a rowed day) and a pace band (seconds
  // per 500 m), a preferred logging hour, and a habit (share of days rowed).
  // A skewed spread so the board has a head and a long tail.
  const ability = participants.map((_, i) => {
    const u = next();
    const base = 2500 + Math.pow(u, 2.2) * 9500;
    // The subject and a few named rowers sit at the head of their boards.
    if (i === 22) return 11_800;
    if (i === 1) return 11_200;
    if (i === 4) return 10_400;
    if (i === 3) return 9_900;
    return base;
  });
  const pace = participants.map(() => 105 + next() * 45);
  const hour = participants.map(() => 5 + Math.floor(next() * 16));
  const habit = participants.map(() => 0.35 + next() * 0.5);

  const entries: FixtureInputs["entries"] = [];
  const push = (i: number, d: number, meters: number, seconds: number, title: string, minute: number) => {
    const day = `2026-09-${String(d).padStart(2, "0")}`;
    const h = (hour[i] + Math.floor(minute / 60)) % 24;
    entries.push({
      participantId: participants[i].id,
      day,
      meters: Math.max(1, Math.round(meters)),
      seconds: Math.max(0, Math.round(seconds)),
      title,
      // Logged on the rowed day, Pacific — UTC-7, the challenge's clock.
      createdAtMs: Date.UTC(2026, 8, d, h + 7, minute % 60, Math.floor(next() * 60)),
    });
  };
  const titles = [
    "Morning steady state",
    "Intervals",
    "Long row",
    "Lunch 5k",
    "Before work",
    "Evening 10k",
    "",
  ];

  for (let i = 0; i < 100; i++) {
    if (i + 1 === subject) continue;
    for (let d = 1; d <= dayNumber; d++) {
      if (next() > habit[i]) continue;
      const rows = next() < 0.15 ? 2 : 1;
      for (let k = 0; k < rows; k++) {
        const raw = ability[i] * (0.55 + next() * 0.9) * (rows === 2 ? 0.6 : 1);
        const meters = untimed(i) ? Math.min(raw, 4_500) : raw;
        const seconds = untimed(i) ? 0 : (meters / 500) * pace[i] * (0.96 + next() * 0.08);
        push(i, d, meters, seconds, titles[Math.floor(next() * titles.length)], Math.floor(next() * 90));
      }
    }
  }

  // The subject's log is laid explicitly: `logRows` rows spread over the
  // elapsed days (at most two a day), the SPEC's 21,097 m longest row in it,
  // and a 5k and a 10k test piece so the time bests place.
  {
    const i = subject - 1;
    const days: number[] = [];
    for (let k = 0; k < logRows; k++) days.push(1 + Math.floor((k * dayNumber) / Math.max(1, logRows)));
    days.forEach((d, k) => {
      const raw =
        k === Math.floor(logRows / 2)
          ? 21_097
          : k === 2
            ? 5_000
            : k === 5
              ? 10_000
              : ability[i] * (0.6 + next() * 0.8);
      const meters = untimed(i) ? Math.min(raw, 4_500) : raw;
      const p = k === 2 ? pace[i] - 12 : k === 5 ? pace[i] - 6 : pace[i] * (0.97 + next() * 0.06);
      const title =
        k === 2
          ? "5k test"
          : k === 5
            ? "10k test"
            : k === Math.floor(logRows / 2)
              ? "Half marathon"
              : titles[k % titles.length];
      push(i, d, meters, untimed(i) ? 0 : (meters / 500) * p, title, 20 + ((k * 37) % 70));
    });
  }

  // Lift the top `names` rowers over 100,000 m by scaling their rows, so
  // the club roll has the count the dev page asked for; the subject is
  // lifted too when they fall inside that count.
  const totals = new Map<string, number>();
  for (const e of entries) totals.set(e.participantId, (totals.get(e.participantId) ?? 0) + e.meters);
  const order = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const lift = new Map<string, number>();
  order.slice(0, names).forEach(([id, m], k) => {
    const target = GOAL_METERS * (1.02 + (names - k) * 0.035);
    if (m < target) lift.set(id, target / m);
  });
  for (const e of entries) {
    const f = lift.get(e.participantId);
    if (f) {
      e.meters = Math.round(e.meters * f);
      e.seconds = Math.round(e.seconds * f);
    }
  }
  entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.createdAtMs - b.createdAtMs));

  const atMs = final ? Date.UTC(2026, 9, 2, 19, 0, 0) : Date.UTC(2026, 8, dayNumber, 19, 0, 0);
  const blackout: BlackoutState = opts.masked
    ? {
        active: true,
        startsAt: "2026-09-12T07:00:00.000Z",
        endsAt: "2026-09-27T19:00:00.000Z",
      }
    : opts.runup
      ? {
          active: false,
          startsAt: "2026-09-14T07:00:00.000Z",
          endsAt: "2026-09-27T19:00:00.000Z",
          hideLow: 3,
          rampDaysLeft: 2,
        }
      : { active: false };

  return { participants, entries, blackout, atMs, dayNumber, subject };
}

/* firstToGoal.ts's rule on the fake rows (that module reads the db): the
 * earliest crossing of GOAL_METERS by rowed day, then by logged time. */
function firstToGoalOf(inputs: FixtureInputs): { name: string; rowerNumber: number; day: string } | null {
  const cum = new Map<string, number>();
  let best: { id: string; day: string; at: number } | null = null;
  for (const e of inputs.entries) {
    const before = cum.get(e.participantId) ?? 0;
    const after = before + e.meters;
    cum.set(e.participantId, after);
    if (before < GOAL_METERS && after >= GOAL_METERS) {
      if (!best || e.day < best.day || (e.day === best.day && e.createdAtMs < best.at)) {
        best = { id: e.participantId, day: e.day, at: e.createdAtMs };
      }
    }
  }
  if (!best) return null;
  const p = inputs.participants.find((x) => x.id === best.id);
  return p ? { name: p.displayName, rowerNumber: p.rowerNumber, day: best.day } : null;
}

/* Both subjects and the roster, from one set of fake tables. */
export function makeFixture(opts: FixtureOpts = {}): Fixture {
  const inputs = makeFixtureInputs(opts);
  const { participants, entries, blackout, atMs } = inputs;
  const today = pacificDay(atMs);
  const raw = computeBoards(participants, entries, today);
  // The PUBLIC board — boardView's mask with no viewer and no admin.
  const pub = maskBoards(raw, {
    active: blackout.active,
    hideLow: blackout.hideLow,
    admin: false,
  });

  const community = assembleCommunity({
    boards: pub,
    blackout,
    rows: entries.map((e) => ({
      participantId: e.participantId,
      day: e.day,
      createdAtMs: e.createdAtMs,
    })),
    field: entries.map((e) => ({
      participantId: e.participantId,
      meters: e.meters,
      seconds: e.seconds,
    })),
    claim: firstToGoalOf(inputs),
    atMs,
  });

  const p = participants[inputs.subject - 1];
  const rower = assembleRower({
    participant: p,
    entries: entries
      .filter((e) => e.participantId === p.id)
      .map((e) => ({
        day: e.day,
        meters: e.meters,
        seconds: e.seconds,
        title: e.title,
      })),
    pub,
    blackout,
    atMs,
  });

  const roster: PosterRosterRower[] = participants.map((x) => ({
    rowerNumber: x.rowerNumber,
    displayName: x.displayName,
    division: x.division === "M" || x.division === "F" ? x.division : "X",
  }));

  return { community, rower, roster };
}
