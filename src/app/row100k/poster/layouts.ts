/* poster/layouts.ts — the one place the studio learns which module
 * registry draws each subject: the ROWTEMBER sheet from poster/community.ts
 * (its charts in poster/charts.ts) and the rower's sheet from
 * poster/rower.ts (poster/rowerCharts.ts). Both export a PosterLayout with
 * the SPEC.md §7 plans under the keys the formats name (tall / short /
 * squat / core / hand / story / post / square), so the engine never knows
 * which subject it is composing. */

export { communityLayout } from "./community";
export { rowerLayout } from "./rower";

/* RACE DAY registers TWICE — the solid ad and the transparent overlay are
 * the same modules under two sets of plans (the overlay's carry a `window`
 * row and drop what a photograph is worth more than). `raceLayoutFor`
 * picks; poster/raceGround.ts is what paints either ground. */
export { raceDayLayout, raceDayOverlayLayout, raceLayoutFor } from "./raceday";
