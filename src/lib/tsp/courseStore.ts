import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { courseUrl, parseRoute, type CourseFile } from "@/app/tsp/lalv/course";
import { tspApi } from "./paths";
import type { TspTeam } from "./team";

/**
 * WHICH COURSE A TEAM READS (owner, 2026-11-16: "allow me to clean up/edit a
 * map"). The stock courses are files in public/tsp/lalv-course. Once a
 * captain fixes a stretch (lib/tsp/courseFix.ts) the team has its own copy in
 * TeamCourse, cut from one stock course (`base`); it counts only while the
 * team is still on that course — switch route or the secrets flag and the
 * team reads the stock file again, the row waiting untouched.
 */

type Based = { route: string; secrets: boolean };

/** "powerline", "og-secrets", … — the stock course a team is on. */
export function teamCourseBase(team: Based): string {
  return `${parseRoute(team.route)}${team.secrets ? "-secrets" : ""}`;
}

const apiUrl = (slug: string, updatedAt: Date) => `${tspApi(slug, "/course")}?v=${updatedAt.getTime()}`;

/** The address the team's pages fetch the course from: the team's own copy when it has one for this course, else the stock file. */
export async function teamCourseUrl(team: TspTeam): Promise<string> {
  try {
    const row = await db.teamCourse.findUnique({ where: { team: team.slug }, select: { base: true, updatedAt: true } });
    if (row && row.base === teamCourseBase(team)) return apiUrl(team.slug, row.updatedAt);
  } catch (err) {
    console.error("tsp/courseStore: course lookup failed (table pushed?)", err);
  }
  return courseUrl(team.route, team.secrets);
}

/**
 * The stock file. Read off the disk; on a serverless host where the public
 * folder did not travel with the function, fetched from the site itself
 * (`origin`, e.g. new URL(req.url).origin) — the file is public either way.
 */
export async function stockCourse(team: Based, origin?: string): Promise<CourseFile> {
  const file = `course-${teamCourseBase(team)}.json`;
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public", "tsp", "lalv-course", file), "utf8")) as CourseFile;
  } catch (err) {
    if (!origin) throw err;
    const res = await fetch(new URL(courseUrl(team.route, team.secrets), origin), { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`stock course ${file}: HTTP ${res.status}`);
    return (await res.json()) as CourseFile;
  }
}

/** The team's course: its own copy when it has one for this course, else the stock file. */
export async function loadTeamCourse(team: TspTeam, origin?: string): Promise<CourseFile> {
  try {
    const row = await db.teamCourse.findUnique({ where: { team: team.slug }, select: { base: true, json: true } });
    if (row && row.base === teamCourseBase(team)) return JSON.parse(row.json) as CourseFile;
  } catch (err) {
    console.error("tsp/courseStore: course read failed (table pushed?)", err);
  }
  return stockCourse(team, origin);
}

/** The address of a copy saved at `updatedAt` (what a save answers with). */
export const savedCourseUrl = apiUrl;
