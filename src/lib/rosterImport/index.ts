/**
 * Roster import orchestrator: detect → parse → (optionally) persist.
 *
 * Public surface:
 *   - detectSource / SOURCE_LABELS re-exported for the API + UI.
 *   - parseInput(input): classify the input and run the right adapter. Pure —
 *     no DB. Used by the dry-run PREVIEW path.
 *   - importRoster(eventId, input): parse then UPSERT rows into RosterEntry,
 *     deduped by the @@unique([eventId, bib]). Returns counts + warnings.
 *
 * FAIL-OPEN CONTRACT: the RosterEntry table/column may not be pushed to the DB
 * yet (owner runs `npm run prisma:push` later). Any DB call here is wrapped so a
 * missing table surfaces as `tableMissing: true` in the result rather than a
 * 500 — the API turns that into a clear 503 with the push hint. Mirrors how
 * src/lib/featured.ts and src/lib/relay.ts fail open on unmigrated tables.
 */
import { db } from "@/lib/db";
import { detectSource, asSingleUrl, isDelimitedSource } from "./detect";
import { parseCsv } from "./csv";
import { parseUrl } from "./url";
import type { ParseResult, RosterSource } from "./types";
import { SOURCE_LABELS } from "./types";

export { detectSource } from "./detect";
export { SOURCE_LABELS } from "./types";
export type { ParsedRosterEntry, ParseResult, RosterSource } from "./types";

export type ParsedInput = ParseResult & {
  source: RosterSource;
  sourceLabel: string;
  /** True when the input was a live URL (vs pasted delimited text). */
  isUrl: boolean;
};

/**
 * Classify + parse the input WITHOUT touching the DB. For URLs this may perform
 * a server-side fetch (RunSignup API / embedded-JSON attempt); for delimited
 * text it runs the CSV/TSV adapter. Never throws.
 */
export async function parseInput(input: string): Promise<ParsedInput> {
  const raw = (input ?? "").trim();
  const source = detectSource(raw);
  const sourceLabel = SOURCE_LABELS[source];
  const url = asSingleUrl(raw);

  if (url) {
    const result = await parseUrl(raw, source);
    return { ...result, source, sourceLabel, isUrl: true };
  }

  if (isDelimitedSource(source)) {
    const result = parseCsv(raw, source === "tsv" ? "\t" : ",");
    return { ...result, source, sourceLabel, isUrl: false };
  }

  // Unknown, non-URL text: try a comma parse as a last resort (some pastes lose
  // their header), else return the "paste CSV" guidance.
  if (raw.includes(",")) {
    const result = parseCsv(raw, ",");
    if (result.entries.length > 0) {
      return { ...result, source: "csv", sourceLabel: SOURCE_LABELS.csv, isUrl: false };
    }
  }
  return {
    entries: [],
    warnings: [
      "Couldn't recognize this input. Paste results as CSV or tab-separated text (with a header row like Bib, Name, Time), or upload a .csv exported from your timing provider.",
    ],
    source,
    sourceLabel,
    isUrl: false,
  };
}

export type ImportResult = {
  ok: boolean;
  /** Set when RosterEntry isn't in the DB yet — the API returns a 503 hint. */
  tableMissing: boolean;
  source: RosterSource;
  sourceLabel: string;
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  warnings: string[];
};

/** Is this thrown value a Prisma "table/column does not exist" error (i.e. the
 *  migration hasn't been pushed)? Prisma uses P2021 (table) / P2022 (column). */
function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === "P2021" || code === "P2022";
}

/**
 * Parse the input and upsert the resulting rows into RosterEntry for the event.
 * Dedupe is by @@unique([eventId, bib]): an existing bib is UPDATED, a new bib
 * is CREATED. Returns counts; on a missing table returns { tableMissing: true }
 * with no writes attempted beyond the first failing call.
 */
export async function importRoster(eventId: string, input: string): Promise<ImportResult> {
  const parsed = await parseInput(input);
  const base: Omit<ImportResult, "ok" | "tableMissing" | "imported" | "updated" | "skipped"> = {
    source: parsed.source,
    sourceLabel: parsed.sourceLabel,
    total: parsed.entries.length,
    warnings: [...parsed.warnings],
  };

  if (parsed.entries.length === 0) {
    return { ...base, ok: false, tableMissing: false, imported: 0, updated: 0, skipped: 0 };
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const e of parsed.entries) {
    const data = {
      name: e.name || "",
      distance: e.distance ?? null,
      finishTime: e.finishTime ?? null,
      ageGroup: e.ageGroup ?? null,
      gender: e.gender ?? null,
      city: e.city ?? null,
    };
    try {
      // upsert on the composite unique. Prisma names the compound-unique arg
      // `eventId_bib` from @@unique([eventId, bib]).
      const before = await db.rosterEntry.findUnique({
        where: { eventId_bib: { eventId, bib: e.bib } },
        select: { id: true },
      });
      await db.rosterEntry.upsert({
        where: { eventId_bib: { eventId, bib: e.bib } },
        create: { eventId, bib: e.bib, ...data },
        update: data,
      });
      if (before) updated++;
      else imported++;
    } catch (err) {
      if (isMissingTableError(err)) {
        return {
          ...base,
          ok: false,
          tableMissing: true,
          imported,
          updated,
          skipped,
        };
      }
      // A single-row failure (bad data etc.) — skip it and keep going.
      skipped++;
    }
  }

  return { ...base, ok: true, tableMissing: false, imported, updated, skipped };
}

/** Delete all roster rows for an event. Fail-open: returns { tableMissing } if
 *  the table doesn't exist, and { deleted } otherwise. */
export async function clearRoster(
  eventId: string
): Promise<{ ok: boolean; tableMissing: boolean; deleted: number }> {
  try {
    const res = await db.rosterEntry.deleteMany({ where: { eventId } });
    return { ok: true, tableMissing: false, deleted: res.count };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { ok: false, tableMissing: true, deleted: 0 };
    }
    return { ok: false, tableMissing: false, deleted: 0 };
  }
}
