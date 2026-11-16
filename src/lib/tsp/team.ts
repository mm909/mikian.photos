import "server-only";
import { randomBytes } from "node:crypto";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, isOwner, type Actor } from "@/lib/permissions";
import { inviteByToken, parseRole, rotateInvite, type Member, type TeamRole, type TeamViewer } from "@/lib/lasd26/team";
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

export type TspMember = Member & {
  captain: boolean;
  /** A name a captain added that nobody has claimed yet: no account, no email. */
  placeholder: boolean;
  /** Target pace, seconds a mile; null = the team's planned pace. */
  paceSec: number | null;
  /** The shift (1, 2, …) the runner is on; 0 = none. */
  squad: number;
};

/** A target pace outside this window is a typo (4:00 to 25:00 a mile). */
export const TARGET_PACE_MIN_SEC = 240;
export const TARGET_PACE_MAX_SEC = 1500;
export const SQUAD_MAX = 6;
/** What a placeholder row carries where an account id goes; never a real Photographer.id. */
export const PLACEHOLDER_PREFIX = "placeholder:";

export function parsePace(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < TARGET_PACE_MIN_SEC || v > TARGET_PACE_MAX_SEC) return undefined;
  return v;
}
export function parseSquad(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= SQUAD_MAX ? v : undefined;
}

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
  placeholder: true,
  paceSec: true,
  squad: true,
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
    const mine = await db.teamMember.findMany({ where: { userId: actor.photographerId, placeholder: false }, select: { team: true, captain: true } });
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

/**
 * A NAMED RUNNER NOBODY HAS CLAIMED YET (owner, 2026-11-16: "I make my team
 * and it has one dummy runner named 'faith' this is because i know she will
 * be running w/ us and I want to assign routes to her but she has not
 * clicked on the link to join"). A member row with no account behind it:
 * legs, a pace and a shift can hang off it, and whoever opens the invite
 * link and says "that's me" takes the row over (claimPlaceholder), so
 * everything assigned to the name is theirs.
 */
export async function addPlaceholder(slug: string, args: { name: string; role?: TeamRole; paceSec?: number | null; squad?: number }): Promise<TspMember> {
  const name = args.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) throw new Error("addPlaceholder: a name is required");
  const row = await db.teamMember.create({
    data: {
      team: slug,
      userId: `${PLACEHOLDER_PREFIX}${randomBytes(12).toString("base64url")}`,
      email: "",
      name,
      role: args.role ?? "runner",
      placeholder: true,
      paceSec: args.paceSec ?? null,
      squad: args.squad ?? 0,
    },
    select: MEMBER_SELECT,
  });
  return asMember(row);
}

/** The names on a team still waiting for someone to claim them, oldest first. */
export async function listPlaceholders(slug: string): Promise<Array<{ id: string; name: string; role: TeamRole }>> {
  const rows = await db.teamMember.findMany({ where: { team: slug, placeholder: true }, orderBy: { joinedAt: "asc" }, select: { id: true, name: true, role: true } });
  return rows.map((r) => ({ id: r.id, name: r.name, role: parseRole(r.role) ?? "runner" }));
}

export type ClaimResult = { ok: true; member: TspMember } | { ok: false; error: string; status: number };

/**
 * "That's me" (owner, 2026-11-16: "When joining a team I should be able to
 * pick one of the already given names or just sign in as usual"): write the
 * signed-in account onto the placeholder row. In one transaction: the invite
 * is live, the row is still unclaimed, and the account is not on the team
 * already (one row per account per team). The name the captain typed stays
 * unless the form sends another; the role, pace, shift and legs stay.
 */
export async function claimPlaceholder(args: { actor: Actor; slug: string; token: string; memberId: string; name?: string }): Promise<ClaimResult> {
  const invite = await inviteByToken(args.token, args.slug);
  if (!invite) return { ok: false, error: "That invite link is not valid any more — ask for a fresh one.", status: 403 };
  const name = (args.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return db.$transaction(async (tx): Promise<ClaimResult> => {
    const mine = await tx.teamMember.findUnique({ where: { team_userId: { team: args.slug, userId: args.actor.photographerId } }, select: { id: true } });
    if (mine) return { ok: false, error: "You are on this team already.", status: 409 };
    // The where clause is the lock: a second claim of the same name updates nothing.
    const done = await tx.teamMember.updateMany({
      where: { id: args.memberId, team: args.slug, placeholder: true },
      data: { userId: args.actor.photographerId, email: args.actor.email, placeholder: false, joinedAt: new Date(), inviteId: invite.id, ...(name ? { name } : {}) },
    });
    if (done.count !== 1) return { ok: false, error: "Someone has taken that name already — pick another, or join as yourself.", status: 409 };
    await tx.teamInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
    const row = await tx.teamMember.findUniqueOrThrow({ where: { id: args.memberId }, select: MEMBER_SELECT });
    return { ok: true, member: asMember(row) };
  });
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
