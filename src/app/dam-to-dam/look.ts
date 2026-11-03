/* THE LOOK, as the viewer chose it (owner, 2026-11-03, on the palette
 * previews: "the survey ink and topo olive. Keep both options and put
 * them in a settings page. Also let me select isometric or top down.").
 * Two palettes and two projections, carried in cookies so the server
 * renders the right chart with no flash:
 *
 *   dd_look — "survey" (ink-blue line work on paper cream, orange pops;
 *             the Canyonlands direction; DEFAULT) or "olive" (topo poster:
 *             dark olive, cream line work, orange pops).
 *   dd_view — "iso" (the tilted panorama, DEFAULT) or "top" (straight
 *             overhead, the tall chart).
 *
 * The settings page (./settings) writes the cookies; the server pages
 * read them through readLook.ts — kept out of this file so the client
 * picker can import the names without dragging next/headers into the
 * client bundle. Neon midnight was retired with this choice. */

export type Look = "survey" | "olive";
export type View = "iso" | "top";

export const LOOKS: Look[] = ["survey", "olive"];
export const VIEWS: View[] = ["iso", "top"];

export const LOOK_COOKIE = "dd_look";
export const VIEW_COOKIE = "dd_view";

/** The page theme color for the browser chrome, per palette. */
export const THEME_COLOR: Record<Look, string> = {
  survey: "#f3ecdc",
  olive: "#3e4637",
};
