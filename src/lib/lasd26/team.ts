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
  /** 'card' | 'paypal' | 'manual' | null. */
  paidVia: string | null;
  /** The owner paid them out of the pool (they fronted more than their share): when, how much. */
  settledAt: Date | null;
  settledCents: number | null;
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
  settledAt: true,
  settledCents: true,
} as const;

function asMember(row: { role: string } & Omit<Member, "role">): Member {
  return { ...row, role: parseRole(row.role) ?? "runner" };
}

/**
 * The owner's own member row, made on the way in. He runs the crossing and
 * is on the crew, so every page that files money by member — expenses
 * (PAID BY defaults to the signed-in member, owner, 2026-10-16: "auto fill
 * the name of the user logged in"), the pay page (his share, what he
 * fronted) and the team console (the roster with him on it) — needs him to
 * have one before he has taken his own invite link. Same upsert joinTeam
 * does, without a token: role "runner", name and email from the account;
 * a later join through the link only updates the row. Anyone else is
 * either a member already or not on the team, and comes back unchanged.
 * Never throws: when the table is not there yet he is simply not a member.
 */
export async function ensureOwnerMember(viewer: TeamViewer, team: string = TEAM): Promise<TeamViewer> {
  if (!viewer.owner || viewer.member || !viewer.actor) return viewer;
  const actor = viewer.actor;
  const name = actor.name.trim().slice(0, 80) || actor.email;
  try {
    const row = await db.teamMember.upsert({
      where: { team_userId: { team, userId: actor.photographerId } },
      create: { team, userId: actor.photographerId, email: actor.email, name, role: "runner" },
      update: {},
      select: MEMBER_SELECT,
    });
    return { ...viewer, member: asMember(row), onTeam: true };
  } catch (err) {
    console.error("lasd26/team: owner member upsert failed (table pushed?)", err);
    return viewer;
  }
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
 * comes from paths.ts (live at /lasd26/join since 2026-10-16).
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

/**
 * The split and the settle-up switch, plus the three ETA knobs of
 * /lasd26/route (owner, 2026-10-21; src/app/lasd26/route/eta.ts): the van
 * drive in minutes, the start (null = the planned 5:00 AM PT Friday, kept
 * as ISO on the wire) and the planned pace in seconds a mile that holds
 * until the van's first check-in.
 */
export type Settings = {
  splitCount: number;
  settleOpen: boolean;
  etaDriveMin: number;
  etaStartAt: string | null;
  etaPlanPaceSec: number;
};

const SETTINGS_SELECT = { splitCount: true, settleOpen: true, etaDriveMin: true, etaStartAt: true, etaPlanPaceSec: true } as const;
const DEFAULT_SETTINGS: Settings = { splitCount: 18, settleOpen: false, etaDriveMin: 25, etaStartAt: null, etaPlanPaceSec: 540 };

function asSettings(row: { splitCount: number; settleOpen: boolean; etaDriveMin: number; etaStartAt: Date | null; etaPlanPaceSec: number }): Settings {
  return { ...row, etaStartAt: row.etaStartAt ? row.etaStartAt.toISOString() : null };
}

export async function getSettings(team: string = TEAM): Promise<Settings> {
  try {
    const row = await db.teamSettings.findUnique({ where: { team }, select: SETTINGS_SELECT });
    if (row) return asSettings(row);
  } catch (err) {
    console.error("lasd26/team: settings lookup failed (table pushed?)", err);
  }
  return DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>, team: string = TEAM): Promise<Settings> {
  const data = { ...patch, etaStartAt: patch.etaStartAt === undefined ? undefined : patch.etaStartAt === null ? null : new Date(patch.etaStartAt) };
  const row = await db.teamSettings.upsert({
    where: { team },
    create: { team, ...DEFAULT_SETTINGS, ...data },
    update: data,
    select: SETTINGS_SELECT,
  });
  return asSettings(row);
}
