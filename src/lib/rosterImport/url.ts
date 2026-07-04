/**
 * Live-URL roster adapter — honest, best-effort.
 *
 * MOST race-results pages (Race Roster, Athlinks, ChronoTrack live results) are
 * JS-rendered or API-backed and can't be scraped from a single server fetch.
 * For those we DETECT the source and return a clear, source-specific message
 * telling the owner to export/download the CSV and paste it here — we do NOT
 * pretend to parse a page we can't.
 *
 * For a couple of sources there's a real chance of a server-side parse:
 *   - RunSignup exposes a public results API; a results URL carries the race/
 *     event ids we can turn into a JSON request.
 *   - RaceResult (my<...>.raceresult.com) and other pages sometimes embed the
 *     results as a JSON blob in a <script> tag we can pull out and parse.
 * We attempt those and fall back to guidance if the shape isn't what we expect.
 *
 * Everything here runs on the Node runtime with the standard global fetch. It
 * never throws — failures collapse into a warning + guidance.
 */
import type { ParsedRosterEntry, ParseResult, RosterSource } from "./types";

const FETCH_TIMEOUT_MS = 12_000;
const UA =
  "Mozilla/5.0 (compatible; MikianPhotosRosterImport/1.0; +https://mikianmusser.com)";

/** Per-source "we can't scrape this live — export the CSV" guidance. */
export const URL_GUIDANCE: Record<RosterSource, string> = {
  raceroster:
    "Race Roster results load dynamically in the browser, so the link can't be read directly. Open the results, use Export / Download (CSV), then paste the CSV text here or upload the .csv file.",
  athlinks:
    "Athlinks results are rendered in the browser and can't be read from the link. Open the event results, export or copy the results table, and paste the CSV/table text here.",
  chronotrack:
    "ChronoTrack live results are loaded dynamically. Use the results page's export/download to get a CSV, then paste it here or upload the .csv file.",
  raceresult:
    "RaceResult pages load results in the browser. Use the results list's download/export (CSV) and paste it here, or copy the visible table and paste it as text.",
  runsignup:
    "Couldn't read the RunSignup results from the link automatically. On the results page use Download / Export to CSV, then paste the CSV here or upload the .csv file.",
  "results-page":
    "This results page loads its data dynamically, so the link can't be read directly. Look for an Export / Download CSV button on the results, then paste the CSV text here or upload the .csv file.",
  csv: "",
  tsv: "",
  unknown:
    "That doesn't look like a results link or a CSV/table. Paste the results as CSV or tab-separated text, or upload a .csv file exported from your timing provider.",
};

/** A source-specific guidance ParseResult (no entries). */
export function guidanceResult(source: RosterSource): ParseResult {
  return {
    entries: [],
    warnings: [URL_GUIDANCE[source] || URL_GUIDANCE["results-page"]],
  };
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/json,*/*" },
      // Node runtime; no Next caching of a live import fetch.
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ---- RunSignup ----------------------------------------------------------
// Public results API: https://runsignup.com/rest/race/<raceId>/results/get-results
//   ?event_id=<eventId>&result_set_id=<id>&format=json&num=1000
// A results URL looks like
//   https://runsignup.com/Race/Results/<raceId>/...#resultSetId-<setId>
//   ...?resultSetId=<setId>&eventId=<eventId>
// We pull the ids out of the URL (path + query + hash) and hit the API.

function pickId(re: RegExp, ...sources: string[]): string | null {
  for (const s of sources) {
    const m = s.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

async function tryRunSignup(rawUrl: string): Promise<ParseResult | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const path = u.pathname;
  const query = u.search;
  const hash = u.hash;

  const raceId =
    pickId(/\/Race\/(?:Results\/)?(\d+)/i, path) ??
    pickId(/[?&]raceId=(\d+)/i, query);
  if (!raceId) return null;

  const eventId =
    pickId(/[?&]eventId=(\d+)/i, query, hash) ?? pickId(/eventId-(\d+)/i, hash);
  const resultSetId =
    pickId(/[?&]resultSetId=(\d+)/i, query, hash) ??
    pickId(/resultSetId-(\d+)/i, hash);

  const api = new URL(
    `https://runsignup.com/rest/race/${raceId}/results/get-results`
  );
  api.searchParams.set("format", "json");
  api.searchParams.set("num", "2500");
  if (eventId) api.searchParams.set("event_id", eventId);
  if (resultSetId) api.searchParams.set("result_set_id", resultSetId);

  const text = await fetchText(api.toString());
  if (!text) return null;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }

  const parsed = parseRunSignupJson(json);
  if (!parsed || parsed.entries.length === 0) return null;
  return parsed;
}

/** RunSignup results JSON → entries. Shape (abridged):
 *  { individual_results_sets: [ { results: [ { bib_num, first_name,
 *      last_name, gender, age, city, state, chip_time, clock_time, ... } ] } ] }
 *  We defensively walk whatever result sets are present. */
function parseRunSignupJson(json: unknown): ParseResult | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const sets =
    (root.individual_results_sets as unknown[]) ??
    (root.results as unknown[]) ??
    null;
  if (!Array.isArray(sets)) return null;

  const entries: ParsedRosterEntry[] = [];
  const seen = new Set<number>();
  const warnings: string[] = [];

  for (const set of sets) {
    if (!set || typeof set !== "object") continue;
    const results = (set as Record<string, unknown>).results;
    const setName = String(
      (set as Record<string, unknown>).result_set_name ?? ""
    ).trim();
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const bibRaw = row.bib_num ?? row.bib ?? row.bib_number;
      const bib = typeof bibRaw === "number" ? bibRaw : parseInt(String(bibRaw ?? ""), 10);
      if (!Number.isFinite(bib)) continue;
      if (seen.has(bib)) continue;
      seen.add(bib);
      const first = String(row.first_name ?? "").trim();
      const last = String(row.last_name ?? "").trim();
      const name =
        [first, last].filter(Boolean).join(" ") || String(row.name ?? "").trim();
      const city = String(row.city ?? "").trim();
      const state = String(row.state ?? "").trim();
      const entry: ParsedRosterEntry = { bib, name };
      const finish = String(row.chip_time ?? row.clock_time ?? row.time ?? "").trim();
      const gender = String(row.gender ?? row.sex ?? "").trim();
      const age = String(row.age ?? "").trim();
      const distance = setName;
      if (finish) entry.finishTime = finish;
      if (gender) entry.gender = gender;
      if (age) entry.ageGroup = age;
      if (city || state) entry.city = [city, state].filter(Boolean).join(", ");
      if (distance) entry.distance = distance;
      entries.push(entry);
    }
  }

  if (entries.length === 0) return null;
  warnings.push(`Read ${entries.length} finisher(s) from the RunSignup results API.`);
  return { entries, warnings };
}

// ---- Embedded-JSON attempt (RaceResult & generic results pages) ---------
// Some pages ship the results as a JSON array inside a <script> tag. We look
// for an array of objects that carry bib-like + name-like keys and, if found,
// map it through the same field heuristics. This is best-effort: if we can't
// confidently find such a blob we return null and the caller shows guidance.

function tryEmbeddedJson(html: string): ParseResult | null {
  // Grab candidate JSON arrays: the largest [...] blocks in the HTML.
  const candidates = extractJsonArrays(html);
  for (const arr of candidates) {
    const parsed = mapObjectArray(arr);
    if (parsed && parsed.entries.length > 0) return parsed;
  }
  return null;
}

/** Pull plausible top-level JSON arrays of objects out of raw HTML/JS text.
 *  Scans for "[{" … balanced "}]" spans and JSON.parses each; returns the ones
 *  that parse to a non-trivial array of objects. Bounded to avoid pathological
 *  scanning on huge pages. */
function extractJsonArrays(text: string): unknown[][] {
  const out: unknown[][] = [];
  const MAX = 6;
  let idx = 0;
  while (out.length < MAX) {
    const start = text.indexOf("[{", idx);
    if (start === -1) break;
    // Find the matching close by scanning bracket depth (ignoring brackets
    // inside strings). Cap the span so a broken page can't hang us.
    const end = matchArrayEnd(text, start);
    if (end === -1) {
      idx = start + 2;
      continue;
    }
    const slice = text.slice(start, end + 1);
    idx = end + 1;
    if (slice.length > 2_000_000) continue; // too big to trust/parse cheaply
    try {
      const val = JSON.parse(slice);
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        out.push(val);
      }
    } catch {
      /* not valid JSON — skip */
    }
  }
  return out;
}

/** Given text and the index of a leading '[', return the index of the matching
 *  ']' accounting for nested brackets and quoted strings, or -1. Bounded. */
function matchArrayEnd(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let quote = "";
  const limit = Math.min(text.length, start + 2_000_000);
  for (let i = start; i < limit; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") {
        i++; // skip escaped char
      } else if (ch === quote) {
        inStr = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
    } else if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Map an array of plain objects to entries using loose key heuristics. */
function mapObjectArray(arr: unknown[]): ParseResult | null {
  const bibKeys = ["bib", "bibnumber", "bibno", "bib_num", "number", "bib_number"];
  const nameKeys = ["name", "fullname", "athlete", "participant", "runner"];
  const firstKeys = ["first", "firstname", "first_name", "fname"];
  const lastKeys = ["last", "lastname", "last_name", "lname"];
  const timeKeys = ["chip_time", "chiptime", "finishtime", "finish", "time", "clock_time", "guntime", "nettime", "result"];
  const genderKeys = ["gender", "sex"];
  const ageKeys = ["age", "agegroup", "age_group", "ag"];
  const cityKeys = ["city", "town", "hometown"];

  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const get = (obj: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const key of Object.keys(obj)) {
      if (keys.includes(norm(key))) {
        const v = obj[key];
        if (v != null) return String(v).trim();
      }
    }
    return undefined;
  };

  const entries: ParsedRosterEntry[] = [];
  const seen = new Set<number>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const bibStr = get(obj, bibKeys);
    if (!bibStr) continue;
    const bibMatch = bibStr.match(/\d+/);
    if (!bibMatch) continue;
    const bib = parseInt(bibMatch[0], 10);
    if (!Number.isFinite(bib) || seen.has(bib)) continue;

    const name =
      get(obj, nameKeys) ||
      [get(obj, firstKeys), get(obj, lastKeys)].filter(Boolean).join(" ");
    // Require a name to consider this a real results array (guards against
    // matching unrelated JSON that happens to have a numeric "number" field).
    if (!name) continue;
    seen.add(bib);

    const entry: ParsedRosterEntry = { bib, name };
    const time = get(obj, timeKeys);
    const gender = get(obj, genderKeys);
    const age = get(obj, ageKeys);
    const city = get(obj, cityKeys);
    if (time) entry.finishTime = time;
    if (gender) entry.gender = gender;
    if (age) entry.ageGroup = age;
    if (city) entry.city = city;
    entries.push(entry);
  }

  if (entries.length < 2) return null; // one row is more likely a false match
  return {
    entries,
    warnings: [`Extracted ${entries.length} entrant(s) from data embedded in the page.`],
  };
}

/**
 * Attempt to import from a live URL. Returns a ParseResult — either real
 * entries (RunSignup API / embedded JSON) or an empty result whose warnings
 * carry the honest per-source guidance to export a CSV.
 */
export async function parseUrl(rawUrl: string, source: RosterSource): Promise<ParseResult> {
  // RunSignup: try the public results API first.
  if (source === "runsignup") {
    const rs = await tryRunSignup(rawUrl);
    if (rs) return rs;
    return guidanceResult("runsignup");
  }

  // RaceResult + unknown/other results pages: try to pull an embedded JSON
  // results blob out of the served HTML. Race Roster / Athlinks / ChronoTrack
  // are known-dynamic — don't waste a fetch, go straight to guidance.
  if (source === "raceresult" || source === "results-page") {
    const html = await fetchText(rawUrl);
    if (html) {
      const embedded = tryEmbeddedJson(html);
      if (embedded) return embedded;
    }
    return guidanceResult(source);
  }

  // Everything else dynamic → guidance.
  return guidanceResult(source);
}
