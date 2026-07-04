/**
 * Roster-import shared types.
 *
 * A ParsedRosterEntry is the normalized, source-agnostic shape every adapter
 * emits. Only `bib` + `name` are required to persist a row; the rest are
 * optional metadata we surface in the roster review UI and (later) the runner
 * lookup. Keep this in sync with the Prisma RosterEntry model — the DB writer in
 * ./index.ts maps directly onto these fields.
 */

/** The source classes detectSource() can return. */
export type RosterSource =
  | "csv"
  | "tsv"
  | "runsignup"
  | "raceroster"
  | "athlinks"
  | "chronotrack"
  | "raceresult"
  | "results-page"
  | "unknown";

export type ParsedRosterEntry = {
  bib: number;
  name: string;
  distance?: string;
  finishTime?: string;
  ageGroup?: string;
  gender?: string;
  city?: string;
};

export type ParseResult = {
  entries: ParsedRosterEntry[];
  warnings: string[];
};

/** Per-adapter parse options. Currently only the detected source is threaded
 *  through so an adapter can note it in a warning; kept as an object so we can
 *  extend without touching every call site. */
export type ParseOpts = {
  source?: RosterSource;
};

/** Human-friendly label for a source id (for the review UI). */
export const SOURCE_LABELS: Record<RosterSource, string> = {
  csv: "CSV",
  tsv: "Tab-separated text",
  runsignup: "RunSignup",
  raceroster: "Race Roster",
  athlinks: "Athlinks",
  chronotrack: "ChronoTrack",
  raceresult: "RaceResult",
  "results-page": "Results page",
  unknown: "Unknown",
};
