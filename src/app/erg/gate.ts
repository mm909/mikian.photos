import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";

/* THE DOOR ON /erg (owner, 2026-09-17: the telemetry product, disjoint
 * from Rowtember). One rule, read by every page and every route here:
 *
 *   local dev   — open, signed in or not, so the console can be driven on
 *                 a laptop in the gym off npm run dev.
 *   production  — an admin account only; everyone else gets a 404 from a
 *                 page and a 403 from a route.
 *
 * WHY isRow100kAdmin. It is borrowed, and only because it is the account
 * check that already exists in this codebase — owner role or one of the
 * listed emails. Nothing about it is Rowtember except its file; when the
 * erg product opens to other people this is the one function that changes,
 * and no page or route has to. */

export type ErgViewer = {
  signedIn: boolean;
  isAdmin: boolean;
  /* The Photographer id — what a saved session hangs off. Null when signed
   * out. */
  userId: string | null;
  email: string;
  name: string;
};

export const ANON_ERG_VIEWER: ErgViewer = { signedIn: false, isAdmin: false, userId: null, email: "", name: "" };

/* Never throws: a session backend that is not there in a local setup reads
 * as signed out, which in dev still opens the page. */
export async function ergViewer(): Promise<ErgViewer> {
  try {
    const actor = await getEffectiveActor();
    if (!actor) return ANON_ERG_VIEWER;
    return {
      signedIn: true,
      isAdmin: isRow100kAdmin(actor.email, actor.roles),
      userId: actor.photographerId,
      email: actor.email,
      name: actor.name,
    };
  } catch (err) {
    console.error("erg: viewer lookup failed, rendering signed out", err);
    return ANON_ERG_VIEWER;
  }
}

/* May this viewer see an /erg page at all. */
export function ergPageOpen(v: ErgViewer): boolean {
  return process.env.NODE_ENV !== "production" || v.isAdmin;
}

/* The same door for a route, which additionally wants a signed-in account
 * to file a session under. Null means let them through. */
export function ergApiDenial(v: ErgViewer): { error: string; status: number } | null {
  if (!v.signedIn || !v.userId) return { error: "Sign in with Google first.", status: 401 };
  if (!ergPageOpen(v)) return { error: "Not allowed.", status: 403 };
  return null;
}
