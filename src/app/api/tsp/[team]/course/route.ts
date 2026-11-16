import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { courseUrl } from "@/app/tsp/lalv/course";
import { bad, badJson, readJson, requireTsp, requireTspCaptain } from "@/lib/tsp/guard";
import { FixError, fixStretch, parseFixArgs, remapLegs } from "@/lib/tsp/courseFix";
import { loadTeamCourse, savedCourseUrl, teamCourseBase, teamCourseUrl } from "@/lib/tsp/courseStore";

/**
 * /api/tsp/[team]/course — the team's own copy of its course (owner,
 * 2026-11-16: "allow me to clean up/edit a map"; lib/tsp/courseFix.ts).
 *
 *   GET    → the course file the team reads: its own copy when it has fixed
 *            a stretch, else the stock file. Any member.
 *   POST   { fromM, toM, vias: [lon,lat][], mode: "road" | "straight", save? }
 *          → { ok, saved, stretch, oldM, newM, lengthM, url }. Without `save`
 *            it is a PREVIEW: nothing is written. With it, the course is
 *            stored and the team's legs move with it, in one transaction.
 *            Captains.
 *   DELETE → drop the team's copy: back to the stock route. Captains. The
 *            legs are left where they are (the stock miles differ by
 *            whatever the fixes added up to).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  try {
    const course = await loadTeamCourse(gate.viewer.team, new URL(req.url).origin);
    return NextResponse.json(course, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (err) {
    console.error("tsp/course: could not read the course", err);
    return bad("The course could not be read — try again.", 500);
  }
}

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspCaptain(params.team);
  if (gate.res) return gate.res;
  const actor = gate.viewer.actor;
  if (!actor) return bad("Sign in first.", 401);
  const body = await readJson(req);
  if (!body) return badJson();
  const args = parseFixArgs(body);
  if (typeof args === "string") return bad(args);
  const team = gate.viewer.team;
  const save = body.save === true;

  let course;
  try {
    course = await loadTeamCourse(team, new URL(req.url).origin);
  } catch (err) {
    console.error("tsp/course: could not read the course", err);
    return bad("The course could not be read — try again.", 500);
  }

  let fix;
  try {
    fix = await fixStretch(course, args);
  } catch (err) {
    if (err instanceof FixError) return bad(err.message, err.status);
    console.error("tsp/course: fix failed", err);
    return bad("That did not work — try again.", 500);
  }
  const answer = { ok: true as const, stretch: fix.stretch, oldM: Math.round(fix.oldM), newM: Math.round(fix.newM), lengthM: fix.course.length_m };
  if (!save) return NextResponse.json({ ...answer, saved: false, url: await teamCourseUrl(team) });

  const base = teamCourseBase(team);
  const json = JSON.stringify(fix.course);
  try {
    const before = await db.teamCourse.findUnique({ where: { team: team.slug }, select: { base: true, edits: true } });
    // A copy cut from another course (the team switched route since) is replaced, and the count starts over.
    const edits = before && before.base === base ? before.edits + 1 : 1;
    const legs = await db.teamLeg.findMany({ where: { team: team.slug }, select: { id: true, startCm: true, endCm: true } });
    const moved = remapLegs(legs, { fromM: Math.max(0, args.fromM), oldM: fix.oldM, newM: fix.newM }, fix.course.length_m);
    const kept = new Map(moved.map((l) => [l.id, l] as const));
    const gone = legs.filter((l) => !kept.has(l.id)).map((l) => l.id);
    const changed = moved.filter((l) => {
      const was = legs.find((x) => x.id === l.id);
      return !was || was.startCm !== l.startCm || was.endCm !== l.endCm;
    });
    const [row] = await db.$transaction([
      db.teamCourse.upsert({
        where: { team: team.slug },
        create: { team: team.slug, base, json, edits, updatedBy: actor.photographerId },
        update: { base, json, edits, updatedBy: actor.photographerId },
        select: { updatedAt: true },
      }),
      ...(gone.length ? [db.teamLeg.deleteMany({ where: { team: team.slug, id: { in: gone } } })] : []),
      ...changed.map((l) => db.teamLeg.update({ where: { id: l.id }, data: { startCm: l.startCm, endCm: l.endCm } })),
    ]);
    const updatedAt = (row as { updatedAt: Date }).updatedAt;
    return NextResponse.json({ ...answer, saved: true, url: savedCourseUrl(team.slug, updatedAt) });
  } catch (err) {
    console.error("tsp/course: save failed", err);
    return bad("The fix could not be saved — try again.", 500);
  }
}

export async function DELETE(_req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspCaptain(params.team);
  if (gate.res) return gate.res;
  const team = gate.viewer.team;
  try {
    await db.teamCourse.deleteMany({ where: { team: team.slug } });
  } catch (err) {
    console.error("tsp/course: delete failed", err);
    return bad("That did not work — try again.", 500);
  }
  return NextResponse.json({ ok: true, url: courseUrl(team.route, team.secrets) });
}
