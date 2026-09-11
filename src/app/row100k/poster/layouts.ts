/* poster/layouts.ts — the one place the studio learns which module
 * registry draws each subject: the ROWTEMBER sheet from poster/community.ts
 * (its charts in poster/charts.ts) and the rower's sheet from
 * poster/rower.ts (poster/rowerCharts.ts). Both export a PosterLayout with
 * the SPEC.md §7 plans under the keys the formats name (tall / short /
 * squat / core / hand / story / post / square), so the engine never knows
 * which subject it is composing. */

export { communityLayout } from "./community";
export { rowerLayout } from "./rower";

/* RACE DAY registers THREE TIMES — the solid ad, the transparent overlay
 * and the same overlay with the owner's photograph drawn into its window.
 * The last two share one set of plans (they carry a `window` row and drop
 * what a photograph is worth more than) and differ only in whether that row
 * cuts or fills. `raceLayoutFor` picks; poster/raceGround.ts is what paints
 * any of the three. */
export { raceDayLayout, raceDayOverlayLayout, raceDayPhotoLayout, raceLayoutFor } from "./raceday";
