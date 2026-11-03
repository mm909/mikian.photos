import { cookies } from "next/headers";
import { LOOK_COOKIE, VIEW_COOKIE, type Look, type View } from "./look";

/* The server side of look.ts: read the viewer's palette and projection
 * off the cookies the settings page wrote, with the defaults the owner
 * picked (survey ink, isometric). Separate file so client components can
 * import look.ts without pulling next/headers into their bundle. */

export function readLook(): { look: Look; view: View } {
  const jar = cookies();
  return {
    look: jar.get(LOOK_COOKIE)?.value === "olive" ? "olive" : "survey",
    view: jar.get(VIEW_COOKIE)?.value === "top" ? "top" : "iso",
  };
}
