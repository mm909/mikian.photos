/* THE HYROX SIGN-UP BOARD (owner, 2026-10-13: "a page for people to let me
 * know they are running the Las Vegas Hyrox event. Ideally, this can be
 * made for other Hyrox events ... I need to be able to say, I'm running on
 * this day with these people, this event, and I want to be able to see
 * everyone who has filled out the form").
 *
 * One file for the events, the categories and the rules the form, the
 * routes, the board and the sticker all read, so they cannot drift. No
 * imports: the client form reads this too.
 *
 * AN EVENT is a Hyrox weekend: a slug for the URL, the city, the season's
 * year, the days people can race on, where, a link to the official page.
 * A new event is one entry in EVENTS and a page exists for it.
 *
 * A CATEGORY is what Hyrox sells tickets for (the 26/27 rulebooks and the
 * event schedules):
 *   SINGLES  open / pro / adaptive  ×  men / women
 *   DOUBLES  open / pro             ×  men / women / mixed
 *   RELAY    (one division)         ×  men / women / mixed   — teams of 4
 * Age groups are a results thing, not a ticket, and the owner wants no
 * birthdays here, so there are none. */

export type HyroxDay = { date: string; dow: string; label: string };

export type HyroxEvent = {
  slug: string;
  /* "Las Vegas" — the city, the way the sticker prints it. */
  city: string;
  /* "HYROX Las Vegas 2027". */
  name: string;
  year: number;
  /* The race days, in order. `date` is the ISO day the row stores. */
  days: HyroxDay[];
  venue: string;
  venueAddress: string;
  /* The official event page. */
  url: string;
  /* The IANA zone the days are in; the board prints "when" in it. */
  timeZone: string;
  /* Sign-ups close here (ms since epoch); the board stays up. */
  closeMs: number;
  /* Once Hyrox announces start times the form takes one (owner,
   * 2026-10-13: "they won't know their start time when they originally
   * fill out this form ... we will send out a thing to fill out your start
   * time later on"). Off until then. The lookup (record.ts) fills them
   * in from the published start list either way. */
  startTimesOpen: boolean;
  /* hyresult.com's slug for the weekend — its event page is where the
   * results show live and after (owner, 2026-10-15: "if hyresult has a
   * page where you can see someone's position live during the race, link
   * to that"). The pattern is s<season>-<year>-<city>; Las Vegas 2027 is
   * expected at s9-2027-las-vegas and is checked when hyresult lists it. */
  hyresultEvent: string;
};

export const EVENTS: HyroxEvent[] = [
  {
    slug: "las-vegas-2027",
    city: "Las Vegas",
    name: "HYROX Las Vegas 2027",
    year: 2027,
    days: [
      { date: "2027-03-12", dow: "Fri", label: "Friday, March 12" },
      { date: "2027-03-13", dow: "Sat", label: "Saturday, March 13" },
      { date: "2027-03-14", dow: "Sun", label: "Sunday, March 14" },
    ],
    venue: "Las Vegas Convention Center",
    venueAddress: "3150 Paradise Rd, Las Vegas, NV",
    url: "https://hyrox.com/event/hyrox-las-vegas/",
    timeZone: "America/Los_Angeles",
    /* The day after the last race day, end of day Pacific (UTC−7 in March). */
    closeMs: Date.UTC(2027, 2, 16, 7, 0, 0),
    startTimesOpen: false,
    hyresultEvent: "s9-2027-las-vegas",
  },
];

/* Where the weekend stands for a viewer now, by the calendar day in the
 * event's own zone: before the first race day, on one of them (live), or
 * after the last. */
export function raceWeekendState(ev: HyroxEvent, now = new Date()): "before" | "live" | "after" {
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone: ev.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    today = now.toISOString().slice(0, 10);
  }
  if (today < ev.days[0].date) return "before";
  if (today > ev.days[ev.days.length - 1].date) return "after";
  return "live";
}

export function eventBySlug(slug: string): HyroxEvent | null {
  return EVENTS.find((e) => e.slug === slug) ?? null;
}

export function isClosed(ev: HyroxEvent, atMs = Date.now()): boolean {
  return atMs >= ev.closeMs;
}

export function dayOf(ev: HyroxEvent, date: string): HyroxDay | null {
  return ev.days.find((d) => d.date === date) ?? null;
}

/* "Sat, Mar 13" — the short form the board and the sticker use. */
export function shortDay(d: HyroxDay): string {
  const [, m, day] = d.date.split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.dow}, ${MONTHS[m - 1]} ${day}`;
}

export const PATH = "/hyrox";
export function eventPath(ev: HyroxEvent): string {
  return `${PATH}/${ev.slug}`;
}
export function listPath(ev: HyroxEvent): string {
  return `${PATH}/${ev.slug}/the-list`;
}

/* ------------------------------------------------------------- the links */

/* WHERE THE RECORD AND THE LINKS COME FROM (researched 2026-10-15; owner:
 * "we should be able to look up hyresult.com/athlete/mikian-musser ...
 * that should show past results, how many times they've ran, their PRs,
 * if they're debuting"; "if you click on the name then it takes you to
 * the hyresult page"):
 *   hyresult.com — a page per athlete, by name: every race with its
 *     division, partner and time, and the upcoming wave once published.
 *     Read by record.ts; every name on the board links to it, a finish
 *     to its result page, the board to the event page (live results).
 *   results.hyrox.com / startlist.hyrox.com — the official site; HTML
 *     only, searchable by name only with an event code that exists once
 *     the start list is out. Not linked.
 *   ROXFIT (roxfit.app) is the race-day app people use; it has no web
 *     profile and nothing to link to. */

/* hyresult.com's event page — the results, live during the weekend — and
 * one result's page (the finish, the splits). */
export function hyresultEventUrl(ev: HyroxEvent): string {
  return `https://www.hyresult.com/event/${ev.hyresultEvent}`;
}
export function hyresultResultUrl(idp: string): string {
  return `https://www.hyresult.com/result/${encodeURIComponent(idp)}`;
}

/* hyresult.com's page for a name: lowercase, accents dropped, hyphens
 * between the words — "José García" → /athlete/jose-garcia. */
export function hyresultUrl(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.hyresult.com/athlete/${slug}`;
}

/* ------------------------------------------------------------ categories */

export const FORMATS = ["singles", "doubles", "relay"] as const;
export type Format = (typeof FORMATS)[number];

export const DIVISIONS = ["open", "pro", "adaptive"] as const;
export type Division = (typeof DIVISIONS)[number];

export const GENDERS = ["men", "women", "mixed"] as const;
export type Gender = (typeof GENDERS)[number];

export const FORMAT_LABEL: Record<Format, string> = { singles: "Singles", doubles: "Doubles", relay: "Relay" };
export const DIVISION_LABEL: Record<Division, string> = { open: "Open", pro: "Pro", adaptive: "Adaptive" };
export const GENDER_LABEL: Record<Gender, string> = { men: "Men's", women: "Women's", mixed: "Mixed" };

/* The divisions a format sells. Relay has one, written as "open". */
export function divisionsFor(format: Format): readonly Division[] {
  if (format === "singles") return ["open", "pro", "adaptive"];
  if (format === "doubles") return ["open", "pro"];
  return ["open"];
}

export function gendersFor(format: Format): readonly Gender[] {
  return format === "singles" ? ["men", "women"] : ["men", "women", "mixed"];
}

/* How many names besides their own a category carries: a doubles partner,
 * three relay teammates. */
export function partnerSlots(format: Format): number {
  return format === "doubles" ? 1 : format === "relay" ? 3 : 0;
}

export type Category = { format: Format; division: Division; gender: Gender };

export function isFormat(v: unknown): v is Format {
  return typeof v === "string" && (FORMATS as readonly string[]).includes(v);
}
export function isDivision(v: unknown): v is Division {
  return typeof v === "string" && (DIVISIONS as readonly string[]).includes(v);
}
export function isGender(v: unknown): v is Gender {
  return typeof v === "string" && (GENDERS as readonly string[]).includes(v);
}

/* A category the rulebook sells, or null. */
export function readCategory(format: unknown, division: unknown, gender: unknown): Category | null {
  if (!isFormat(format) || !isDivision(division) || !isGender(gender)) return null;
  if (!divisionsFor(format).includes(division)) return null;
  if (!gendersFor(format).includes(gender)) return null;
  return { format, division, gender };
}

/* "Women's Pro Doubles", "Mixed Relay", "Men's Open", "Men's Adaptive". */
export function categoryLabel(c: Category): string {
  const g = GENDER_LABEL[c.gender];
  if (c.format === "relay") return `${g} Relay`;
  const d = DIVISION_LABEL[c.division];
  return c.format === "singles" ? `${g} ${d}` : `${g} ${d} Doubles`;
}

/* The order the board lists categories within a day: the pros first, then
 * open singles, doubles, relay; men, women, mixed within each. */
export function categoryRank(c: Category): number {
  const f = c.format === "singles" ? 0 : c.format === "doubles" ? 1 : 2;
  const d = c.division === "pro" ? 0 : c.division === "open" ? 1 : 2;
  const g = c.gender === "men" ? 0 : c.gender === "women" ? 1 : 2;
  return f * 100 + d * 10 + g;
}

/* --------------------------------------------------------------- the row */

/* A partner or teammate: the name as typed and the handle, bare (owner,
 * 2026-10-13: "for the partner, I also want their Instagram"). */
export type Partner = { name: string; instagram: string };

/* What the form sends and the route checks. The email is the account's,
 * not a field (owner, 2026-10-13: "we won't need them to fill out their
 * email, because they'll be signed in"). Partners are names as typed,
 * blanks dropped; a doubles entry can be sent before the partner is known.
 * No team name (owner, 2026-10-13: "we're not going to have team names"). */
export type EntryInput = {
  name: string;
  instagram: string;
  format: Format;
  division: Division;
  gender: Gender;
  day: string;
  partners: Partner[];
  startTime: string;
};

export const ERR = {
  name: "Add your name first.",
  category: "Pick a category — singles, doubles or relay, and which one.",
  day: "Pick the day you are racing.",
  partner: "Add your partner's name, or leave it blank if you do not know yet.",
  startTime: "Start time looks off — something like 9:40 AM.",
} as const;

/* "@handle", "handle", or a pasted profile URL → bare handle. */
export function igHandle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let h = raw.trim();
  const m = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) h = m[1];
  return h.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 64);
}

function cleanName(raw: unknown, max = 80): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/* A start time as people write it: "9:40 AM", "09:40", "14:05". Blank is
 * fine (owner: "eventually, when start times are announced"). */
export function cleanStartTime(raw: unknown): string | null {
  if (typeof raw !== "string") return "";
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 16);
  if (!s) return "";
  if (!/^([01]?\d|2[0-3])(:[0-5]\d)?\s?([AaPp][Mm]\.?)?$/.test(s)) return null;
  return s.toUpperCase().replace(/\./g, "");
}

/* ------------------------------------------------------------ the record */

/* WHAT THE BOARD SAYS ABOUT A RACE BESIDES WHO AND WHEN (owner, 2026-10-15:
 * "this person is running at this time and this is a debut or this is
 * their PR"). The row carries, per entry — the athlete, the pair or the
 * team in THIS category — how many times they have raced it before
 * (`priorRaces`; 0 is a DEBUT, and a doubles with a new partner is one),
 * their best time in it (`pr`), and once the race is run their finish
 * (`finishTime`, `resultIdp`). All of it is read off hyresult.com by the
 * lookup in record.ts — on every save and on REFRESH from the owner's
 * list — never typed (owner: "that should just be automatic"). Printed:
 * DEBUT, and the PR; not the count (owner: "we only want to highlight
 * debuts, not the times before ... but we do want to include the PR"). */
export type RecordView = { priorRaces?: number | null; pr?: string; finishTime?: string };

export function isDebut(r: RecordView): boolean {
  return r.priorRaces === 0;
}

/* "PR 1:12:34", or "" when none is known. */
export function prLabel(r: RecordView): string {
  return r.pr ? `PR ${r.pr}` : "";
}

/* "1:12:34" or "58:12" → seconds; anything else NaN. */
export function toSeconds(t: string): number {
  const m = t.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
}

/* A finish that beat the PR hyresult had before the race (owner,
 * 2026-10-15: "we can denote if they PR'd"). */
export function isNewPr(r: RecordView): boolean {
  if (!r.finishTime || !r.pr) return false;
  const f = toSeconds(r.finishTime);
  const p = toSeconds(r.pr);
  return Number.isFinite(f) && Number.isFinite(p) && f < p;
}

/* "9:40 AM" (or "14:05") → minutes since midnight, to put the list in
 * wave order; blank or odd sorts after everything. */
export function startMinutes(s: string): number {
  const m = s.trim().toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s?(AM|PM)?$/);
  if (!m) return 100_000;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/* "MEN'S DOUBLES" and the tag beside it: PRO or ADAPTIVE in a box; open
 * says nothing (owner, 2026-10-14: "we don't have to specify open on the
 * stickers, just pro"; 2026-10-15: the board and the list the same way,
 * "highlight the pro on the board"). */
export function catWords(cat: Category | null): { words: string; tag: string } {
  if (!cat) return { words: "OTHER", tag: "" };
  const words = `${GENDER_LABEL[cat.gender]} ${FORMAT_LABEL[cat.format]}`.toUpperCase();
  if (cat.format === "relay" || cat.division === "open") return { words, tag: "" };
  return { words, tag: DIVISION_LABEL[cat.division].toUpperCase() };
}

/* ----------------------------------------------------------- reading it */

/* What a save may write besides the entry's own fields: a start time is
 * taken once the event opens them, or from the owner any time (he keys
 * them in from the start list). The route writes only what was taken, so
 * a rower re-saving their entry never blanks what the owner put on it. */
export type Taken = { startTime: boolean };

/* The body → a clean row, or the first thing wrong with it. */
export function readEntry(
  ev: HyroxEvent,
  body: Record<string, unknown>,
  opts: { admin?: boolean } = {},
): { ok: true; entry: EntryInput; taken: Taken } | { ok: false; error: string } {
  const name = cleanName(body.name, 120);
  if (!name) return { ok: false, error: ERR.name };
  const instagram = igHandle(body.instagram);
  const cat = readCategory(body.format, body.division, body.gender);
  if (!cat) return { ok: false, error: ERR.category };
  const day = typeof body.day === "string" && dayOf(ev, body.day) ? body.day : "";
  if (!day) return { ok: false, error: ERR.day };
  const slots = partnerSlots(cat.format);
  const rawPartners = Array.isArray(body.partners) ? body.partners : [];
  const partners: Partner[] = rawPartners
    .slice(0, slots)
    .map((p) => {
      const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
      return { name: cleanName(o.name), instagram: igHandle(o.instagram) };
    })
    .filter((p) => p.name);
  const admin = opts.admin === true;
  const taken: Taken = { startTime: ev.startTimesOpen || admin };
  const startTime = taken.startTime ? cleanStartTime(body.startTime) : "";
  if (startTime === null) return { ok: false, error: ERR.startTime };
  return { ok: true, entry: { name, instagram, ...cat, day, partners, startTime }, taken };
}

/* The two columns a row stores partners in, aligned by index. */
export function partnersToColumns(partners: Partner[]): { partners: string[]; partnerIgs: string[] } {
  return { partners: partners.map((p) => p.name), partnerIgs: partners.map((p) => p.instagram) };
}
export function partnersFromColumns(names: string[], igs: string[]): Partner[] {
  return names.map((name, i) => ({ name, instagram: igs[i] ?? "" }));
}
