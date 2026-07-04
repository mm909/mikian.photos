/**
 * Source detection for roster import.
 *
 * Given raw input — a URL the owner pasted, or pasted table/CSV text, or the
 * contents of an uploaded .csv — classify it into a RosterSource so the caller
 * can route to the right adapter (and, for live URLs we can't scrape, show the
 * honest per-source "export the CSV and paste it here" guidance).
 *
 * Detection order:
 *   1. If the input is a single URL, classify by host.
 *   2. Otherwise classify by CONTENT SHAPE: tabs → tsv, commas + a header-ish
 *      first line → csv. Everything else → unknown.
 *
 * This never throws — worst case it returns "unknown".
 */
import type { RosterSource } from "./types";

/** Host → source. Matched as a suffix so subdomains (results.raceroster.com,
 *  my.raceresult.com, …) resolve too. */
const HOST_SOURCES: { match: (host: string) => boolean; source: RosterSource }[] = [
  { match: (h) => h.endsWith("runsignup.com") || h.endsWith("runsignup.org"), source: "runsignup" },
  { match: (h) => h.endsWith("raceroster.com"), source: "raceroster" },
  { match: (h) => h.endsWith("athlinks.com"), source: "athlinks" },
  { match: (h) => h.endsWith("chronotrack.com"), source: "chronotrack" },
  { match: (h) => h.endsWith("raceresult.com"), source: "raceresult" },
];

/** Trim + collapse: is this whole input a single http(s) URL (no embedded
 *  whitespace/newlines)? Returns the parsed URL or null. */
export function asSingleUrl(input: string): URL | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    return new URL(t);
  } catch {
    return null;
  }
}

/** True when the first non-empty line looks like a delimited header/row for the
 *  given delimiter (i.e. has at least one delimiter). */
function firstLineHasDelim(input: string, delim: string): boolean {
  const line = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ? line.includes(delim) : false;
}

/** Count delimiter occurrences across the first few non-empty lines — used to
 *  break the comma-vs-tab tie by whichever is more consistent/common. */
function delimScore(input: string, delim: string): number {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 5);
  let n = 0;
  for (const l of lines) {
    // Count occurrences of delim in the line.
    for (const ch of l) if (ch === delim) n++;
  }
  return n;
}

export function detectSource(input: string): RosterSource {
  const raw = (input ?? "").trim();
  if (!raw) return "unknown";

  // 1. Whole-input URL → classify by host.
  const url = asSingleUrl(raw);
  if (url) {
    const host = url.hostname.toLowerCase();
    for (const { match, source } of HOST_SOURCES) {
      if (match(host)) return source;
    }
    // Some other results URL we don't specifically know.
    return "results-page";
  }

  // 2. Content shape. Tabs win over commas when both present and tabs are more
  //    frequent (tab-separated exports often also contain commas inside city
  //    fields), otherwise comma.
  const hasTab = firstLineHasDelim(raw, "\t");
  const hasComma = firstLineHasDelim(raw, ",");
  if (hasTab && hasComma) {
    return delimScore(raw, "\t") >= delimScore(raw, ",") ? "tsv" : "csv";
  }
  if (hasTab) return "tsv";
  if (hasComma) return "csv";

  return "unknown";
}

/** Convenience: is this a delimited-text source (the always-works parse path)? */
export function isDelimitedSource(source: RosterSource): boolean {
  return source === "csv" || source === "tsv";
}
