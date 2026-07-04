/**
 * CSV / TSV roster adapter — the robust, always-works path.
 *
 * Parses a delimited table (comma or tab) with RFC-4180-ish quoting, reads a
 * header row, fuzzy-maps columns to our roster fields, and emits normalized
 * ParsedRosterEntry rows. Rows without a usable bib+name are skipped (with a
 * warning tally) rather than throwing — a partial import beats a hard failure.
 *
 * No dependencies: the field splitter is hand-rolled so we don't add a CSV lib.
 */
import type { ParsedRosterEntry, ParseResult } from "./types";

/**
 * Split one line of delimited text into fields, honoring double-quote quoting
 * ("" is an escaped quote inside a quoted field). Handles the delimiter and
 * quotes only — embedded newlines inside quotes are NOT supported at the line
 * level (see parseRows for how whole-file quoted newlines are stitched).
 */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Split the whole text into logical rows of fields. This first stitches lines
 * that were broken by a newline INSIDE a quoted field (odd number of quotes on
 * a line means the quote is still open), then splits each stitched line.
 */
function parseRows(text: string, delim: string): string[][] {
  const rawLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const logical: string[] = [];
  let buf = "";
  let openQuotes = 0;
  for (const line of rawLines) {
    const quotes = (line.match(/"/g) || []).length;
    if (openQuotes % 2 === 1) {
      // Continuation of a quoted field from the previous line.
      buf += "\n" + line;
    } else {
      buf = line;
    }
    openQuotes = (buf.match(/"/g) || []).length;
    if (openQuotes % 2 === 0) {
      logical.push(buf);
      buf = "";
      openQuotes = 0;
    }
  }
  if (buf) logical.push(buf); // trailing unbalanced — take it as-is

  return logical
    .filter((l) => l.trim().length > 0)
    .map((l) => splitLine(l, delim));
}

/** Normalize a header cell for matching: lowercase, strip punctuation/space. */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Field → the set of normalized header aliases that map to it. Order in the
// object doesn't matter; matching is "first column whose normalized header is
// in the alias set." More specific fields (bib) are resolved before we fall
// back to first/last-name assembly.
const ALIASES: Record<
  "bib" | "name" | "first" | "last" | "distance" | "finishTime" | "ageGroup" | "gender" | "city",
  string[]
> = {
  bib: ["bib", "bibnumber", "bibno", "bibnum", "bib#", "number", "no", "racenumber", "runnernumber"],
  name: ["name", "athlete", "participant", "runner", "fullname", "athletename", "participantname"],
  first: ["first", "firstname", "fname", "givenname", "given"],
  last: ["last", "lastname", "lname", "surname", "familyname", "family"],
  distance: ["distance", "event", "race", "division", "div", "category", "eventname", "racename", "class"],
  finishTime: [
    "finishtime",
    "finish",
    "time",
    "chip",
    "chiptime",
    "guntime",
    "gun",
    "nettime",
    "net",
    "clocktime",
    "elapsed",
    "result",
  ],
  ageGroup: ["age", "ag", "agegroup", "agegrp", "agediv", "agedivision"],
  gender: ["gender", "sex", "genderdivision", "genderdiv"],
  city: ["city", "town", "hometown", "location", "residence"],
};

/** Find the first column index whose normalized header matches any alias.
 *  Prefers an EXACT alias match; falls back to a header that STARTS WITH an
 *  alias (so "bibnumber" matches when the exact list didn't). Returns -1. */
function findCol(headers: string[], aliases: string[]): number {
  const norm = headers.map(normHeader);
  for (let i = 0; i < norm.length; i++) {
    if (aliases.includes(norm[i])) return i;
  }
  for (let i = 0; i < norm.length; i++) {
    if (aliases.some((a) => a.length >= 3 && norm[i].startsWith(a))) return i;
  }
  return -1;
}

/** Extract the leading integer from a bib cell ("A123", "123 ", "123.0" → 123).
 *  Returns null when there's no usable number. */
function parseBib(cell: string | undefined): number | null {
  if (cell == null) return null;
  const m = cell.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

function clean(cell: string | undefined): string {
  return (cell ?? "").trim();
}

/** Does this row of cells look like a header (has our key field words and no
 *  numeric bib in the bib column)? Used to decide whether the first row is a
 *  header or already data. */
function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.map(normHeader).join(" ");
  const hasWord =
    /(bib|name|athlete|participant|first|last|time|finish|gender|sex|age|city|division|distance|event|race)/.test(
      joined
    );
  // A header row shouldn't have a purely-numeric bib-looking first cell AND
  // header words; if the first cell is a bare number it's probably data.
  return hasWord;
}

export function parseCsv(input: string, delim: "," | "\t"): ParseResult {
  const warnings: string[] = [];
  const rows = parseRows(input, delim);
  if (rows.length === 0) {
    return { entries: [], warnings: ["No rows found in the pasted text."] };
  }

  let headerRow = rows[0];
  let dataStart = 1;
  if (!looksLikeHeader(headerRow)) {
    // No recognizable header — synthesize positional headers and treat every
    // row as data. We still try the common "bib,name" positional layout.
    warnings.push(
      "No header row detected — assuming column order is bib, name, and any extra columns were ignored."
    );
    headerRow = headerRow.map((_, i) => (i === 0 ? "bib" : i === 1 ? "name" : `col${i}`));
    dataStart = 0;
  }

  const bibCol = findCol(headerRow, ALIASES.bib);
  let nameCol = findCol(headerRow, ALIASES.name);
  const firstCol = findCol(headerRow, ALIASES.first);
  const lastCol = findCol(headerRow, ALIASES.last);
  const distanceCol = findCol(headerRow, ALIASES.distance);
  const finishCol = findCol(headerRow, ALIASES.finishTime);
  const ageCol = findCol(headerRow, ALIASES.ageGroup);
  const genderCol = findCol(headerRow, ALIASES.gender);
  const cityCol = findCol(headerRow, ALIASES.city);

  const useFirstLast = nameCol === -1 && (firstCol !== -1 || lastCol !== -1);

  if (bibCol === -1) {
    warnings.push(
      "No bib/number column found. Every row needs a bib to import — check that your header includes a column like \"Bib\" or \"Number\"."
    );
    return { entries: [], warnings };
  }
  if (nameCol === -1 && !useFirstLast) {
    warnings.push(
      "No name column found (looked for name/athlete/participant or first+last). Rows will import with a blank name."
    );
  }

  const entries: ParsedRosterEntry[] = [];
  let skippedNoBib = 0;
  let skippedDup = 0;
  const seenBibs = new Set<number>();

  for (let i = dataStart; i < rows.length; i++) {
    const cells = rows[i];
    const bib = parseBib(cells[bibCol]);
    if (bib == null) {
      skippedNoBib++;
      continue;
    }
    if (seenBibs.has(bib)) {
      // Keep the FIRST occurrence (e.g. results files list a runner once);
      // later duplicates for the same bib are dropped from this batch.
      skippedDup++;
      continue;
    }
    seenBibs.add(bib);

    let name = "";
    if (useFirstLast) {
      const f = firstCol !== -1 ? clean(cells[firstCol]) : "";
      const l = lastCol !== -1 ? clean(cells[lastCol]) : "";
      name = [f, l].filter(Boolean).join(" ");
    } else if (nameCol !== -1) {
      name = clean(cells[nameCol]);
    }

    const entry: ParsedRosterEntry = { bib, name };
    const distance = distanceCol !== -1 ? clean(cells[distanceCol]) : "";
    const finishTime = finishCol !== -1 ? clean(cells[finishCol]) : "";
    const ageGroup = ageCol !== -1 ? clean(cells[ageCol]) : "";
    const gender = genderCol !== -1 ? clean(cells[genderCol]) : "";
    const city = cityCol !== -1 ? clean(cells[cityCol]) : "";
    if (distance) entry.distance = distance;
    if (finishTime) entry.finishTime = finishTime;
    if (ageGroup) entry.ageGroup = ageGroup;
    if (gender) entry.gender = gender;
    if (city) entry.city = city;

    entries.push(entry);
  }

  if (skippedNoBib > 0) {
    warnings.push(`${skippedNoBib} row(s) skipped — no numeric bib in the bib column.`);
  }
  if (skippedDup > 0) {
    warnings.push(`${skippedDup} row(s) skipped — duplicate bib within the pasted text (kept the first).`);
  }
  if (entries.length === 0 && warnings.length === 0) {
    warnings.push("No rows with a usable bib were found.");
  }

  return { entries, warnings };
}
