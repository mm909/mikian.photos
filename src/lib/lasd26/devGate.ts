import "server-only";
import { notFound } from "next/navigation";
import { getTeamViewer, type TeamViewer } from "./team";

/**
 * THE DEV GATE on the team site's dev copy (src/app/lasd26/dev/**, see
 * paths.ts). The standing rule in CLAUDE.md (owner, 2026-10-01: "by
 * default, when there's a new page like that, put it in development unless
 * I say so"): a new page is admin-only in production, "(dev)" in its title,
 * noindex — the same gate the tracker (src/lib/tracker/gate.ts) and the
 * Hyrox dev copy wear.
 *
 * Every page under /lasd26/dev calls this first and uses the viewer it
 * returns, so the session is resolved once per request. In production a
 * viewer who is not the owner gets a 404 — never a sign-in prompt, the
 * same answer as a page that does not exist. On a laptop (NODE_ENV !==
 * "production") the pages are open, so the join / member / sign-in states
 * can be exercised with any account.
 *
 * OPEN FOR REVIEW (owner, 2026-10-16: "push the lasd changes live so I can
 * review", after the admin-only copy answered him a 404 while he was not
 * signed in). LASD_DEV_OPEN lifts the 404: anyone with a /lasd26/dev link
 * can open the pages. They stay unlinked, "(dev)" and noindex, and each
 * page keeps its own rule — the team console and the list are owner-only,
 * expenses and pay need membership, join needs a live invite token — so
 * nothing private opens with it. Set it back to false to return to the
 * admin-only gate; when the site goes live, delete the calls to this (back
 * to getTeamViewer) and follow the note in paths.ts.
 */
export const LASD_DEV_OPEN = true;

export async function gateLasdDev(): Promise<TeamViewer> {
  const viewer = await getTeamViewer();
  if (!LASD_DEV_OPEN && process.env.NODE_ENV === "production" && !viewer.owner) notFound();
  return viewer;
}
