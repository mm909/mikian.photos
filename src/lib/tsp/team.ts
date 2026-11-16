import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isOwner, type Actor } from "@/lib/permissions";
import { parseRole, rotateInvite, type Member, type TeamViewer } from "@/lib/lasd26/team";
import { RESERVED_SLUGS, TSP_EVENT, slugify, teamPath } from "./paths";

/**
 * THE TSP TEAMS (owner, 2026-11-16: "allow for there to be multiple teams,
 * multiple team captains, and the users … someone make the team and then
 * getting a link to join the team and then signing in with Google. I think
 * that process worked pretty good.").
 *
 * A team is a TspTeam row; its slug is the `team` key on the shared Team*
 * tables, so membership, the invite link, expenses, receipts and the info
 * sheet are the lasd26 machinery with a different key (every function in
 * lib/lasd26 takes the team).
 *
 * WHO IS WHO. A CAPTAIN is a TeamMember with captain = true: whoever made
 * the team, and anyone a captain promotes. The viewer handed to the shared
 * code says `owner: true` for a captain — on a TSP team "the owner's alone"
 * (estimates, editing any line, the info sheet's pencil, the invite link)
 * means the captains'. The platform owner counts as a captain of every team
 * for access, without a member row until he joins one.
 */

export type TspTeam = {
  slug: string;
  event: string;
  name: string;
  secrets: boolean;
  shareVan: boolean;
  /** Which course the team runs (src/app/tsp/lalv/course.ts ROUTES). */
  route: string;
  /** ISO, or null while no start is set. */
  startAt: string | null;
  planPaceSec: number;
};

export type TspMember = Member & { captain: boolean };

export type TspViewer = TeamViewer & {
  team: TspTeam;
  member: TspMember | null;
  /** A captain of this team, or the platform owner. Same as `owner`. */
  captain: boolean;
  platformOwner: boolean;
};

const TEAM_SELECT = { slug: true, event: true, name: true, secrets: true, shareVan: true, route: true, startAt: true, planPaceSec: true } as const;
const MEMBER_SELECT = {
  id: true,
  userId: true,
  email: true,
  name: true,
  role: true,
  joinedAt: true,
  paidAt: true,
  paidCents: true,
  paidVia: true,
  settledAt: true,
  settledCents: true,
  captain: true,
} as const;

type TeamRow = { slug: string; event: string; name: string; secrets: boolean; shareVan: boolean; route: string; startAt: Date | null; planPaceSec: number };
const asTeam = (r: TeamRow): TspTeam => ({ ...r, startAt: r.startAt ? r.startAt.toISOString() : null });
const asMember = (row: { role: string; captain: boolean } & Omit<TspMember, "role">): TspMember => ({ ...row, role: parseRole(row.role) ?? "runner" });

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

/** The signed-in account, or null. Never throws. */
export async function tspActor(): Promise<Actor | null> {
  try {
    return await getEffectiveActor();
  } catch {
    return null;
  }
}

/**
 * THE DEV GATE (CLAUDE.md, "New pages start in development"): admin-only in
 * production until the owner says the TSP site is live, open on a laptop.
 * Pages call it first; it hands back the actor it had to look up anyway.
 */
export const TSP_LIVE = false;

export function tspGateOpen(actor: Actor | null): boolean {
  return TSP_LIVE || process.env.NODE_ENV !== "production" || (actor !== null && isOwner(actor));
}

export async function gateTspDev(): Promise<Actor | null> {
  const actor = await tspActor();
  if (!tspGateOpen(actor)) notFound();
  return actor;
}

/** "Some page (dev)" while the site sits behind the gate. */
export const tspTitle = (title: string) => (TSP_LIVE ? title : `${title} (dev)`);

export async function getTeam(slug: string): Promise<TspTeam | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const row = await db.tspTeam.findUnique({ where: { slug }, select: TEAM_SELECT });
    return row ? asTeam(row) : null;
  } catch (err) {
    console.error("tsp/team: team lookup failed (table pushed?)", err);
    return null;
  }
}

/** Who is looking at this team, or null when there is no such team. */
export async function getTspViewer(slug: string, known?: Actor | null): Promise<TspViewer | null> {
  const team = await getTeam(slug);
  if (!team) return null;
  const actor = known === undefined ? await tspActor() : known;
  if (!actor) return { team, actor: null, member: null, owner: false, onTeam: false, captain: false, platformOwner: false };
  const platformOwner = isOwner(actor);
  let member: TspMember | null = null;
  try {
    const row = await db.teamMember.findUnique({ where: { team_userId: { team: slug, userId: actor.photographerId } }, select: MEMBER_SELECT });
    member = row ? asMember(row) : null;
  } catch (err) {
    console.error("tsp/team: member lookup failed", err);
  }
  const captain = platformOwner || member?.captain === true;
  return { team, actor, member, owner: captain, onTeam: captain || member !== null, captain, platformOwner };
}

/** Every member, captains first, then by when they joined. */
export async function listTspMembers(slug: string): Promise<TspMember[]> {
  const rows = await db.teamMember.findMany({ where: { team: slug }, orderBy: [{ captain: "desc" }, { joinedAt: "asc" }], select: MEMBER_SELECT });
  return rows.map(asMember);
}

/** The teams this account is on (the platform owner: every team), newest first. */
export async function myTeams(actor: Actor): Promise<Array<TspTeam & { captain: boolean; members: number }>> {
  try {
    const mine = await db.teamMember.findMany({ where: { userId: actor.photographerId }, select: { team: true, captain: true } });
    const all = isOwner(actor);
    const teams = await db.tspTeam.findMany({
      where: all ? { event: TSP_EVENT } : { event: TSP_EVENT, slug: { in: mine.map((m) => m.team) } },
      orderBy: { createdAt: "desc" },
      select: TEAM_SELECT,
    });
    if (teams.length === 0) return [];
    const counts = await db.teamMember.groupBy({ by: ["team"], where: { team: { in: teams.map((t) => t.slug) } }, _count: { _all: true } });
    const n = new Map(counts.map((c) => [c.team, c._count._all] as const));
    const cap = new Map(mine.map((m) => [m.team, m.captain] as const));
    return teams.map((t) => ({ ...asTeam(t), captain: all || cap.get(t.slug) === true, members: n.get(t.slug) ?? 0 }));
  } catch (err) {
    console.error("tsp/team: myTeams failed (table pushed?)", err);
    return [];
  }
}

export type CreateResult = { ok: true; team: TspTeam; inviteToken: string } | { ok: false; error: string; status: number };

/**
 * Make a team: the row, the maker as its first captain (role "runner", name
 * from the account unless the form says otherwise) and the first invite
 * link. The slug comes from the name; a taken one gets "-2", "-3"….
 */
export async function createTeam(args: { actor: Actor; name: string; secrets?: boolean; yourName?: string }): Promise<CreateResult> {
  const name = args.name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) return { ok: false, error: "Give the team a name.", status: 400 };
  const base = slugify(name);
  if (base.length < 2) return { ok: false, error: "Use some letters or numbers in the name.", status: 400 };
  let slug = "";
  for (let i = 1; i <= 30 && !slug; i++) {
    const tryIt = i === 1 ? base : `${base.slice(0, 28)}-${i}`;
    if (RESERVED_SLUGS.has(tryIt) || !SLUG_RE.test(tryIt)) continue;
    // A team key some other crew already uses on the shared tables is taken too.
    const [team, member] = await Promise.all([db.tspTeam.findUnique({ where: { slug: tryIt }, select: { slug: true } }), db.teamMember.findFirst({ where: { team: tryIt }, select: { id: true } })]);
    if (!team && !member) slug = tryIt;
  }
  if (!slug) return { ok: false, error: "That name is taken — try another.", status: 409 };
  const you = (args.yourName ?? "").trim().slice(0, 80) || args.actor.name.trim().slice(0, 80) || args.actor.email;
  const row = await db.tspTeam.create({ data: { slug, event: TSP_EVENT, name, createdById: args.actor.photographerId, secrets: args.secrets === true }, select: TEAM_SELECT });
  await db.teamMember.create({ data: { team: slug, userId: args.actor.photographerId, email: args.actor.email, name: you, role: "runner", captain: true } });
  const invite = await rotateInvite(args.actor.photographerId, slug);
  return { ok: true, team: asTeam(row), inviteToken: invite.token };
}

/** The invite link a captain copies: /tsp/lalv/<slug>/join?t=<token>. */
export function tspInviteUrl(origin: string, slug: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${teamPath(slug, "/join")}?t=${encodeURIComponent(token)}`;
}

export type TeamPatch = { name?: string; secrets?: boolean; shareVan?: boolean; route?: string; startAt?: string | null; planPaceSec?: number };

export async function updateTeam(slug: string, patch: TeamPatch): Promise<TspTeam> {
  const row = await db.tspTeam.update({
    where: { slug },
    data: { ...patch, startAt: patch.startAt === undefined ? undefined : patch.startAt === null ? null : new Date(patch.startAt) },
    select: TEAM_SELECT,
  });
  return asTeam(row);
}
