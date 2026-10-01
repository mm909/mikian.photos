/* THE ROWTEMBER ADDRESSES WITHOUT /row100k (owner, 2026-10-01): the first
 * path segments that belong to Rowtember — the folders under
 * src/app/row100k that hold a page. The middleware serves /<segment>/… from
 * /row100k/<segment>/… and sends them from the old host to rowtember.com;
 * the root layout (RunnerChrome) leaves the photo site's nav off them. Add
 * a new page folder here when one is made. None of them is also a
 * top-level route of this app. Plain module: the edge middleware and a
 * client component both import it. */
export const ROW_SEGMENTS: ReadonlySet<string> = new Set([
  "analysis",
  "blackout",
  "board",
  "dev",
  "emails",
  "feed",
  "gallery",
  "join",
  "moderation",
  "partners",
  "plan",
  "pm5",
  "post",
  "posters",
  "preview",
  "r",
  "race-admin",
  "raceday",
  "raffles",
  "records",
  "settings",
  "shareables",
  "shirt",
  "shirts",
  "shop-admin",
  "sign-in",
  "signups",
  "stats",
]);

/* A path that is a Rowtember page: /row100k and under it, or one of the
 * segments above. */
export function isRowtemberPath(pathname: string): boolean {
  if (pathname === "/row100k" || pathname.startsWith("/row100k/")) return true;
  return ROW_SEGMENTS.has(pathname.split("/")[1] ?? "");
}
