/**
 * DowntownKruz (DTK) team identity — one place to edit the crossing's branding.
 * Isomorphic (no server-only imports); used by the live map, stats page, and
 * share-card generator.
 */

export const TEAM_NAME = "DowntownKruz";
export const TEAM_TAG = "DTK";
export const TEAM_HASHTAG = "#DowntownKruz";

/** Instagram links shown on the tracker (owner-confirmed handles). */
export const SOCIALS: { label: string; href: string }[] = [
  { label: "@downtownkruz", href: "https://instagram.com/downtownkruz" },
  { label: "@mikian_", href: "https://instagram.com/mikian_" },
  { label: "@thespeedproject", href: "https://instagram.com/thespeedproject" },
];

/** Warm TSP palette for runner colors — ambers/rusts/creams that sit right on
 *  the dark map (the user prefers these over the old mixed blue/teal set). */
export const RUNNER_PALETTE = [
  "#e8613c", // rust
  "#f0b060", // amber
  "#ffcf8f", // pale gold
  "#c8401a", // deep accent
  "#d98e73", // clay
  "#b8a98a", // warm sand
  "#e8934a", // tangerine
  "#a86f4f", // sienna
];
