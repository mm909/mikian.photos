import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { members, pretendLines, readLobby, type Line } from "@/app/row100k/club";
import { asRower, no, yes } from "../../social";

/* WHERE EVERYBODY IN ROW CLUB IS, once a second while the club row is on
 * (row100k/club.ts). POST { t, m, spm, marks, ended, demo }: the seconds
 * on this rower's monitor, the meters, the second each 100 m line was
 * crossed. It is kept as this rower's line in RowLive (as the live race
 * keeps it), and the answer is every other member's line since the start,
 * in the live race's own shape, so the race page puts them in its lanes
 * as it does a live rower (mobile/src/erg/liveRace.ts). A demo row is
 * answered and never kept. Only members of the open lobby are answered. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FRESH_S = 20;
const STEP = 100;
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

type Row = { participantId: string; elapsed: number; distance: number; spm: number; marks: unknown; ended: boolean; age: number };

export async function POST(req: Request) {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    const { me } = got;
    const l = await readLobby();
    if (!l || !l.startsAt) return yes({ on: false });
    const list = await members(l.id);
    if (!list.some((x) => x.id === me.id)) return no("Join Row Club first.", 403);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const t = num(body?.t, 0, 86_400);
    const m = num(body?.m, 0, 100_000);
    if (t === null || m === null) return no("That is not a row.", 400);
    const spm = Math.round(num(body?.spm, 0, 99) ?? 0);
    const ended = body?.ended === true;
    const marks: number[] = [];
    if (Array.isArray(body?.marks)) {
      for (const v of body.marks.slice(0, 1000)) {
        const s = num(v, 0, t + 1);
        if (s === null || s <= (marks[marks.length - 1] ?? 0)) break;
        marks.push(Math.round(s * 10) / 10);
      }
    }
    if (body?.demo !== true && m >= 1) {
      const startedAt = new Date(Date.now() - t * 1000);
      await db.$executeRaw`INSERT INTO "RowLive" ("participantId", "challenge", "meters", "elapsed", "distance", "spm", "marks", "ended", "startedAt", "updatedAt")
        VALUES (${me.id}, ${CHALLENGE}, ${l.meters}, ${t}, ${m}, ${spm}, ${JSON.stringify(marks)}::jsonb, ${ended}, ${startedAt}, NOW())
        ON CONFLICT ("participantId") DO UPDATE SET "challenge" = EXCLUDED."challenge", "meters" = EXCLUDED."meters", "elapsed" = EXCLUDED."elapsed", "distance" = EXCLUDED."distance", "spm" = EXCLUDED."spm", "marks" = EXCLUDED."marks", "ended" = EXCLUDED."ended", "startedAt" = EXCLUDED."startedAt", "updatedAt" = NOW()`;
    }
    const others = list.filter((x) => x.id !== me.id);
    const ids = others.map((x) => x.id);
    const since = new Date(l.startsAt - 60_000);
    const rows = ids.length
      ? await db.$queryRaw<Row[]>`SELECT "participantId", "elapsed", "distance", "spm", "marks", "ended", EXTRACT(EPOCH FROM (NOW() - "updatedAt"))::float8 AS "age"
          FROM "RowLive" WHERE "participantId" = ANY(${ids}) AND "startedAt" >= ${since} AND "distance" >= 1
            AND ("updatedAt" > NOW() - make_interval(secs => ${FRESH_S}) OR "ended")`
      : [];
    const who = new Map(others.map((x) => [x.id, x]));
    const lines: Line[] = rows.map((r) => {
      const w = who.get(r.participantId)!;
      return { id: r.participantId, name: w.name, numStr: w.numStr, t: r.elapsed, m: r.distance, spm: r.spm, marks: Array.isArray(r.marks) ? r.marks.filter((v): v is number => typeof v === "number").slice(0, Math.ceil(l.meters / STEP) + 1) : [], ended: r.ended, age: Math.max(0, Math.round(Number(r.age) * 10) / 10) };
    });
    return yes({ on: true, meters: l.meters, rowers: [...lines, ...pretendLines(l)] });
  } catch (err) {
    console.error("row club position: failed", err);
    return yes({ on: false });
  }
}
