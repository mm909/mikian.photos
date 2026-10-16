import "server-only";
import { notFound } from "next/navigation";
import { ensureOwnerMember, getTeamViewer, type TeamViewer } from "./team";

/**
 * THE DEV GATE for pages of the team site that are not live yet (owner,
 * 2026-10-16: the route map and the info sheet — "put it behind the dev
 * gate"). The standing rule in CLAUDE.md: admin-only in production, "(dev)"
 * in the title, noindex, linked only from the owner's DEVELOPMENT group of
 * the account menu. On a laptop the pages are open. A page that goes live
 * drops this call for getTeamViewer()/ensureOwnerMember().
 */
export async function gateLasdDev(): Promise<TeamViewer> {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (process.env.NODE_ENV === "production" && !viewer.owner) notFound();
  return viewer;
}

/** "Route (dev)" while the page sits behind the gate. */
export function devTitle(title: string): string {
  return `${title} (dev)`;
}
