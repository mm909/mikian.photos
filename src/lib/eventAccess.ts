import "server-only";
import { db } from "@/lib/db";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { normalizeAccessMode, normalizeStatus } from "@/lib/eventConfig";

/**
 * Decide whether the current viewer may see an event — the single source of
 * truth used by BOTH the event page and the event-scoped APIs (/api/photos,
 * face-search, preview), so a locked page can never leak photos through the
 * JSON layer. Modeled on src/lib/orderAccess.ts.
 *
 * Per-event access mode (this) is independent of the whole-site beta gate
 * (src/middleware.ts). The beta gate asks "is the site open at all yet?"; this
 * asks "given the site is open, who can see THIS event?".
 *
 * Outcomes:
 *   - not-found  → render 404 / return 404. Used for missing events, drafts/
 *                  archived (to non-admins), and secure-link events without a
 *                  valid token. A 404 (not 403) so an unlisted event never
 *                  confirms its own existence to someone without the key.
 *   - needs-auth → account-only event, viewer signed out → send to sign-in.
 */
export type EventAccess =
  | { ok: true; via: "public" | "secure-link" | "account" | "admin" }
  | { ok: false; reason: "not-found" | "needs-auth" };

export const SECRET_LINK_COOKIE_PREFIX = "mk_evk_";

/** Cookie name carrying a remembered secure-link token for one event. */
export function secretLinkCookieName(slug: string): string {
  return `${SECRET_LINK_COOKIE_PREFIX}${slug}`;
}

export async function resolveEventAccess(
  slug: string,
  opts: { token?: string | null } = {}
): Promise<EventAccess> {
  if (!slug) return { ok: false, reason: "not-found" };

  const ev = await db.event.findUnique({
    where: { id: slug },
    select: { id: true, status: true, accessMode: true, secretLinkToken: true },
  });
  if (!ev) return { ok: false, reason: "not-found" };

  const status = normalizeStatus(ev.status);
  const mode = normalizeAccessMode(ev.accessMode);

  // Fast paths that need no session lookup.
  if (status === "published" && mode === "public") {
    return { ok: true, via: "public" };
  }
  if (
    status === "published" &&
    mode === "secure-link" &&
    opts.token &&
    ev.secretLinkToken &&
    opts.token === ev.secretLinkToken
  ) {
    return { ok: true, via: "secure-link" };
  }

  // Everything else needs the actor: admins preview drafts/unlisted events;
  // account-only events require any signed-in account.
  const actor = await getEffectiveActor();
  if (actor && isAdmin(actor)) return { ok: true, via: "admin" };

  // Unpublished to a non-admin → never reveal it exists.
  if (status !== "published") return { ok: false, reason: "not-found" };

  if (mode === "secure-link") {
    // Wrong/absent token (and not admin) → 404, not 403.
    return { ok: false, reason: "not-found" };
  }
  if (mode === "account-only") {
    return actor ? { ok: true, via: "account" } : { ok: false, reason: "needs-auth" };
  }
  if (mode === "private") {
    // Most private: needs BOTH the secret link AND a signed-in account.
    const tokenOk = Boolean(
      opts.token && ev.secretLinkToken && opts.token === ev.secretLinkToken
    );
    if (!tokenOk) return { ok: false, reason: "not-found" }; // no/wrong link → never reveal
    return actor ? { ok: true, via: "account" } : { ok: false, reason: "needs-auth" };
  }
  return { ok: false, reason: "not-found" };
}
