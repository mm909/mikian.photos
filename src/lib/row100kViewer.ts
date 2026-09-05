import { db } from "@/lib/db";
import { getEffectiveActor, type Actor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin, type Boards } from "@/lib/row100k";

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

export type Viewer = {
  actor: Actor | null;
  isAdmin: boolean;
  /* The signed-in viewer's own participant id — null when signed out or
   * not yet joined. What boardView wants. */
  myParticipantId: string | null;
  /* The same row with the fields the settings page and the bar print. */
  me: ViewerParticipant | null;
};

export const ANON_VIEWER: Viewer = { actor: null, isAdmin: false, myParticipantId: null, me: null };

export async function resolveViewer(): Promise<Viewer> {
  try {
    const actor = await getEffectiveActor();
    if (!actor) return ANON_VIEWER;
    const isAdmin = isRow100kAdmin(actor.email, actor.roles);
    const me = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
      select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
    });
    return { actor, isAdmin, myParticipantId: me?.id ?? null, me: me ?? null };
  } catch (err) {
    console.error("row100k: viewer lookup failed, rendering the anonymous view", err);
    return ANON_VIEWER;
  }
}

/* The two things boardView needs to know about the viewer. */
export function viewOpts(v: Viewer): { viewerParticipantId: string | null; admin: boolean } {
  return { viewerParticipantId: v.myParticipantId, admin: v.isAdmin };
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
