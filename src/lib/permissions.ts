import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";
import {
  PHOTOGRAPHER_UNLOCK_COOKIE,
  ADMIN_PHOTOGRAPHER_EMAIL,
  ADMIN_PHOTOGRAPHER_NAME,
} from "./photographerLock";

/**
 * Single source of truth for who can do what.
 *
 * Roles are stored as a `roles: string[]` column on the Photographer row
 * (which is really the User table — see schema.prisma's comment).
 *
 * Valid roles (v2.1 — race_director removed, runner renamed to user):
 *   - "user"           default; minimal account, just for receipts + past orders
 *   - "photographer"   platform photographer; can be granted per-event upload
 *   - "owner"          platform super-admin: creates events, admins everything
 *
 * Owner implies every other role. Per-EVENT authority (manage a specific
 * event's settings / photographers / orders) is the platform owner OR the
 * event's own owner — see `canManageEvent`. `isAdmin` is the platform admin
 * tier (= owner), used for see-all / manage-any-content decisions.
 */

export const ALL_ROLES = ["user", "photographer", "owner"] as const;
export type Role = (typeof ALL_ROLES)[number];

const OWNER_DEFAULT = "mikian.photos@gmail.com";

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || OWNER_DEFAULT).toLowerCase().trim();
}

/** Normalize a free-form roles array from the DB to known roles only. */
export function normalizeRoles(input: unknown): Role[] {
  // Legacy values ("runner", "race_director") aren't in ALL_ROLES anymore, so
  // they're dropped here; an all-legacy array falls back to ["user"]. This makes
  // the new code safe to run against pre-migration rows.
  if (!Array.isArray(input)) return ["user"];
  const out = new Set<Role>();
  for (const v of input) {
    if (typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v)) {
      out.add(v as Role);
    }
  }
  if (out.size === 0) out.add("user");
  return Array.from(out);
}

/** Roles an owner implicitly carries. */
export const OWNER_IMPLIED_ROLES: Role[] = ["user", "photographer", "owner"];

/**
 * Does the actor have this role? Owner is treated as having every role, and
 * race_director implies photographer + runner (so it clears every
 * photographer-gated surface). Neither implication grants owner.
 */
export function hasRole(actor: { roles?: readonly string[] | null }, role: Role): boolean {
  const rs = actor.roles ?? [];
  if (rs.includes("owner")) return true;
  return rs.includes(role);
}

export function isOwner(actor: { roles?: readonly string[] | null }): boolean {
  return Boolean(actor.roles?.includes("owner"));
}

/**
 * The platform "admin" tier (v2.1: = owner, since race_director was removed).
 * Full admin over content/orders platform-wide. For authority over ONE event
 * (event owner can manage their own event), use `canManageEvent` instead.
 */
export function isAdmin(actor: { roles?: readonly string[] | null }): boolean {
  return Boolean(actor.roles?.includes("owner"));
}

/**
 * Per-event authority: the platform owner, OR the event's own owner, may manage
 * that event — its settings, photographer access, pricing, orders. Everyone
 * else is a viewer/buyer. Use this for event-scoped admin instead of `isAdmin`.
 */
export function canManageEvent(
  actor: { photographerId?: string; roles?: readonly string[] | null } | null,
  event: { ownerId?: string | null }
): boolean {
  if (!actor) return false;
  if (actor.roles?.includes("owner")) return true;
  return Boolean(
    event.ownerId && actor.photographerId && event.ownerId === actor.photographerId
  );
}

/**
 * Is the current request's effective actor an owner? Async wrapper for places
 * that just need a yes/no (e.g. opening the buy flow for the owner regardless
 * of the global payment lock).
 */
export async function isOwnerActor(): Promise<boolean> {
  const actor = await getEffectiveActor();
  return Boolean(actor && actor.roles.includes("owner"));
}

/**
 * Resolve the caller's identity + roles.
 *
 * Order of precedence:
 *   1. NextAuth Google session — `session.photographerId` + `session.roles`.
 *   2. Photographer unlock cookie — bootstrap an owner-role admin row keyed
 *      on ADMIN_PHOTOGRAPHER_EMAIL (the synthetic email from photographerLock).
 *      Lets you do admin work without OAuth set up.
 *
 * Returns null when neither path applies.
 */
export type Actor = {
  photographerId: string;
  roles: Role[];
  email: string;
  name: string;
};

export async function getEffectiveActor(): Promise<Actor | null> {
  // Path 1: NextAuth session
  try {
    const session = await getServerSession(authOptions);
    if (session?.photographerId) {
      const row = await db.photographer.findUnique({
        where: { id: session.photographerId },
        select: { id: true, email: true, name: true, roles: true },
      });
      if (row) {
        return {
          photographerId: row.id,
          roles: normalizeRoles(row.roles),
          email: row.email,
          name: row.name,
        };
      }
    }
  } catch {
    /* NextAuth misconfigured — fall through to unlock cookie */
  }

  // Path 2: unlock cookie → owner
  try {
    if (cookies().get(PHOTOGRAPHER_UNLOCK_COOKIE)?.value === "1") {
      const admin = await db.photographer.upsert({
        where: { email: ADMIN_PHOTOGRAPHER_EMAIL },
        update: { isAdmin: true, roles: OWNER_IMPLIED_ROLES },
        create: {
          email: ADMIN_PHOTOGRAPHER_EMAIL,
          name: ADMIN_PHOTOGRAPHER_NAME,
          isAdmin: true,
          roles: OWNER_IMPLIED_ROLES,
        },
        select: { id: true, email: true, name: true, roles: true },
      });
      return {
        photographerId: admin.id,
        roles: normalizeRoles(admin.roles),
        email: admin.email,
        name: admin.name,
      };
    }
  } catch {
    /* cookies() can throw if called outside a request context */
  }

  return null;
}

/**
 * Resolve actor + assert a role. Returns the Actor if allowed, or null if
 * caller should respond with an unauthorized/forbidden status.
 */
export async function requireRole(role: Role): Promise<Actor | null> {
  const actor = await getEffectiveActor();
  if (!actor) return null;
  if (!hasRole(actor, role)) return null;
  return actor;
}

/**
 * TEMPORARY upload lockdown — only the platform owner's MAIN account may upload.
 * Returns the actor iff it's signed in as `ownerEmail()` (a real owner Google
 * account). This deliberately EXCLUDES the legacy photographer-unlock cookie:
 * that cookie resolves to a synthetic admin (ADMIN_PHOTOGRAPHER_EMAIL) whose
 * email isn't the owner email, so it can no longer reach the upload flow without
 * a real sign-in. Re-open per-event photographer uploads later (see
 * canUploadToEvent + the request/approve flow, currently bypassed for uploads).
 */
export async function requireOwnerUpload(): Promise<Actor | null> {
  const actor = await getEffectiveActor();
  if (!actor) return null;
  return actor.email.toLowerCase().trim() === ownerEmail() ? actor : null;
}

/**
 * Resolve the actor and assert they may manage this event — platform owner OR
 * the event's own owner (see canManageEvent). Returns the Actor, or null to
 * respond 403/404. The event-scoped analogue of requireRole.
 */
export async function requireEventManager(eventId: string): Promise<Actor | null> {
  const actor = await getEffectiveActor();
  if (!actor) return null;
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!ev) return null;
  return canManageEvent(actor, ev) ? actor : null;
}
