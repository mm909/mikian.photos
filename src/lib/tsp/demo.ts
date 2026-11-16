import "server-only";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { MI } from "@/app/tsp/lalv/course";
import { loadTeamCourse } from "./courseStore";
import { shiftPlan } from "./legs";
import { addPlaceholder, createTeam, type CreateResult } from "./team";

/**
 * A TEST TEAM (owner, 2026-11-16: "make a test team w/ 8 runners and target
 * paces and allow me to see the route assigned to each runner and where we
 * might put hand off points between shifts").
 *
 * One tap on the hub makes it: the maker as captain (crew, so the eight
 * runners are the whole rotation), eight NAMED runners nobody has claimed —
 * Faith first, his own example — each with a target pace, four to a shift;
 * a start time (the coming Friday, 4:00 AM Pacific — a stand-in so the
 * clock times show); and a plan over the whole course: the two shifts take
 * turns in 24-mile blocks, each rotating its four runners every 3 miles.
 * Everything in it is ordinary data the pages can edit or delete.
 */

const RUNNERS: { name: string; pace: number; squad: number }[] = [
  { name: "Faith", pace: 8 * 60, squad: 1 },
  { name: "Alex", pace: 7 * 60 + 15, squad: 1 },
  { name: "Sam", pace: 8 * 60 + 30, squad: 1 },
  { name: "Jordan", pace: 9 * 60, squad: 1 },
  { name: "Casey", pace: 7 * 60 + 45, squad: 2 },
  { name: "Riley", pace: 8 * 60 + 15, squad: 2 },
  { name: "Morgan", pace: 9 * 60 + 30, squad: 2 },
  { name: "Taylor", pace: 8 * 60 + 45, squad: 2 },
];

/** The coming Friday, 4:00 AM Pacific Standard Time (12:00 UTC). */
function comingFriday(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const add = (5 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

export async function makeDemoTeam(actor: Actor, origin?: string): Promise<CreateResult> {
  const made = await createTeam({ actor, name: "Test team" });
  if (!made.ok) return made;
  const slug = made.team.slug;
  await db.teamMember.updateMany({ where: { team: slug, userId: actor.photographerId }, data: { role: "crew" } });
  const ids: { id: string; squad: number }[] = [];
  for (const r of RUNNERS) {
    const m = await addPlaceholder(slug, { name: r.name, role: "runner", paceSec: r.pace, squad: r.squad });
    ids.push({ id: m.id, squad: r.squad });
  }
  const startAt = comingFriday(new Date());
  await db.tspTeam.update({ where: { slug }, data: { startAt, planPaceSec: 8 * 60 + 30 } });
  const course = await loadTeamCourse(made.team, origin);
  const lengthCm = Math.floor((course.length_m / MI) * 100);
  const legs = shiftPlan({ fromCm: 0, toCm: lengthCm, legCm: 300, shiftCm: 2400, squads: [1, 2].map((s) => ids.filter((x) => x.squad === s).map((x) => x.id)) });
  await db.teamLeg.createMany({ data: legs.map((l) => ({ team: slug, startCm: l.startCm, endCm: l.endCm, memberId: l.memberId })) });
  return { ...made, team: { ...made.team, startAt: startAt.toISOString(), planPaceSec: 8 * 60 + 30 } };
}
