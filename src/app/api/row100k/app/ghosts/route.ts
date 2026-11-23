import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { CHALLENGE, fmtRowerNumber } from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts } from "@/lib/row100kViewer";
import { followingIds, hiddenRowers } from "@/lib/rowSocial";
import { boardView } from "@/app/row100k/boardData";
import { RACES } from "@/app/row100k/raceday";
import { asRower, no, yes } from "../social";

/* THE GHOSTS for the race page of the phone's monitor (owner, 2026-11-22:
 * "race yourself or different versions of your past"; "racing the people
 * that you follow ... not racing their PRs ... just a row that person had
 * ... the closest one to this user"; "because we have real data ... in all
 * those races from race day ... let's make sure we include those").
 * GET ?meters=<the distance the monitor is set to>.
 *
 * Every row the app may replay beside the row in progress, each as its
 * finish time and, when the monitor recorded it, the second it crossed
 * every 100 m line (mobile/src/erg/ghosts.ts draws from that):
 *
 *  - "me": the rower's own rows over exactly this distance, the newest 200.
 *  - "follow": rows over it by the rowers they follow (accepted follows
 *    only), three a rower at most: the ones that finished nearest the
 *    rower's own usual time, so they are boats to row among and not
 *    somebody's best a minute up the lake.
 *  - "race": the recordings the race day monitors saved, when the distance
 *    is the race's, for every racer a recording was assigned to.
 *  - "field": rows over it by ANYBODY ELSE the viewer may be shown, two a
 *    rower at most, the FIELD_ROWERS rowers nearest the viewer's usual time
 *    (owner, 2026-11-22: "sometimes when I demo the row, we don't have
 *    rowers in every lane ... we need to make sure we have rowers in every
 *    lane"). The rowers a viewer follows were the whole field until that
 *    day, and somebody who follows nobody, the App Store's reviewer among
 *    them, opened the race on an empty lake. These are the rows the feed
 *    already shows them. What is still short of four, the app fills with
 *    pace boats (mobile/src/erg/ghosts.ts nextBoat).
 *
 * WHO IS LEFT OUT, by the rules the feed keeps: a private rower who has not
 * accepted the viewer and anybody across a block (lib/rowSocial.ts
 * hiddenRowers), and the rowers the lights-out hides, whose times a ghost
 * would give away. A row logged by hand has no recording: it comes with no
 * marks and is replayed at an even pace.
 *
 * Only the per-second series is read out of a recording (the JSON path in
 * the query), never the whole document with its force curves, and no more
 * than CAP recordings a request. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MINE = 200;
const PER_FOLLOW = 3;
const PER_FIELD = 2;
const FIELD_ROWERS = 60;
const CAP = 80;
/* Recordings read for the field's rows, over the CAP of the rest. */
const FIELD_CAP = 40;
const STEP = 100;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

type Ghost = { id: string; kind: "me" | "follow" | "race" | "field"; name: string; numStr: string; day: string; seconds: number; spm: number; marks: number[] };
type Rec = { id: string; entryId: string | null; participantId: string | null; tenths: number; avgSpm: number | null; startedAt: Date; samples: unknown };

/* "2026-08-12" -> "AUG 12", with the year when it is not this one. */
function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return "";
  const base = `${MONTHS[Number(m[2]) - 1] ?? ""} ${Number(m[3])}`;
  return Number(m[1]) === new Date().getUTCFullYear() ? base : `${base} ${m[1]}`;
}

/* THE SECONDS AT EVERY 100 M LINE, off a recording's ticks (hundredths of
 * a second, tenths of a meter). A series that starts late (a head trimmed
 * on the way to storage) is run in from the start, and one that stops
 * short of the line is run out to the finish, both at an even pace. Under
 * ten usable ticks there is nothing to replay: no marks. */
function marksFrom(samples: unknown, meters: number, seconds: number): number[] {
  if (!Array.isArray(samples) || !(meters > 0) || !(seconds > 0)) return [];
  const pts: [number, number][] = [[0, 0]];
  for (const s of samples) {
    if (!s || typeof s !== "object") continue;
    const t = Number((s as { elapsedHundredths?: unknown }).elapsedHundredths) / 100;
    const d = Number((s as { distanceTenths?: unknown }).distanceTenths) / 10;
    const last = pts[pts.length - 1];
    if (!Number.isFinite(t) || !Number.isFinite(d) || t <= last[0] || d < last[1] || d > meters || t > seconds) continue;
    pts.push([t, d]);
  }
  if (pts.length < 11) return [];
  if (pts[pts.length - 1][1] < meters) pts.push([seconds, meters]);
  const out: number[] = [];
  let i = 1;
  for (let line = STEP; line < meters + STEP; line += STEP) {
    const at = Math.min(line, meters);
    while (i < pts.length - 1 && pts[i][1] < at) i++;
    const [t0, d0] = pts[i - 1];
    const [t1, d1] = pts[i];
    const t = d1 > d0 ? t0 + ((at - d0) / (d1 - d0)) * (t1 - t0) : t1;
    out.push(Math.round(Math.max(t, out[out.length - 1] ?? 0) * 10) / 10);
    if (at === meters) break;
  }
  out[out.length - 1] = seconds;
  return out;
}

export async function GET(req: Request) {
  try {
    const got = await asRower();
    if ("denied" in got) return got.denied;
    const { viewer, me } = got;
    const meters = Math.round(Number(new URL(req.url).searchParams.get("meters")));
    if (!Number.isInteger(meters) || meters < 100 || meters > 100_000) return no("No such distance.", 400);

    /* Who may not be shown: across a block or behind a private account, and
     * whoever the lights-out is hiding. */
    const hidden = new Set(await hiddenRowers(me.id));
    let lightsOut = false;
    try {
      const view = await boardView(viewOpts(viewer));
      for (const id of maskedIds(view.boards)) if (id !== me.id) hidden.add(id);
    } catch (err) {
      console.error("row app ghosts: board unreadable for the mask", err);
      const blackout = previewBlackout(viewer, await activeBlackout());
      lightsOut = blackout.active && !(viewer.isAdmin && !viewer.preview);
    }

    const mine = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE, participantId: me.id, meters, seconds: { gt: 0 } },
      orderBy: { day: "desc" },
      take: MINE,
      select: { id: true, day: true, seconds: true, participantId: true },
    });
    const sorted = mine.map((r) => r.seconds).sort((a, b) => a - b);
    const usual = sorted.length ? sorted[sorted.length >> 1] : 0;

    /* The rowers followed, less the hidden, and their rows over the distance. */
    const follows = lightsOut ? [] : (await followingIds(me.id)).filter((id) => id !== me.id && !hidden.has(id));
    const theirs = follows.length
      ? await db.rowEntry.findMany({
          where: { challenge: CHALLENGE, participantId: { in: follows }, meters, seconds: { gt: 0 } },
          orderBy: { day: "desc" },
          take: 2000,
          select: { id: true, day: true, seconds: true, participantId: true },
        })
      : [];
    const byRower = new Map<string, typeof theirs>();
    for (const r of theirs) byRower.set(r.participantId, [...(byRower.get(r.participantId) ?? []), r]);
    const picked: typeof theirs = [];
    for (const rows of byRower.values()) {
      /* Nearest the viewer's usual time; with no usual, their newest. */
      const order = usual ? [...rows].sort((a, b) => Math.abs(a.seconds - usual) - Math.abs(b.seconds - usual)) : rows;
      picked.push(...order.slice(0, PER_FOLLOW));
    }

    /* Everybody else: the newest rows over the distance by rowers who are
     * not the viewer, not followed (they are above) and not hidden. Each
     * rower's two nearest the viewer's usual time; then the rowers whose
     * nearest is nearest. With no usual time, the middle of these rows
     * stands in for it. */
    const known = new Set([me.id, ...follows]);
    const rest = lightsOut
      ? []
      : await db.rowEntry.findMany({
          where: { challenge: CHALLENGE, meters, seconds: { gt: 0 }, participantId: { notIn: [...known, ...hidden] } },
          orderBy: { day: "desc" },
          take: 3000,
          select: { id: true, day: true, seconds: true, participantId: true },
        });
    const restSorted = rest.map((r) => r.seconds).sort((a, b) => a - b);
    const aim = usual || (restSorted.length ? restSorted[restSorted.length >> 1] : 0);
    const byOther = new Map<string, typeof rest>();
    for (const r of rest) byOther.set(r.participantId, [...(byOther.get(r.participantId) ?? []), r]);
    const others = [...byOther.values()]
      .map((rows) => [...rows].sort((a, b) => Math.abs(a.seconds - aim) - Math.abs(b.seconds - aim)).slice(0, PER_FIELD))
      .sort((a, b) => Math.abs(a[0].seconds - aim) - Math.abs(b[0].seconds - aim))
      .slice(0, FIELD_ROWERS)
      .flat();

    const people = new Map<string, { displayName: string; rowerNumber: number }>();
    const need = [...new Set([...picked, ...others].map((r) => r.participantId))];
    if (need.length) for (const p of await db.rowParticipant.findMany({ where: { id: { in: need } }, select: { id: true, displayName: true, rowerNumber: true } })) people.set(p.id, p);

    /* The recordings behind those rows: the series only. */
    const entryIds = [...mine, ...picked].map((r) => r.id);
    const sim = process.env.NODE_ENV !== "production";
    const recs = entryIds.length
      ? await db.$queryRaw<Rec[]>`SELECT "id", "entryId", "participantId", "tenths", "avgSpm", "startedAt", "data"->'samples' AS "samples" FROM "RowTelemetry" WHERE "meters" = ${meters} AND ("simulated" = false OR ${sim}) AND "entryId" IN (${Prisma.join(entryIds)}) ORDER BY "startedAt" DESC LIMIT ${CAP}`
      : [];
    const otherIds = others.map((r) => r.id);
    const fieldRecs = otherIds.length
      ? await db.$queryRaw<Rec[]>`SELECT "id", "entryId", "participantId", "tenths", "avgSpm", "startedAt", "data"->'samples' AS "samples" FROM "RowTelemetry" WHERE "meters" = ${meters} AND ("simulated" = false OR ${sim}) AND "entryId" IN (${Prisma.join(otherIds)}) ORDER BY "startedAt" DESC LIMIT ${FIELD_CAP}`
      : [];
    const recOf = new Map<string, Rec>();
    for (const r of [...recs, ...fieldRecs]) if (r.entryId && !recOf.has(r.entryId)) recOf.set(r.entryId, r);

    const ghosts: Ghost[] = [];
    const push = (r: { id: string; day: string; seconds: number; participantId: string }, kind: "me" | "follow" | "field") => {
      const rec = recOf.get(r.id);
      const seconds = rec && rec.tenths > 0 ? rec.tenths / 10 : r.seconds;
      const who = people.get(r.participantId);
      ghosts.push({
        id: r.id,
        kind,
        name: kind === "me" ? "" : (who?.displayName ?? "Rower"),
        numStr: kind === "me" ? fmtRowerNumber(me.rowerNumber) : who ? fmtRowerNumber(who.rowerNumber) : "",
        day: dayLabel(r.day),
        seconds,
        spm: rec?.avgSpm ?? 0,
        marks: rec ? marksFrom(rec.samples, meters, seconds) : [],
      });
    };
    for (const r of mine) push(r, "me");
    for (const r of picked) push(r, "follow");
    for (const r of others) push(r, "field");

    /* RACE DAY: what the monitors in the room recorded, for the racers a
     * recording carries. One a racer, their own row left to "me" above when
     * it is already a logged row of theirs. */
    for (const race of RACES) {
      if (race.meters !== meters || lightsOut) continue;
      const from = new Date(`${race.day}T07:00:00Z`);
      const to = new Date(from.getTime() + 24 * 3600 * 1000);
      const raced = await db.$queryRaw<Rec[]>`SELECT "id", "entryId", "participantId", "tenths", "avgSpm", "startedAt", "data"->'samples' AS "samples" FROM "RowTelemetry" WHERE "meters" = ${meters} AND "simulated" = false AND "participantId" IS NOT NULL AND "tenths" > 0 AND "startedAt" >= ${from} AND "startedAt" < ${to} ORDER BY "tenths" ASC LIMIT ${CAP}`;
      const ids = [...new Set(raced.map((r) => r.participantId as string))].filter((id) => !hidden.has(id));
      const racers = new Map<string, { displayName: string; rowerNumber: number }>();
      if (ids.length) for (const p of await db.rowParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, rowerNumber: true } })) racers.set(p.id, p);
      const seen = new Set<string>();
      for (const r of raced) {
        const pid = r.participantId as string;
        const who = racers.get(pid);
        if (!who || seen.has(pid) || (r.entryId && ghosts.some((g) => g.id === r.entryId))) continue;
        seen.add(pid);
        const seconds = r.tenths / 10;
        ghosts.push({ id: r.id, kind: pid === me.id ? "me" : "race", name: pid === me.id ? "" : who.displayName, numStr: fmtRowerNumber(who.rowerNumber), day: dayLabel(race.day), seconds, spm: r.avgSpm ?? 0, marks: marksFrom(r.samples, meters, seconds) });
      }
    }

    ghosts.sort((a, b) => a.seconds - b.seconds);
    return yes({ meters, ghosts });
  } catch (err) {
    console.error("row app ghosts: failed", err);
    return no("The field could not be read.", 500);
  }
}
