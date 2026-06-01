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
 * Valid roles:
 *   - "runner"         default; minimal account, just for receipts + past orders
 *   - "photographer"   can upload, edit, hide, delete their own photos
 *   - "race_director"  senior admin: everything EXCEPT the owner-only settings
 *                      panel (/admin/users: roles, pricing, duplicate policy)
 *                      and issuing refunds. Implies photographer + runner.
 *   - "owner"          all of the above + the settings panel + refunds
 *
 * Owner implies every other role; race_director implies photographer + runner.
 * The `hasRole` helper enforces that, and `isAdmin` captures the owner-or-RD
 * "admin" tier used for see-all / manage-any-content decisions.
 */

export const ALL_ROLES = ["runner", "photographer", "race_director", "owner"] as const;
export type Role = (typeof ALL_ROLES)[number];

const OWNER_DEFAULT = "mikian.photos@gmail.com";

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL || OWNER_DEFAULT).toLowerCase().trim();
}

/** Normalize a free-form roles array from the DB to known roles only. */
export function normalizeRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return ["runner"];
  const out = new Set<Role>();
  for (const v of input) {
    if (typeof v === "string" && (ALL_ROLES as readonly string[]).includes(v)) {
      out.add(v as Role);
    }
  }
  if (out.size === 0) out.add("runner");
  return Array.from(out);
}

/** Roles an owner implicitly carries. */
export const OWNER_IMPLIED_ROLES: Role[] = ["runner", "photographer", "race_director", "owner"];

/**
 * Does the actor have this role? Owner is treated as having every role, and
 * race_director implies photographer + runner (so it clears every
 * photographer-gated surface). Neither implication grants owner.
 */
export function hasRole(actor: { roles?: readonly string[] | null }, role: Role): boolean {
  const rs = actor.roles ?? [];
  if (rs.includes("owner")) return true;
  if (rs.includes("race_director") && (role === "photographer" || role === "runner")) {
    return true;
  }
  return rs.includes(role);
}

export function isOwner(actor: { roles?: readonly string[] | null }): boolean {
  return Boolean(actor.roles?.includes("owner"));
}

/**
 * The "admin" tier: owner OR race_director. This is full admin over content and
 * orders — the photo library see-all, coverage curation, editing any
 * photographer's photos, viewing any order. It is everything an owner can do
 * EXCEPT the owner-only settings panel (/admin/users) and issuing refunds, which
 * keep using `isOwner`. Prefer this over `isOwner` for content/support powers.
 */
export function isAdmin(actor: { roles?: readonly string[] | null }): boolean {
  const rs = actor.roles ?? [];
  return rs.includes("owner") || rs.includes("race_director");
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
