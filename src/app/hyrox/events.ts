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
  },
];

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

/* What the form sends and the route checks. Partners are names as typed,
 * blanks dropped; a doubles entry can be sent before the partner is known. */
export type EntryInput = {
  name: string;
  email: string;
  instagram: string;
  format: Format;
  division: Division;
  gender: Gender;
  day: string;
  partners: string[];
  teamName: string;
  startTime: string;
};

export const ERR = {
  name: "Add your name first.",
  email: "Add an email I can reach you at.",
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

/* The body → a clean row, or the first thing wrong with it. */
export function readEntry(ev: HyroxEvent, body: Record<string, unknown>): { ok: true; entry: EntryInput } | { ok: false; error: string } {
  const name = cleanName(body.name, 120);
  if (!name) return { ok: false, error: ERR.name };
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: ERR.email };
  const instagram = igHandle(body.instagram);
  const cat = readCategory(body.format, body.division, body.gender);
  if (!cat) return { ok: false, error: ERR.category };
  const day = typeof body.day === "string" && dayOf(ev, body.day) ? body.day : "";
  if (!day) return { ok: false, error: ERR.day };
  const slots = partnerSlots(cat.format);
  const rawPartners = Array.isArray(body.partners) ? body.partners : [];
  const partners = rawPartners
    .slice(0, slots)
    .map((p) => cleanName(p))
    .filter(Boolean);
  const teamName = slots > 0 ? cleanName(body.teamName, 60) : "";
  const startTime = cleanStartTime(body.startTime);
  if (startTime === null) return { ok: false, error: ERR.startTime };
  return { ok: true, entry: { name, email, instagram, ...cat, day, partners, teamName, startTime } };
}
