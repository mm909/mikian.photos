import { dayOf, hyresultUrl, readCategory, type Category, type HyroxEvent } from "./events";

/* THE RECORD, READ OFF HYRESULT (owner, 2026-10-15: "I do not want them
 * to have to enter a debut or how many times they've ran or their PR —
 * that should just be automatic"; "we should be able to look up
 * https://www.hyresult.com/athlete/mikian-musser ... past results, how
 * many times they've ran, their PRs, if they're debuting").
 *
 * hyresult.com has a page per athlete by name (events.ts hyresultUrl).
 * It is a Next.js page: the data rides inside the HTML as React server
 * component chunks — `self.__next_f.push([1,"…"])` strings — and among
 * them `"races":[…]`, every race the name has run (division as `dg`,
 * the team for a doubles or relay, the time in seconds, the result's
 * `idp`), and `"upcoming":[…]`, the start-list entries once a wave is
 * published (`day`, `time`, `startAt`). No API, no auth, no JSON route;
 * the page is fetched and read. A name with no page comes back with no
 * races, which here means a debut.
 *
 * WHAT IS COMPUTED for an entry on the board — the athlete, the pair or
 * the team in THIS category (`dg`):
 *   priorRaces   finishes in the category before this event; for a
 *                doubles or relay only with the same partners, so a new
 *                partner is a debut (owner: "they've ran open doubles but
 *                it was with a different partner" is a debut)
 *   pr           the fastest of those
 *   finishTime   their time at this event, once hyresult has it
 *   resultIdp    that result's id (hyresult.com/result/<idp>)
 *   startTime    the published wave for this event, "4:00 PM", and the
 *                day it falls on, once the start list is out
 * Pure functions, so `npx tsx src/app/hyrox/record.test.ts` can run them
 * against saved pages; only lookUp() touches the network. */

export type HyRace = {
  idp: string;
  dg: string;
  division?: string;
  location: string;
  date_start: string;
  date_end?: string | null;
  season?: number;
  t_total: number | null;
  rank?: number | null;
  event_slug?: string;
  team?: { name: string; slug?: string }[] | null;
};

export type HyUpcoming = {
  idp?: string;
  dg: string;
  location: string;
  date_start: string;
  date_end?: string | null;
  event_slug?: string;
  day?: string | null;
  time?: string | null;
  startAt?: string | null;
  athletes?: { name: string; slug?: string }[] | null;
};

export type HyAthlete = { slug: string; races: HyRace[]; upcoming: HyUpcoming[] };

/* hyresult's division key for one of our categories: "men", "pro-men",
 * "doubles-mixed", "pro-doubles-women", "team-relay-men", "adaptive-men"
 * (seen on real pages, except adaptive, which follows the pattern). */
export function dgFor(c: Category): string {
  const g = c.gender;
  if (c.format === "relay") return `team-relay-${g}`;
  if (c.format === "doubles") return c.division === "pro" ? `pro-doubles-${g}` : `doubles-${g}`;
  if (c.division === "pro") return `pro-${g}`;
  if (c.division === "adaptive") return `adaptive-${g}`;
  return g;
}

/* "Hunter McIntyre" and "Hunter Mcintyre" are one person: lowercase, no
 * accents, one space. */
export function normName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Seconds → "1:12:34", or "58:12" under the hour. */
export function fmtSeconds(s: number): string {
  const t = Math.round(s);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/* "16:00" → "4:00 PM"; "09:40" → "9:40 AM". Anything else as given. */
export function fmtWave(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time.trim();
  const h = Number(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${ap}`;
}

/* ------------------------------------------------------------ the page */

/* The React server component payload of a hyresult page, as one string. */
export function rscText(html: string): string {
  const out: string[] = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      /* a chunk that is not a plain string: skip it */
    }
  }
  return out.join("");
}

/* Every JSON array under `"<key>":[` in the payload, parsed; arrays that
 * will not parse are skipped. */
function arraysUnder(text: string, key: string): unknown[][] {
  const needle = `"${key}":[`;
  const out: unknown[][] = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(needle, from);
    if (i < 0) return out;
    const start = i + needle.length - 1;
    let depth = 0;
    let k = start;
    for (; k < text.length; k++) {
      const ch = text[k];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) break;
      } else if (ch === '"') {
        k++;
        while (k < text.length && text[k] !== '"') {
          if (text[k] === "\\") k++;
          k++;
        }
      }
    }
    try {
      const arr = JSON.parse(text.slice(start, k + 1)) as unknown;
      if (Array.isArray(arr)) out.push(arr);
    } catch {
      /* not JSON after all */
    }
    from = i + 1;
  }
}

const isRace = (x: unknown): x is HyRace => {
  const o = x as Record<string, unknown> | null;
  return !!o && typeof o === "object" && typeof o.idp === "string" && typeof o.dg === "string" && typeof o.location === "string" && typeof o.date_start === "string";
};

/* The athlete page's data: the races (one copy each, by idp) and the
 * upcoming waves. */
export function parseAthletePage(slug: string, html: string): HyAthlete {
  const text = rscText(html);
  const races = new Map<string, HyRace>();
  for (const arr of arraysUnder(text, "races")) for (const r of arr) if (isRace(r) && !races.has(r.idp)) races.set(r.idp, r);
  const upcoming: HyUpcoming[] = [];
  const seen = new Set<string>();
  for (const arr of arraysUnder(text, "upcoming")) {
    for (const u of arr) {
      if (!isRace(u)) continue;
      const key = `${u.idp}|${u.dg}|${u.date_start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      upcoming.push(u as unknown as HyUpcoming);
    }
  }
  return { slug, races: [...races.values()], upcoming };
}

/* ---------------------------------------------------------- the record */

export type HyRecord = {
  priorRaces: number;
  pr: string;
  finishTime: string;
  resultIdp: string;
  /* From the start list, when published; "" otherwise. */
  startTime: string;
  /* The ISO day the published wave falls on, when it is one of the
   * event's days; "" otherwise. */
  day: string;
};

export type RecordInput = { name: string; format: string; division: string; gender: string; partners: { name: string }[] };

/* Is this race (or wave) this event: the same city, on its days. */
function atEvent(ev: HyroxEvent, r: { location: string; date_start: string; date_end?: string | null }): boolean {
  if (normName(r.location) !== normName(ev.city)) return false;
  const first = ev.days[0].date;
  const last = ev.days[ev.days.length - 1].date;
  const end = r.date_end || r.date_start;
  return r.date_start <= last && end >= first;
}

export function recordFrom(ev: HyroxEvent, entry: RecordInput, athlete: HyAthlete): HyRecord | null {
  const cat = readCategory(entry.format, entry.division, entry.gender);
  if (!cat) return null;
  const dg = dgFor(cat);
  const partners = entry.partners.map((p) => normName(p.name)).filter(Boolean);
  const sameTeam = (r: HyRace) => partners.every((p) => (r.team ?? []).some((m) => normName(m.name) === p));

  const prior = athlete.races.filter((r) => r.dg === dg && !atEvent(ev, r) && typeof r.t_total === "number" && r.t_total > 0 && sameTeam(r));
  const best = prior.reduce<number | null>((a, r) => (a === null || (r.t_total as number) < a ? (r.t_total as number) : a), null);
  const here = athlete.races.find((r) => r.dg === dg && atEvent(ev, r));
  const wave = athlete.upcoming.find((u) => u.dg === dg && atEvent(ev, u));

  let day = "";
  if (wave?.day) {
    const d = ev.days.find((x) => x.label.toLowerCase().startsWith(wave.day!.toLowerCase().slice(0, 3)));
    if (d && dayOf(ev, d.date)) day = d.date;
  }
  return {
    priorRaces: prior.length,
    pr: best === null ? "" : fmtSeconds(best),
    finishTime: here && typeof here.t_total === "number" && here.t_total > 0 ? fmtSeconds(here.t_total) : "",
    resultIdp: here?.idp ?? "",
    startTime: wave?.time ? fmtWave(wave.time) : "",
    day,
  };
}

/* ------------------------------------------------------------ the fetch */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/* The athlete page for a name, read and parsed; null when hyresult could
 * not be reached (not when the name is unknown — that is a page with no
 * races). About a second per name. */
export async function fetchAthlete(name: string, timeoutMs = 8000): Promise<HyAthlete | null> {
  const url = hyresultUrl(name);
  const slug = url.slice(url.lastIndexOf("/") + 1);
  if (!slug) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return parseAthletePage(slug, await res.text());
  } catch (err) {
    console.warn(`[hyrox] hyresult fetch failed for ${slug}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* The record for one entry, fetched: null when hyresult was unreachable. */
export async function lookUp(ev: HyroxEvent, entry: RecordInput, timeoutMs?: number): Promise<(HyRecord & { slug: string }) | null> {
  const athlete = await fetchAthlete(entry.name, timeoutMs);
  if (!athlete) return null;
  const rec = recordFrom(ev, entry, athlete);
  return rec ? { ...rec, slug: athlete.slug } : null;
}
