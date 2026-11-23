import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { CHALLENGE, fmtRowerNumber } from "@/lib/row100k";
import { hiddenRowers } from "@/lib/rowSocial";
import { asRower, no, yes } from "../social";

/* WHO IS ROWING THE SAME DISTANCE THIS MINUTE, for the race page of the
 * phone's monitor (owner, 2026-11-22: "you should work on supporting this
 * live. We don't have to turn it on right now, but we should consider what
 * needs to happen for if me and someone else are right next to each other,
 * or across the world ... someone's rowing a 5K, and I'm also rowing a 5K,
 * I should be able to see them, and they should be noted").
 *
 * NOT ON. With ROW_LIVE_RACE unset on the host this answers `on: false` to
 * everybody and touches no table; the app asks once a piece and stops
 * (mobile/src/erg/liveRace.ts). Setting it to 1 turns it on, with no app
 * update.
 *
 * POST, every three seconds while the monitor is set to a distance:
 *   { meters, t, m, spm, marks, ended, demo }
 * the distance set, the seconds on the monitor, the meters rowed, and the
 * second each 100 m line was crossed. It is kept as the one line this rower
 * has in RowLive, and the answer is everybody else's line over the same
 * distance: a rower who spoke in the last twenty seconds, or one who has
 * finished within the last half hour (so whoever finishes first stays on
 * the other's water). A demo row is answered and never kept.
 *
 * Each line is answered with how many seconds old it is, and from that and
 * its own rower's seconds the app puts every one of them where they are
 * this second (mobile/src/erg/liveRace.ts): a rower who pulled first is up
 * the course, and two who pull together are level. A countdown that starts
 * two rowers together is not built (mobile/DESIGN.md, rounds 27 and 28).
 *
 * WHO IS LEFT OUT, by the feed's rules: a private rower who has not
 * accepted the viewer and anybody across a block (lib/rowSocial.ts
 * hiddenRowers). While the lights are out nobody is answered at all. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Read at each request, so a dev server follows its env file. */
const on = () => process.env.ROW_LIVE_RACE === "1";
const FRESH_S = 20;
const KEPT_S = 30 * 60;
const MOST = 8;
const STEP = 100;

type Line = { participantId: string; elapsed: number; distance: number; spm: number; marks: unknown; ended: boolean; age: number; displayName: string; rowerNumber: number };

/* Who a viewer may not be shown, kept a minute: the answer is asked for
 * every three seconds and does not change that fast. */
const hides = new Map<string, { at: number; ids: Set<string>; dark: boolean }>();
async function hiddenFrom(viewerId: string): Promise<{ ids: Set<string>; dark: boolean }> {
  const got = hides.get(viewerId);
  if (got && Date.now() - got.at < 60_000) return got;
  const [ids, blackout] = await Promise.all([hiddenRowers(viewerId), activeBlackout()]);
  const next = { at: Date.now(), ids: new Set(ids), dark: blackout.active };
  if (hides.size > 500) hides.clear();
  hides.set(viewerId, next);
  return next;
}

const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

export async function POST(req: Request) {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    if (!on()) return yes({ on: false });
    const { me } = got;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const meters = num(body?.meters, 100, 100_000);
    const t = num(body?.t, 0, 86_400);
    const m = num(body?.m, 0, 100_000);
    if (meters === null || t === null || m === null || !Number.isInteger(meters) || m > meters + 1) return no("That is not a row.", 400);
    const spm = Math.round(num(body?.spm, 0, 99) ?? 0);
    const ended = body?.ended === true;
    /* The lines crossed, in order, each after the one before and none
     * after the seconds on the monitor. */
    const marks: number[] = [];
    if (Array.isArray(body?.marks)) {
      for (const v of body.marks.slice(0, Math.ceil(meters / STEP))) {
        const s = num(v, 0, t + 1);
        if (s === null || s <= (marks[marks.length - 1] ?? 0)) break;
        marks.push(Math.round(s * 10) / 10);
      }
    }

    if (body?.demo !== true && m >= 1) {
      const startedAt = new Date(Date.now() - t * 1000);
      await db.$executeRaw`INSERT INTO "RowLive" ("participantId", "challenge", "meters", "elapsed", "distance", "spm", "marks", "ended", "startedAt", "updatedAt")
        VALUES (${me.id}, ${CHALLENGE}, ${meters}, ${t}, ${m}, ${spm}, ${JSON.stringify(marks)}::jsonb, ${ended}, ${startedAt}, NOW())
        ON CONFLICT ("participantId") DO UPDATE SET "challenge" = EXCLUDED."challenge", "meters" = EXCLUDED."meters", "elapsed" = EXCLUDED."elapsed", "distance" = EXCLUDED."distance", "spm" = EXCLUDED."spm", "marks" = EXCLUDED."marks", "ended" = EXCLUDED."ended", "startedAt" = EXCLUDED."startedAt", "updatedAt" = NOW()`;
    }

    const { ids, dark } = await hiddenFrom(me.id);
    if (dark) return yes({ on: true, rowers: [] });
    const lines = await db.$queryRaw<Line[]>`SELECT l."participantId", l."elapsed", l."distance", l."spm", l."marks", l."ended", EXTRACT(EPOCH FROM (NOW() - l."updatedAt"))::float8 AS "age", p."displayName", p."rowerNumber"
      FROM "RowLive" l JOIN "RowParticipant" p ON p."id" = l."participantId"
      WHERE l."challenge" = ${CHALLENGE} AND l."meters" = ${meters} AND l."participantId" <> ${me.id} AND l."distance" >= 20
        AND (l."updatedAt" > NOW() - make_interval(secs => ${FRESH_S}) OR (l."ended" AND l."updatedAt" > NOW() - make_interval(secs => ${KEPT_S})))
      ORDER BY l."updatedAt" DESC LIMIT ${MOST * 3}`;
    const rowers = lines
      .filter((l) => !ids.has(l.participantId))
      .slice(0, MOST)
      .map((l) => ({ id: l.participantId, name: l.displayName, numStr: fmtRowerNumber(l.rowerNumber), t: l.elapsed, m: l.distance, spm: l.spm, marks: Array.isArray(l.marks) ? l.marks.filter((v): v is number => typeof v === "number") : [], ended: l.ended, age: Math.max(0, Math.round(Number(l.age) * 10) / 10) }));
    return yes({ on: true, rowers });
  } catch (err) {
    /* The table is not there, or the database is not: the race page goes
     * on without anybody live, and the app stops asking for this piece. */
    console.error("row app live: failed", err);
    return yes({ on: false });
  }
}
