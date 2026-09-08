import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getEffectiveActor, type Actor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin, type Boards } from "@/lib/row100k";
import type { BlackoutState } from "@/lib/blackout";

/* Who is looking at a /row100k page, resolved once per request.
 *
 * Every page used to copy the same dozen lines — session, admin check, the
 * viewer's own RowParticipant — and each copy swallowed errors its own way.
 * One helper, one answer: the actor (null when signed out), whether they
 * are a challenge admin, and their own participant row when they have
 * joined. Failures are cosmetic on every surface that asks (the APIs
 * re-authenticate every write), so a db hiccup here means the anonymous
 * view, never a 500. */

export type ViewerParticipant = {
  id: string;
  rowerNumber: number;
  displayName: string;
  instagram: string;
  division: string;
};

/* The admin's test blackout (owner, 2026-09-06). "elite": the site as it
 * looks during a window to one OF the fifteen — everyone else's numbers
 * gone, their own kept, which is the self exemption. "public": the site as
 * it looks to everybody else — every one of the fifteen hidden, the
 * viewer's own row included. Set from /row100k/blackout, carried in a
 * cookie, and honoured ONLY for a challenge admin: it makes the page
 * stricter, never looser, but it is still a debugging lever and does not
 * belong to anyone else. */
export type BlackoutPreview = "elite" | "public";
export const BO_PREVIEW_COOKIE = "row100k_bo_preview";

export function parsePreview(v: unknown): BlackoutPreview | null {
  return v === "elite" || v === "public" ? v : null;
}

/* The same read for a page that resolves its own session rather than going
 * through resolveViewer (the front page). Never honoured for a non-admin. */
export function readBlackoutPreview(isAdmin: boolean): BlackoutPreview | null {
  if (!isAdmin) return null;
  try {
    return parsePreview(cookies().get(BO_PREVIEW_COOKIE)?.value);
  } catch {
    return null;
  }
}

export type Viewer = {
  actor: Actor | null;
  isAdmin: boolean;
  /* Null unless a challenge admin has switched the test blackout on. */
  preview: BlackoutPreview | null;
  /* The signed-in viewer's own participant id — null when signed out or
   * not yet joined. What boardView wants. */
  myParticipantId: string | null;
  /* The same row with the fields the settings page and the bar print. */
  me: ViewerParticipant | null;
};

export const ANON_VIEWER: Viewer = {
  actor: null,
  isAdmin: false,
  preview: null,
  myParticipantId: null,
  me: null,
};

export async function resolveViewer(): Promise<Viewer> {
  try {
    const actor = await getEffectiveActor();
    if (!actor) return ANON_VIEWER;
    const isAdmin = isRow100kAdmin(actor.email, actor.roles);
    const me = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
      select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
    });
    // Read only for an admin: a cookie nobody else can act on.
    let preview: BlackoutPreview | null = null;
    if (isAdmin) {
      try {
        preview = parsePreview(cookies().get(BO_PREVIEW_COOKIE)?.value);
      } catch {
        /* cookies() outside a request scope — no preview, same as none */
      }
    }
    return { actor, isAdmin, preview, myParticipantId: me?.id ?? null, me: me ?? null };
  } catch (err) {
    console.error("row100k: viewer lookup failed, rendering the anonymous view", err);
    return ANON_VIEWER;
  }
}

/* What boardView needs to know about the viewer.
 *
 * Under the admin's test blackout the admin stops being an admin for the
 * purpose of the mask — that is the whole point of the switch — and under
 * "public" they stop being themself as well, so their own row is hidden
 * along with the rest of the fifteen. `forceBlackout` makes the window
 * open for this request only. */
export function viewOpts(v: Viewer): {
  viewerParticipantId: string | null;
  admin: boolean;
  forceBlackout: boolean;
} {
  if (v.preview) {
    return {
      viewerParticipantId: v.preview === "elite" ? v.myParticipantId : null,
      admin: false,
      forceBlackout: true,
    };
  }
  return { viewerParticipantId: v.myParticipantId, admin: v.isAdmin, forceBlackout: false };
}

/* The window state as THIS viewer should see it: the real one, or an open
 * one while the admin is testing. Every surface that reads activeBlackout()
 * for itself runs the answer through here, so the test blackout reaches the
 * feed, the profile and the stats page and not only the board. */
export function previewBlackout(v: Viewer, real: BlackoutState): BlackoutState {
  if (!v.preview || real.active) return real;
  return { ...real, active: true, hideLow: undefined, rampDaysLeft: undefined };
}

/* What RowBar wants when the page has already resolved the session, so the
 * bar skips its own lookup. */
export function barProps(v: Viewer): { signedIn: boolean; rowerNumber: number | null; admin: boolean } {
  return { signedIn: v.actor !== null, rowerNumber: v.me?.rowerNumber ?? null, admin: v.isAdmin };
}

/* THE masked set: the participant ids boardView hid for this viewer. The
 * stats boards, the feed, the records pages and the profile all mask off
 * this one set rather than each deciding who is elite — so the fifteen the
 * board hides are exactly the fifteen hidden everywhere else, and the
 * self/admin exemptions come along for free (blackoutRules.ts owns the
 * rule; this only reads its result). Empty while no window is open. */
export function maskedIds(boards: Boards): Set<string> {
  const out = new Set<string>();
  for (const r of boards.total) if (r.masked) out.add(r.participantId);
  return out;
}
