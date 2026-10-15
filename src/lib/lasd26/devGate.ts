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
 * That means, until the gate lifts, nobody but the owner can reach the
 * join page in production: the invite link works for him alone, and the
 * crew cannot join yet. When the owner says the site goes live, delete the
 * calls to this (back to getTeamViewer) and follow the note in paths.ts.
 */
export async function gateLasdDev(): Promise<TeamViewer> {
  const viewer = await getTeamViewer();
  if (process.env.NODE_ENV === "production" && !viewer.owner) notFound();
  return viewer;
}
