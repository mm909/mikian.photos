import "server-only";
import { notFound } from "next/navigation";
import { ensureOwnerMember, getTeamViewer, type TeamViewer } from "./team";

/**
 * THE DEV GATE for pages of the team site that are not live yet. The
 * standing rule in CLAUDE.md: admin-only in production, "(dev)" in the
 * title, noindex, linked only from the owner's DEVELOPMENT group of the
 * account menu. On a laptop the pages are open. A page that goes live
 * drops this call for getTeamViewer()/ensureOwnerMember().
 *
 * Nothing wears it right now: the route map wore it for a day (owner,
 * 2026-10-16: "put it behind the dev gate") and went live that evening;
 * the info sheet wore it the same day ("again put it behind a dev gate for
 * now") and went live that night ("Make the info page live"). It stays
 * here for the next new page.
 */
export async function gateLasdDev(): Promise<TeamViewer> {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (process.env.NODE_ENV === "production" && !viewer.owner) notFound();
  return viewer;
}

/** "Some page (dev)" while a page sits behind the gate. */
export function devTitle(title: string): string {
  return `${title} (dev)`;
}
