import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getEffectiveActor, isOwner, type Actor } from "@/lib/permissions";
import { lasdPath } from "./paths";

/**
 * The crew's team site (owner, 2026-10-15): who is signed in, whether they
 * are on the team, and the invite that lets someone join.
 *
 * One `team` slug per crew. The LASD26 crew is "lasd26"; the tables carry
 * the slug so a later crossing reuses them. Membership is a TeamMember row
 * keyed by the account (Photographer.id — every Google sign-in resolves to
 * one, lib/permissions). The platform owner is treated as a member of
 * every team for ACCESS (he runs the crossing), and can also join through
 * the link to stand on the roster like everyone else.
 *
 * Roles: "runner" or "crew" (owner: "there's going to be two crew members
 * that are allowed to submit expense reports but aren't running"). Both
 * see and add expenses; the tracker roster is separate (events/lasd26.yaml).
 */

export const TEAM = "lasd26";
export const ROLES = ["runner", "crew"] as const;
export type TeamRole = (typeof ROLES)[number];

export function parseRole(v: unknown): TeamRole | null {
  return v === "runner" || v === "crew" ? v : null;
}

export type Member = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: TeamRole;
  joinedAt: Date;
  paidAt: Date | null;
  paidCents: number | null;
  paidVia: string | null;
};

export type TeamViewer = {
  /** The signed-in account, or null. */
  actor: Actor | null;
  /** Their membership row, or null when they have not joined. */
  member: Member | null;
  /** The platform owner (roles include "owner"). */
  owner: boolean;
  /** Owner or member: may see the team pages. */
  onTeam: boolean;
};

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
} as const;

function asMember(row: { role: string } & Omit<Member, "role">): Member {
  return { ...row, role: parseRole(row.role) ?? "runner" };
}

/** Who is looking, resolved once per request. Never throws: a db hiccup = signed out. */
export async function getTeamViewer(team: string = TEAM): Promise<TeamViewer> {
  let actor: Actor | null = null;
  try {
    actor = await getEffectiveActor();
  } catch {
    actor = null;
  }
  if (!actor) return { actor: null, member: null, owner: false, onTeam: false };
  const owner = isOwner(actor);
  let member: Member | null = null;
  try {
    const row = await db.teamMember.findUnique({
      where: { team_userId: { team, userId: actor.photographerId } },
      select: MEMBER_SELECT,
    });
    member = row ? asMember(row) : null;
  } catch (err) {
    console.error("lasd26/team: member lookup failed (table pushed?)", err);
  }
  return { actor, member, owner, onTeam: owner || member !== null };
}

/** Every member, roster order (joined first). */
export async function listMembers(team: string = TEAM): Promise<Member[]> {
  const rows = await db.teamMember.findMany({ where: { team }, orderBy: { joinedAt: "asc" }, select: MEMBER_SELECT });
  return rows.map(asMember);
}

/* ─── Invites ─────────────────────────────────────────────────────────────── */

/** The one live invite (newest, not disabled), or null. */
export async function currentInvite(team: string = TEAM): Promise<{ id: string; token: string; uses: number; createdAt: Date } | null> {
  return db.teamInvite.findFirst({
    where: { team, disabledAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, uses: true, createdAt: true },
  });
}

/** Make a new link and retire the old one (rotating is the only revocation). */
export async function rotateInvite(createdBy: string, team: string = TEAM): Promise<{ id: string; token: string }> {
  const token = randomBytes(18).toString("base64url");
  await db.teamInvite.updateMany({ where: { team, disabledAt: null }, data: { disabledAt: new Date() } });
  return db.teamInvite.create({ data: { team, token, createdBy }, select: { id: true, token: true } });
}

/** The invite a token names, if it is still live. */
export async function inviteByToken(token: string, team: string = TEAM): Promise<{ id: string } | null> {
  const t = token.trim();
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(t)) return null;
  return db.teamInvite.findFirst({ where: { team, token: t, disabledAt: null }, select: { id: true } });
}

/**
 * The invite link for the page the owner copies. The join page's address
 * comes from paths.ts, so the link follows the site when it moves out of
 * /lasd26/dev (and, while it is there, points at the gated dev copy).
 */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${lasdPath("/join")}?t=${encodeURIComponent(token)}`;
}

/* ─── Joining ─────────────────────────────────────────────────────────────── */

export type JoinResult = { ok: true; member: Member; created: boolean } | { ok: false; error: string; status: number };

/**
 * Join (or update the role of) the signed-in account through a live
 * invite. Idempotent: joining twice updates the row. Name defaults to the
 * Google account's name; the form may override it.
 */
export async function joinTeam(args: { actor: Actor; token: string; role: TeamRole; name?: string; team?: string }): Promise<JoinResult> {
  const team = args.team ?? TEAM;
  const invite = await inviteByToken(args.token, team);
  if (!invite) return { ok: false, error: "That invite link is not valid any more — ask for a fresh one.", status: 403 };
  const name = (args.name ?? "").trim().slice(0, 80) || args.actor.name.trim().slice(0, 80) || args.actor.email;
  const existing = await db.teamMember.findUnique({ where: { team_userId: { team, userId: args.actor.photographerId } }, select: { id: true } });
  const row = await db.teamMember.upsert({
    where: { team_userId: { team, userId: args.actor.photographerId } },
    create: { team, userId: args.actor.photographerId, email: args.actor.email, name, role: args.role, inviteId: invite.id },
    update: { name, role: args.role, email: args.actor.email },
    select: MEMBER_SELECT,
  });
  if (!existing) await db.teamInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } });
  return { ok: true, member: asMember(row), created: !existing };
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

export type Settings = { splitCount: number; settleOpen: boolean };

export async function getSettings(team: string = TEAM): Promise<Settings> {
  try {
    const row = await db.teamSettings.findUnique({ where: { team }, select: { splitCount: true, settleOpen: true } });
    if (row) return row;
  } catch (err) {
    console.error("lasd26/team: settings lookup failed (table pushed?)", err);
  }
  return { splitCount: 18, settleOpen: false };
}

export async function updateSettings(patch: Partial<Settings>, team: string = TEAM): Promise<Settings> {
  const row = await db.teamSettings.upsert({
    where: { team },
    create: { team, splitCount: patch.splitCount ?? 18, settleOpen: patch.settleOpen ?? false },
    update: patch,
    select: { splitCount: true, settleOpen: true },
  });
  return row;
}
