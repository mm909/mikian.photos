import { monthOf, prevMonth, weeksOf, FIRST_MONTH_KEY, type Month, type Week as PeriodWeek } from "./rowPeriod";
/* Row 100k — September 2026 challenge (/row100k).
 *
 * All the challenge's rules live here as pure functions so the API routes,
 * the server page, and the client UI can't drift apart: the window, entry
 * validation, and the leaderboard math. Everything returned is plain JSON —
 * safe to pass from a server component into client components.
 */

export const CHALLENGE_LIVE = "row100k-sep-2026";
/* A parallel namespace holding the seeded fake board (scripts/row100k-demo-seed.ts).
 * Same tables, different `challenge` slug — demo rowers are invisible to the
 * live site by construction. */
export const CHALLENGE_DEMO = "row100k-sep-2026-demo";

/* Demo mode is ONE switch: NEXT_PUBLIC_ROW100K_DEMO=1 flips the namespace
 * below AND arms the clock shift further down. One flag, so the fake board
 * and the fake clock can never come apart — a shifted clock against the LIVE
 * namespace would let September rows be written in August. NEXT_PUBLIC_ so
 * the client bundle sees the same decision the server makes. */
const DEMO = process.env.NEXT_PUBLIC_ROW100K_DEMO === "1";

/* Which namespace this process reads and writes. Only a dev server started
 * via npm run dev:row100k — or a Vercel *preview* deployment with the same
 * env vars, for phone testing — sees the fake board. VERCEL_ENV is
 * "production" on the real site, so a stray env var can't swap the standings. */
export const CHALLENGE =
  (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview") && DEMO
    ? CHALLENGE_DEMO
    : CHALLENGE_LIVE;

export const GOAL_METERS = 100_000;

/* Challenge moderation — remove a rower, fix or delete anyone's rows. The
 * platform owner role qualifies, plus these accounts. Both are also site-wide
 * owner emails (see isOwnerEmail in permissions.ts); the explicit list here is
 * kept so challenge admin never depends on role hydration. */
const ADMIN_EMAILS = ["mikian.photos@gmail.com", "mikianmusser@gmail.com"];

export function isRow100kAdmin(email: string, roles: string[]): boolean {
  return roles.includes("owner") || ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/* THE WINDOW is the month the clock is in — see below nowMs(), where it
 * is derived (rowPeriod.ts). Days are plain "YYYY-MM-DD" strings (what the
 * participant picked in the date input) — never Date objects, so server
 * timezone can't shift a row onto the wrong day. */

/* Demo-only clock shift, so a seeded mid-challenge board can be seen in the
 * state it belongs to instead of behind a "starts Sep 1" countdown. Set
 * NEXT_PUBLIC_ROW100K_NOW="2026-09-20T19:00:00Z" and every surface — server
 * pages, countdown, log form, write routes — behaves as if it were that
 * moment. NEXT_PUBLIC_ so the same offset reaches the client bundle and
 * server and client agree. The var itself is the switch: it exists only in
 * dev (npm run dev:row100k) and Vercel *Preview* env vars — NEVER set it in
 * the Production environment (server and client would disagree, and the live
 * clock would lie). Held as an offset, not an instant, so it still ticks. */
const CLOCK_OFFSET_MS = (() => {
  if (!DEMO || process.env.VERCEL_ENV === "production") return 0;
  const at = Date.parse(process.env.NEXT_PUBLIC_ROW100K_NOW ?? "");
  return Number.isFinite(at) ? at - Date.now() : 0;
})();

/* Every "what time is it" in the challenge goes through here. In production
 * it is exactly Date.now(). */
export function nowMs(): number {
  return Date.now() + CLOCK_OFFSET_MS;
}

/* THE MONTH THE SITE IS IN (owner, 2026-09-24: a Strava-like platform with
 * monthly boards, not a September challenge). Every September-shaped
 * constant the site grew up with is now read off the month the clock is
 * in, once per process: FIRST_DAY, LAST_DAY, the start and end instants,
 * the grace close, how many days the calendars draw and which weekday the
 * 1st falls on. A process that lives across a month boundary keeps the
 * month it started in until it is restarted; serverless does not live that
 * long. The demo clock (NEXT_PUBLIC_ROW100K_NOW) moves the month with it,
 * which is how December is previewed. */
export const MONTH: Month = monthOf(nowMs());
export const MONTH_KEY = MONTH.key;
export const MONTH_DAYS = MONTH.days;
export const MONTH_FIRST_DOW = MONTH.firstDow;
export const FIRST_DAY = MONTH.firstDay;
export const LAST_DAY = MONTH.lastDay;
/* The 1st, 00:00 Pacific — what the countdown ticks toward. */
export const START_MS = MONTH.startMs;
/* The last day, midnight Pacific — when the clock runs out. */
export const END_MS = MONTH.endMs;
/* Grace: late-logging a row for this month is allowed for three days after. */
export const LOG_CLOSE_MS = MONTH.logCloseMs;

/* How many September days the charts should draw: 1 on Sep 1, 30 from Sep 30
 * onward. Every calendar, curve and bar chart stops at TODAY rather than
 * reserving empty space for days nobody has rowed yet (owner call, day 4) —
 * three logged days shouldn't sit in the corner of a month-wide frame.
 * Pacific, the same UTC-7 shift the hour grid uses, so "today" flips when the
 * rowers' day does. */
export function daysElapsed(atMs = nowMs()): number {
  const west = new Date(atMs - 7 * 3_600_000).toISOString().slice(0, 10);
  if (west < FIRST_DAY) return 1;
  if (west > LAST_DAY) return MONTH_DAYS;
  return Math.min(MONTH_DAYS, Math.max(1, Number(west.slice(8, 10))));
}

/* Which day numbers get an x-axis label for a chart `days` wide. Keeps the
 * familiar 1/10/20/30 once the month is long enough, and just counts up
 * while it is short. */
export function dayTicks(days: number): number[] {
  if (days <= 1) return [1];
  if (days <= 8) return Array.from({ length: days }, (_, i) => i + 1);
  if (days <= 16) return [...new Set([1, Math.round(days / 2), days])];
  return [...new Set([1, 10, 20, days].filter((d) => d <= days))];
}

/* Entry bounds. The split sanity check (seconds per 500m) catches swapped
 * fields and typo'd units: 60s/500m is faster than the world record, 900s
 * is slower than a drifting boat. No lower meters bound (owner call, day 2)
 * — every meter counts, however few. */
export const METERS_MIN = 1;
export const METERS_MAX = 120_000;
/* No lower time bound either (owner call, day 2) — 1s keeps zero/negative out. */
export const SECONDS_MIN = 1;
export const SECONDS_MAX = 86_400;
export const SPLIT_MIN = 60;
export const SPLIT_MAX = 900;
export const NOTE_MAX = 200;
/* Session titles ("Sunrise 10k before work") — short, they render everywhere. */
export const TITLE_MAX = 60;
export const MAX_ENTRIES_PER_DAY = 10;
export const MAX_ENTRIES_TOTAL = 400;

/* Record boards: any piece at least the distance qualifies for the 1k/5k/10k
 * board, timed at its average pace pro-rated to the exact distance. Rowing a
 * 10k and having no 5k time reads as broken, and a pro-rated time can't beat
 * a real one anyway — nobody holds 5k pace for 10k — so true test pieces
 * still own the top of the board. Anything beyond the tolerance below is
 * labelled with the row it came out of, so a pro-rated time is never passed
 * off as a tested one. */
export const RECORD_DISTANCES = [5000, 10000] as const;
export const RECORD_TOLERANCE = 1.02;

/* Two boards only — men's and women's (owner call, 2026-08-09). */
export type Division = "M" | "F";

export function parseDivision(v: unknown): Division | null {
  return v === "M" || v === "F" ? v : null;
}

export function parseDisplayName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim().slice(0, 40);
  return name.length >= 2 ? name : null;
}

/* Instagram handle. Accepts with or without the "@", stores without it.
 * IG allows letters, digits, dots, underscores, ≤30. Null means a handle
 * was typed and it is not one — for "no handle at all" see the optional
 * form below, which is what the join and race-day doors use now. */
export function parseInstagram(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const handle = v.trim().replace(/^@+/, "").replace(/\/+$/, "");
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/* THE HANDLE IS OPTIONAL (owner, 2026-09-24: "let users register without
 * an Instagram handle"). Absent, blank, or a lone "@" is "" — no handle,
 * stored as the empty string the column defaults to. A non-blank value
 * must still be a real handle: null means it is not, so the caller can
 * say so rather than quietly dropping what they typed. */
export function parseInstagramOptional(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const raw = v.trim().replace(/^@+/, "");
  if (raw === "") return "";
  return parseInstagram(raw);
}

/* ------------------------------------------------------------- about you */

/* BIRTHDAY (owner, 2026-09-24: "collect their birthday — we don't have to
 * display it anywhere right now"). A date-only value: the form sends
 * "YYYY-MM-DD", the column holds that day at UTC midnight, and nothing
 * ever reads the time part. The sanity range is an AGE, not a year, so it
 * needs no yearly edit; "at least 10, at most 100" is the owner's shape of
 * "a real person rowing", wide enough never to turn a real rower away. */
export const AGE_MIN = 10;
export const AGE_MAX = 100;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/* Whole years between a birthday and an instant, both read as UTC calendar
 * days — the same arithmetic a person does with two dates, never a divide
 * by 365.25 that puts someone born on a leap day a year out. */
export function ageOn(birthday: Date, atMs: number): number {
  const at = new Date(atMs);
  let years = at.getUTCFullYear() - birthday.getUTCFullYear();
  const beforeThisYearsBirthday =
    at.getUTCMonth() < birthday.getUTCMonth() ||
    (at.getUTCMonth() === birthday.getUTCMonth() && at.getUTCDate() < birthday.getUTCDate());
  if (beforeThisYearsBirthday) years -= 1;
  return years;
}

export type BirthdayCheck = { ok: true; value: Date } | { ok: false; error: string };

/* "YYYY-MM-DD" → the Date to store, or why not. A real calendar date only
 * (Date.UTC would happily roll Feb 30 into March, so the parts are read
 * back and compared), then the age band above against the injected clock. */
export function parseBirthday(v: unknown, atMs: number = Date.now()): BirthdayCheck {
  if (typeof v !== "string") return { ok: false, error: "Add your birthday." };
  const m = DATE_ONLY.exec(v.trim());
  if (!m) return { ok: false, error: "Add your birthday as a full date." };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const real = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  if (!real) return { ok: false, error: "That is not a real date." };
  const age = ageOn(date, atMs);
  if (age < AGE_MIN) return { ok: false, error: `You need to be at least ${AGE_MIN} to join.` };
  if (age > AGE_MAX) return { ok: false, error: "Check the year on your birthday." };
  return { ok: true, value: date };
}

/* The stored value back into what a date input wants. */
export function birthdayInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/* The bounds a date input gets, so the picker itself stops at the band
 * (the server checks again — this is the form being helpful, not the
 * rule). */
export function birthdayBounds(atMs: number = Date.now()): { min: string; max: string } {
  const at = new Date(atMs);
  const shift = (years: number) =>
    new Date(Date.UTC(at.getUTCFullYear() - years, at.getUTCMonth(), at.getUTCDate())).toISOString().slice(0, 10);
  return { min: shift(AGE_MAX), max: shift(AGE_MIN) };
}

/* HEIGHT AND WEIGHT, optional, metric in the column (owner, 2026-09-24:
 * "height and weight optional, in the settings page"). The rower types
 * whatever they know — "180", "180 cm", "1.80 m", "5'11", "5 ft 11 in",
 * "71 in"; "75", "75 kg", "165 lb" — and these read it into cm and kg.
 * Null means it could not be read; the EMPTY string is the caller's to
 * handle (it means "clear", not "unreadable"). The bands are sanity, not
 * policy: wide enough for any adult who rows, tight enough to catch a
 * value typed in the wrong box. */
export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;
export const WEIGHT_KG_MIN = 30;
export const WEIGHT_KG_MAX = 250;

const num = (s: string): number => Number(s.replace(",", "."));

export function parseHeightCm(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? checkHeight(v) : null;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  // 5'11, 5' 11", 5ft 11in, 5 ft 11, 5 feet 11 inches, 6' (no inches)
  const ftIn = /^(\d{1,2})\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|''|in|inch|inches)?)?$/.exec(t);
  if (ftIn) return checkHeight((num(ftIn[1]) * 12 + (ftIn[2] ? num(ftIn[2]) : 0)) * 2.54);
  // 71 in / 71"
  const inches = /^(\d{1,3}(?:\.\d+)?)\s*(?:"|in|inch|inches)$/.exec(t);
  if (inches) return checkHeight(num(inches[1]) * 2.54);
  // 1.80 m / 1,80m
  const metres = /^(\d(?:[.,]\d{1,2})?)\s*m$/.exec(t);
  if (metres) return checkHeight(num(metres[1]) * 100);
  // 180 / 180 cm / 180.5cm
  const cm = /^(\d{2,3}(?:[.,]\d+)?)\s*(?:cm)?$/.exec(t);
  if (cm) return checkHeight(num(cm[1]));
  return null;
}

function checkHeight(cm: number): number | null {
  const r = Math.round(cm);
  return r >= HEIGHT_CM_MIN && r <= HEIGHT_CM_MAX ? r : null;
}

export function parseWeightKg(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? checkWeight(v) : null;
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  // 165 lb / 165lbs / 165 pounds
  const lb = /^(\d{2,3}(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pounds)$/.exec(t);
  if (lb) return checkWeight(num(lb[1]) * 0.45359237);
  // 12 st 4 / 12st 4lb
  const stone = /^(\d{1,2})\s*(?:st|stone)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:lb|lbs)?)?$/.exec(t);
  if (stone) return checkWeight((num(stone[1]) * 14 + (stone[2] ? num(stone[2]) : 0)) * 0.45359237);
  // 75 / 75 kg / 75.5kg
  const kg = /^(\d{2,3}(?:[.,]\d+)?)\s*(?:kg|kgs|kilo|kilos)?$/.exec(t);
  if (kg) return checkWeight(num(kg[1]));
  return null;
}

function checkWeight(kg: number): number | null {
  const r = Math.round(kg * 10) / 10;
  return r >= WEIGHT_KG_MIN && r <= WEIGHT_KG_MAX ? r : null;
}

/* What the settings inputs show for a stored value — metric, plainly. */
export function fmtHeightCm(cm: number | null | undefined): string {
  return cm == null ? "" : `${cm} cm`;
}
export function fmtWeightKg(kg: number | null | undefined): string {
  return kg == null ? "" : `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

/* ---------------------------------------------------------------- entries */

export type EntryInput = { day: string; meters: number; seconds: number; note: string; title: string };

export type EntryCheck =
  | { ok: true; value: EntryInput }
  | { ok: false; error: string };

/* The challenge day an instant falls on: Pacific, by the same UTC-7 shift
 * the charts and the hour grid use. The form defaults to it, its date picker
 * stops at it, and validateEntry refuses anything past it — one clock, so
 * the three can never disagree about what "today" is. */
export function pacificDay(atMs: number): string {
  return new Date(atMs - 7 * 3_600_000).toISOString().slice(0, 10);
}

/* Any day string pulled into the September window. */
export function clampDay(day: string): string {
  return day < FIRST_DAY ? FIRST_DAY : day > LAST_DAY ? LAST_DAY : day;
}

/* Validate a raw submission. The clock is injected for testability.
 * `admin` lifts only the TIMING gates — the window-closed check and the
 * can't-log-the-future check — so challenge admins can submit test rows
 * before Sep 1 (and moderate after close). Day bounds (Sep 1–30) and every
 * physical check (meters, time, split sanity) still apply to everyone. */
export function validateEntry(
  body: Record<string, unknown>,
  atMs: number,
  opts?: { admin?: boolean },
): EntryCheck {
  const admin = opts?.admin === true;
  if (!admin && atMs >= LOG_CLOSE_MS) {
    return { ok: false, error: `Logging for ${MONTH.label} has closed.` };
  }

  const day = typeof body.day === "string" ? body.day.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "Pick the day you rowed." };
  }
  /* This month, or LAST month inside its grace days (owner, 2026-09-24:
   * the months run on; a row from the 30th logged on the 1st is still
   * last month's row). */
  const prev = prevMonth(MONTH);
  const inThis = day >= FIRST_DAY && day <= LAST_DAY;
  const inPrev = prev.key >= FIRST_MONTH_KEY && day >= prev.firstDay && day <= prev.lastDay && atMs < prev.logCloseMs;
  if (!inThis && !inPrev) {
    return { ok: false, error: `That day is outside ${MONTH.label} — log a row from this month.` };
  }
  // Past days are fine, the future is not (owner call, 2026-09-05): today
  // means the Pacific day, which is what the form offers as its latest
  // pick. The old UTC+1 slack let a Californian evening log tomorrow.
  if (!admin && day > pacificDay(atMs)) {
    return { ok: false, error: "You can't log a row you haven't rowed yet." };
  }

  const meters = typeof body.meters === "number" ? Math.round(body.meters) : NaN;
  if (!Number.isFinite(meters) || meters < METERS_MIN || meters > METERS_MAX) {
    return {
      ok: false,
      error: `Meters should be between ${METERS_MIN.toLocaleString()} and ${METERS_MAX.toLocaleString()}.`,
    };
  }

  const seconds = typeof body.seconds === "number" ? Math.round(body.seconds) : NaN;
  if (!Number.isFinite(seconds) || seconds < SECONDS_MIN || seconds > SECONDS_MAX) {
    return { ok: false, error: "That time doesn't look right — use hours:minutes:seconds." };
  }

  const split = splitSeconds(meters, seconds);
  if (split < SPLIT_MIN) {
    return { ok: false, error: "That pace is faster than the world record — double-check meters and time." };
  }
  if (split > SPLIT_MAX) {
    return { ok: false, error: "That pace looks off (slower than a drifting boat) — double-check meters and time." };
  }

  const note = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) : "";
  const title =
    typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX) : "";

  return { ok: true, value: { day, meters, seconds, note, title } };
}

/* ------------------------------------------------------------- plausibility */

/* The "did you mean that?" band (owner call, 2026-09-05): the hard limits
 * above only stop the physically impossible, so a fat-fingered 1:32 split
 * sails through them. This band is drawn from the rows actually logged —
 * split between the 2nd and 98th percentile, meters under the 99th — and
 * the form asks for a second look outside it. It never blocks; the server
 * keeps its loose hard band. Plain JSON, so it can ride into the client. */
export type SanityBand = {
  /* seconds per 500 m */
  splitLo: number;
  splitHi: number;
  /* meters in one row */
  metersHi: number;
  /* how many rows the band was drawn from; 0 means the fallback below */
  n: number;
};

/* Until twenty rows exist the distribution is nobody's: a handful of early
 * rows would make the band the shape of one person. These are the sane
 * rowing-club numbers instead. */
export const SANITY_MIN_ROWS = 20;
export const SANITY_FALLBACK: SanityBand = { splitLo: 90, splitHi: 200, metersHi: 30_000, n: 0 };

/* Linear interpolation between order statistics (the R-7 / numpy default),
 * on an ASCENDING sorted array. p in [0, 1]. */
function percentile(sorted: number[], p: number): number {
  const last = sorted.length - 1;
  const pos = last * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sanityBand(rows: { meters: number; seconds: number }[]): SanityBand {
  // Junk (zero or negative) would put the band's floor at 0 — drop it, the
  // same way validateEntry never let it in.
  const clean = rows.filter((r) => r.meters > 0 && r.seconds > 0);
  if (clean.length < SANITY_MIN_ROWS) return SANITY_FALLBACK;
  const splits = clean.map((r) => splitSeconds(r.meters, r.seconds)).sort((a, b) => a - b);
  const meters = clean.map((r) => r.meters).sort((a, b) => a - b);
  return {
    splitLo: percentile(splits, 0.02),
    splitHi: percentile(splits, 0.98),
    metersHi: percentile(meters, 0.99),
    n: clean.length,
  };
}

/* ------------------------------------------------------------- formatting */

export function splitSeconds(meters: number, seconds: number): number {
  return seconds / (meters / 500);
}

export function fmtMeters(m: number): string {
  return `${Math.round(m).toLocaleString("en-US")} m`;
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/* "19:42.3" — record-board time with tenths (hours only when needed).
 * Works in integer tenths so float residue can't shave a digit. */
export function fmtRecordTime(totalSeconds: number): string {
  const t = Math.round(totalSeconds * 10);
  const h = Math.floor(t / 36000);
  const m = Math.floor((t % 36000) / 600);
  const s = Math.floor((t % 600) / 10);
  const tenth = t % 10;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}.${tenth}` : `${m}:${pad(s)}.${tenth}`;
}

/* "2:07.4" — average 500m split, the number rowers actually compare. */
export function fmtSplit(meters: number, seconds: number): string {
  const t = Math.round(splitSeconds(meters, seconds) * 10);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${t % 10}`;
}

/* "023" — rower numbers wear leading zeros like a bib. */
export function fmtRowerNumber(n: number): string {
  return String(n).padStart(3, "0");
}

/* "Sep 14" from "2026-09-14" — no Date parsing, no timezone drift. */
export function fmtDay(day: string): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mo = Number(day.slice(5, 7));
  return `${MONTHS[mo - 1] ?? "?"} ${Number(day.slice(8, 10))}`;
}

/* Parse "42:30", "1:02:15", or plain minutes "42" into seconds. Positions
 * after the first must be < 60 — "25:71" is a typo, not 26:11. */
export function parseDurationText(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  let seconds = 0;
  if (nums.length === 1) seconds = nums[0] * 60; // bare number = minutes
  else if (nums.length === 2) seconds = nums[0] * 60 + nums[1];
  else seconds = nums[0] * 3600 + nums[1] * 60 + nums[2];
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

/* ------------------------------------------------------------ leaderboards */

export type ParticipantLite = {
  id: string;
  displayName: string;
  division: string;
  rowerNumber: number;
  instagram: string;
};

export type EntryLite = {
  participantId: string;
  day: string;
  meters: number;
  seconds: number;
};

export type TotalRow = {
  participantId: string;
  name: string;
  division: string;
  rowerNumber: number;
  instagram: string;
  meters: number;
  sessions: number;
  /* Time on the erg, all sessions — the board turns it into a pace tag past
   * PACE_TAG_FROM. Zeroed on a masked row (blackoutRules.ts). */
  seconds: number;
  days: number;
  pct: number; // toward GOAL_METERS, uncapped (110% shows as 110)
  /* Places moved since the latest logged day landed (+2 = up two), on the
   * EVERYONE board. Division-filtered views must not show this raw — they
   * derive their own movement from prevRank (see Boards.tsx), otherwise a
   * man logging reads as every woman dropping a place. */
  delta: number;
  /* This rower's index on the EVERYONE board before the latest logged day.
   * Relative order within any division subset is preserved, so a filtered
   * board can rebuild its own before/after movement from just this. */
  prevRank: number;
  /* Blackout (see blackoutRules.ts): set only on a public view while a
   * window is open and this rower sits in THE ELITE. Then `meters`
   * and `pct` are the FLOOR of the tier reached, not the real total, and
   * `digits` is how many digits the real total has — enough for the board
   * to draw blocks of the right length, nothing more. Optional so the raw
   * board, EMPTY_BOARDS and the preview mocks are unchanged. */
  masked?: boolean;
  digits?: number;
  /* Blackout run-up (blackoutRules.rampRow): how many of the low digits
   * of this total are covered right now, 1 = the ones, 2 = the tens as
   * well, and so on. While it is set, `meters` has been rounded DOWN to
   * the digits still showing, so the number in the row IS what the page
   * may print — the hidden ones are gone, not merely undrawn. The window
   * itself replaces all of them (`masked`). */
  hideLow?: number;
  /* Blackout: the rower's average split, "2:07", to the second — the one
   * number of theirs that stays public while they are hidden (owner,
   * 2026-09-05 late: rank the elite by average pace and print it where
   * the club tag goes). A ratio of two hidden numbers gives neither away.
   * Computed in blackoutRules.maskBoards, from values that never ship. */
  paceTag?: string;
  /* Blackout, the ranking half (owner, 2026-09-05 evening): one of the
   * hidden elite has NO place anywhere — not on the board, not on a
   * sticker, not on their own profile — because knowing you are third and
   * not fourth is the number by another route. maskBoards sets this on all
   * of the elite (the viewer's own row included, which keeps its real meters)
   * and lists them by digit count, then name. */
  unranked?: true;
};

export type RecordRow = {
  participantId: string;
  name: string;
  division: string;
  rowerNumber: number;
  instagram: string;
  /* fastest boards: normalized seconds; longest/bigDay: meters */
  value: number;
  day: string;
  /* fastest boards only: the actual meters of the qualifying piece */
  meters?: number;
  /* fastest boards only: the piece was longer than the board's distance, so
   * this time is a pace conversion rather than a rowed one */
  prorated?: boolean;
};

export type Boards = {
  total: TotalRow[];
  fastest: Record<(typeof RECORD_DISTANCES)[number], RecordRow[]>;
  longest: RecordRow[];
  bigDay: RecordRow[];
  /* Community cumulative meters per logged day, ascending — the curve. */
  daily: { day: string; cum: number }[];
  community: CommunityStats & {
    /* The same four figures per board (owner call, 2026-09-05: the strip
     * above the table follows the Everyone / Men's / Women's tab). */
    divisions: Record<Division, CommunityStats>;
  };
};

export function computeBoards(
  participants: ParticipantLite[],
  entries: EntryLite[],
  /* The challenge day for the "today" figures — Pacific, like every chart. */
  today: string = pacificDay(nowMs()),
): Boards {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const perParticipant = new Map<string, EntryLite[]>();
  for (const e of entries) {
    if (!byId.has(e.participantId)) continue;
    const list = perParticipant.get(e.participantId);
    if (list) list.push(e);
    else perParticipant.set(e.participantId, [e]);
  }

  const total: TotalRow[] = participants.map((p) => {
    const list = perParticipant.get(p.id) ?? [];
    const meters = list.reduce((s, e) => s + e.meters, 0);
    const days = new Set(list.map((e) => e.day)).size;
    return {
      participantId: p.id,
      name: p.displayName,
      division: p.division,
      rowerNumber: p.rowerNumber,
      instagram: p.instagram,
      meters,
      sessions: list.length,
      seconds: list.reduce((s, e) => s + e.seconds, 0),
      days,
      pct: Math.round((meters / GOAL_METERS) * 100),
      delta: 0,
      prevRank: 0,
    };
  });
  total.sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name));
  total.forEach((r, i) => {
    r.prevRank = i; // no movement until a previous day exists to compare to
  });

  // Movement: compare against the standings as they were before the most
  // recent logged day's rows landed. Derived purely from the data — no rank
  // history table needed.
  let lastDay = "";
  for (const e of entries) if (byId.has(e.participantId) && e.day > lastDay) lastDay = e.day;
  if (lastDay) {
    const prevMeters = new Map<string, number>(participants.map((p) => [p.id, 0]));
    for (const e of entries) {
      if (!byId.has(e.participantId) || e.day === lastDay) continue;
      prevMeters.set(e.participantId, (prevMeters.get(e.participantId) ?? 0) + e.meters);
    }
    const prevOrder = participants
      .map((p) => ({ id: p.id, name: p.displayName, meters: prevMeters.get(p.id) ?? 0 }))
      .sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name));
    const prevRank = new Map(prevOrder.map((r, i) => [r.id, i]));
    total.forEach((r, i) => {
      r.prevRank = prevRank.get(r.participantId) ?? i;
      r.delta = r.prevRank - i;
    });
  }

  const fastest = {} as Boards["fastest"];
  for (const dist of RECORD_DISTANCES) {
    const rows: RecordRow[] = [];
    for (const p of participants) {
      const list = perParticipant.get(p.id) ?? [];
      let best: RecordRow | null = null;
      for (const e of list) {
        if (e.meters < dist) continue;
        const normalized = Math.round(e.seconds * (dist / e.meters) * 10) / 10;
        if (!best || normalized < best.value) {
          best = {
            participantId: p.id,
            name: p.displayName,
            division: p.division,
            rowerNumber: p.rowerNumber,
            instagram: p.instagram,
            value: normalized,
            day: e.day,
            meters: e.meters,
            prorated: e.meters > Math.round(dist * RECORD_TOLERANCE),
          };
        }
      }
      if (best) rows.push(best);
    }
    rows.sort((a, b) => a.value - b.value || a.name.localeCompare(b.name));
    fastest[dist] = rows;
  }

  const longest: RecordRow[] = [];
  for (const p of participants) {
    const list = perParticipant.get(p.id) ?? [];
    let best: EntryLite | null = null;
    for (const e of list) if (!best || e.meters > best.meters) best = e;
    if (best) {
      longest.push({
        participantId: p.id,
        name: p.displayName,
        division: p.division,
        rowerNumber: p.rowerNumber,
        instagram: p.instagram,
        value: best.meters,
        day: best.day,
      });
    }
  }
  longest.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const bigDay: RecordRow[] = [];
  for (const p of participants) {
    const list = perParticipant.get(p.id) ?? [];
    const byDay = new Map<string, number>();
    for (const e of list) byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.meters);
    let bestDay: string | null = null;
    let bestMeters = 0;
    for (const [day, m] of byDay) {
      if (m > bestMeters) {
        bestMeters = m;
        bestDay = day;
      }
    }
    if (bestDay) {
      bigDay.push({
        participantId: p.id,
        name: p.displayName,
        division: p.division,
        rowerNumber: p.rowerNumber,
        instagram: p.instagram,
        value: bestMeters,
        day: bestDay,
      });
    }
  }
  bigDay.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const dayTotals = new Map<string, number>();
  for (const e of entries) {
    if (!byId.has(e.participantId)) continue;
    dayTotals.set(e.day, (dayTotals.get(e.day) ?? 0) + e.meters);
  }
  let cum = 0;
  const daily = [...dayTotals.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, m]) => {
      cum += m;
      return { day, cum };
    });

  const known = entries.filter((e) => byId.has(e.participantId));
  const stats = (rows: TotalRow[], people: number, ents: EntryLite[]): CommunityStats => ({
    meters: rows.reduce((s, r) => s + r.meters, 0),
    people,
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
    finished: rows.filter((r) => r.meters >= GOAL_METERS).length,
    seconds: ents.reduce((s, e) => s + e.seconds, 0),
    todayMeters: ents.reduce((s, e) => (e.day === today ? s + e.meters : s), 0),
    todaySeconds: ents.reduce((s, e) => (e.day === today ? s + e.seconds : s), 0),
  });
  const forDivision = (d: Division) =>
    stats(
      total.filter((r) => r.division === d),
      participants.filter((p) => p.division === d).length,
      known.filter((e) => byId.get(e.participantId)?.division === d),
    );
  return {
    total,
    fastest,
    longest,
    bigDay,
    daily,
    community: {
      ...stats(total, participants.length, known),
      divisions: { M: forDivision("M"), F: forDivision("F") },
    },
  };
}

/* The figures at the top of a board (the newspaper head, owner call
 * 2026-09-05): meters, rowers, sessions, finishers, time on the erg, and
 * what landed today. */
export type CommunityStats = {
  meters: number;
  people: number;
  sessions: number;
  finished: number;
  seconds: number;
  todayMeters: number;
  todaySeconds: number;
};

/* ------------------------------------------------------------------ tiers */

/* Progress tiers, styled like item rarity. A tier is visible on the boards
 * once anyone has reached the tier below it — reaching 100k reveals an empty
 * 250k section — so the ladder always shows one rung of ambition and never
 * a whole column of empty boxes. */
/* `rarity` keys the color treatment only — the words never render (owner
 * call, cycle 2). `title` is what the board sections say. The top rung is
 * ".25M", not "250K Legend" — the owner does not like the word legend, and
 * the tier's name and threshold stay behind blackout blocks on the board
 * until somebody actually reaches it (the rarity key `legend` survives as a
 * CSS class name only). */
/* Pace as identity (owner, 2026-09-05: "like how people say they are a
 * 2:xx marathoner"). Past this many meters the board swaps a rower's club
 * tag for their average split, to the second — nowhere else. */
export const PACE_TAG_FROM = 500_000;

/* "2:07" — the average split over everything rowed, rounded to the second. */
export function fmtPaceTag(meters: number, seconds: number): string {
  // FLOORED, never rounded (owner, 2026-09-08): 2:07.6 wears 2:07 on the
  // board and the tag — a split is a time, and a time is not rounded up.
  const split = Math.floor(seconds / (meters / 500));
  const m = Math.floor(split / 60);
  const s = split % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const TIERS = [
  { meters: 10_000, key: "t10", label: "10K", rarity: "common", title: "Rowtember Participant" },
  { meters: 50_000, key: "t50", label: "50K", rarity: "rare", title: "Rowtember Athlete" },
  { meters: 100_000, key: "t100", label: "100K", rarity: "epic", title: "The 100K Club" },
  { meters: 250_000, key: "t250", label: ".25M", rarity: "legend", title: ".25M" },
  /* ELITE, the top rung (owner, 2026-09-11). It lands exactly on
   * PACE_TAG_FROM, which is the point: past 500,000 m the board has always
   * swapped the club tag for the average split, and now the section says
   * what that makes you. NOT censored — the owner was explicit on the
   * second telling: "if you just have five hundred k or above, it is not
   * necessarily censored ... but your title, your little tag should be your
   * average pace". Only a blackout hides numbers, and only the top N of
   * each board or the top N overall, as the policy says (rowSettings.ts).
   * The name is shared with the blackout's THE ELITE on
   * purpose (owner, same message: "the sharing of the name is
   * intentional") — both are the rowers you know by their pace.
   *
   * `label` and `rarity` are nearly dead weight here: a rower at this rung
   * is past PACE_TAG_FROM, so Boards.tsx draws their split instead of the
   * tier label. They are the fallback for the one rower who reaches 500k
   * without a single timed row to average. */
  { meters: 500_000, key: "t500", label: "LIGHTS OUT", rarity: "elite", title: "Lights out" },
] as const;
export type Tier = (typeof TIERS)[number];

/* Highest tier this many meters has reached, or null below 10k. */
export function tierFor(meters: number): Tier | null {
  let hit: Tier | null = null;
  for (const t of TIERS) if (meters >= t.meters) hit = t;
  return hit;
}

/* The tiers the boards should show for a field whose best rower has
 * maxMeters: every tier reached, plus the next locked one. Before anyone
 * reaches 10k that's just the (locked) 10k tier itself. */
export function visibleTiers(maxMeters: number): Tier[] {
  const reached = TIERS.filter((t) => maxMeters >= t.meters);
  const next = TIERS.find((t) => maxMeters < t.meters);
  return next ? [...reached, next] : [...reached];
}

/* The next rung above this many meters, or null past the top. Nobody is
 * told its name or threshold ahead of time (owner call, 2026-09-05: you
 * just have to row until you get it) — callers hide both behind blocks. */
export function nextTierFor(meters: number): Tier | null {
  return TIERS.find((t) => meters < t.meters) ?? null;
}

/* The floor of the tier this many meters sits in — what a blacked-out row
 * shows instead of its real total, so tier sectioning still works while
 * the number itself stays hidden. 0 below 10k. */
export function tierFloor(meters: number): number {
  return tierFor(meters)?.meters ?? 0;
}

/* ----------------------------------------------------------------- weeks */

/* The month's weeks, cut on calendar sevens from the 1st (the short last
 * one is the finish). Day strings in, so timezone can't shift a row's
 * week. */
export const WEEKS: PeriodWeek[] = weeksOf(MONTH);
export type Week = PeriodWeek;

export function weekIndexOf(day: string): number {
  return WEEKS.findIndex((w) => day >= w.first && day <= w.last);
}

export type WeeklyRow = {
  participantId: string;
  name: string;
  division: string;
  rowerNumber: number;
  instagram: string;
  meters: number;
  sessions: number;
};

/* One ranked board per challenge week — total meters inside that week.
 * Takes only the fields it reads, so callers can select a narrower row. */
export function computeWeekly(
  participants: ParticipantLite[],
  entries: Pick<EntryLite, "participantId" | "day" | "meters">[],
  /* The weeks to file into — this month's unless a page asks for another
   * month's (rowPeriod.ts weeksOf). */
  weekDefs: PeriodWeek[] = WEEKS,
): WeeklyRow[][] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const weeks: Map<string, WeeklyRow>[] = weekDefs.map(() => new Map());
  for (const e of entries) {
    const p = byId.get(e.participantId);
    if (!p) continue;
    const wi = weekDefs.findIndex((w) => e.day >= w.first && e.day <= w.last);
    if (wi === -1) continue;
    const m = weeks[wi];
    const row = m.get(p.id) ?? {
      participantId: p.id,
      name: p.displayName,
      division: p.division,
      rowerNumber: p.rowerNumber,
      instagram: p.instagram,
      meters: 0,
      sessions: 0,
    };
    row.meters += e.meters;
    row.sessions += 1;
    m.set(p.id, row);
  }
  return weeks.map((m) =>
    [...m.values()].sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name)),
  );
}

/* One ranked board per challenge day — total meters inside that day.
 * Index i is Sep (i+1); days outside September are ignored (validateEntry
 * bounds every logged day anyway, this is belt and braces). */
export function computeDaily(
  participants: ParticipantLite[],
  entries: Pick<EntryLite, "participantId" | "day" | "meters">[],
  /* The month to file into — this one unless a page asks for another. */
  monthDef: { key: string; days: number } = MONTH,
): WeeklyRow[][] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  const month = monthDef.key;
  const days: Map<string, WeeklyRow>[] = Array.from({ length: monthDef.days }, () => new Map());
  for (const e of entries) {
    if (e.day.slice(0, 7) !== month) continue;
    const di = Number(e.day.slice(8, 10)) - 1;
    if (di < 0 || di >= days.length) continue;
    const p = byId.get(e.participantId);
    if (!p) continue;
    const m = days[di];
    const row = m.get(p.id) ?? {
      participantId: p.id,
      name: p.displayName,
      division: p.division,
      rowerNumber: p.rowerNumber,
      instagram: p.instagram,
      meters: 0,
      sessions: 0,
    };
    row.meters += e.meters;
    row.sessions += 1;
    m.set(p.id, row);
  }
  return days.map((m) =>
    [...m.values()].sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name)),
  );
}

/* ------------------------------------------------------------ placements */

export type RecordBadge = {
  /* stable id: "total" | "fastest5000" | "fastest10000" | "longest" | "bigday" */
  key: string;
  /* "Fastest 5k" — display label */
  label: string;
  /* 1..topN, within the rower's division (every record surface shows the
   * boards split men's/women's, so placements match what the pages say) */
  place: number;
  /* The stat itself, display-formatted: "16:03.7" or "22,179 m". */
  value: string;
};

const RECORD_LABELS: Record<string, string> = {
  total: "Total meters",
  fastest5000: "Fastest 5k",
  fastest10000: "Fastest 10k",
  longest: "Longest row",
  bigday: "Biggest day",
};

export function recordLabel(key: string): string {
  return RECORD_LABELS[key] ?? key;
}

/* Where this rower places, within their division, on every record board.
 * Only placements 1..topN come back — an empty array means no records. */
export function recordPlacements(boards: Boards, participantId: string, topN = 3): RecordBadge[] {
  const out: RecordBadge[] = [];
  const me =
    boards.total.find((r) => r.participantId === participantId) ?? null;
  if (!me) return out;
  const inDivision = <T extends { division: string }>(rows: T[]) =>
    rows.filter((r) => r.division === me.division);

  const check = (
    key: string,
    rows: { participantId: string }[],
    valueOf: (row: never) => string,
  ) => {
    const place = rows.findIndex((r) => r.participantId === participantId) + 1;
    if (place >= 1 && place <= topN) {
      const row = rows[place - 1] as never;
      out.push({ key, label: recordLabel(key), place, value: valueOf(row) });
    }
  };

  // A masked row (blackout) may carry a floor of 0 while its real total is
  // well above it; it stays on the board so nobody below shifts up. One of
  // the hidden elite has no total-meters placement at all (unranked): the
  // other records keep theirs, a fastest-5k place is not the total rank.
  if (!me.unranked) {
    check("total", inDivision(boards.total.filter((r) => r.meters > 0 || r.masked)), (r: TotalRow) =>
      fmtMeters(r.meters),
    );
  }
  for (const dist of RECORD_DISTANCES)
    check(`fastest${dist}`, inDivision(boards.fastest[dist]), (r: RecordRow) =>
      fmtRecordTime(r.value),
    );
  check("longest", inDivision(boards.longest), (r: RecordRow) => fmtMeters(r.value));
  check("bigday", inDivision(boards.bigDay), (r: RecordRow) => fmtMeters(r.value));
  return out;
}

/* This rower's standing on total meters within their division —
 * { place: 3, of: 41 }, or null before they've logged a meter. */
export function divisionRank(
  boards: Boards,
  participantId: string,
): { place: number; of: number } | null {
  const me = boards.total.find((r) => r.participantId === participantId);
  if (!me || (me.meters <= 0 && !me.masked)) return null;
  // One of the hidden elite has no rank, to anyone (blackoutRules.ts):
  // the profile prints a dash and the share cards draw no place.
  if (me.unranked) return null;
  // Masked (blackout) rows keep their place even when their floor is 0.
  const rows = boards.total.filter(
    (r) => r.division === me.division && (r.meters > 0 || r.masked),
  );
  const place = rows.findIndex((r) => r.participantId === participantId) + 1;
  return place >= 1 ? { place, of: rows.length } : null;
}
