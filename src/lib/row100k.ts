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
 * platform owner role qualifies, plus these accounts (the second is the
 * owner's personal Google, which deliberately does NOT hold the site-wide
 * owner role). */
const ADMIN_EMAILS = ["mikian.photos@gmail.com", "mikianmusser@gmail.com"];

export function isRow100kAdmin(email: string, roles: string[]): boolean {
  return roles.includes("owner") || ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

/* The window. Days are plain "YYYY-MM-DD" strings (what the participant
 * picked in the date input) — never Date objects, so server timezone can't
 * shift a row onto the wrong day. */
export const FIRST_DAY = "2026-09-01";
export const LAST_DAY = "2026-09-30";
/* Sept 1, 00:00 Pacific — what the countdown ticks toward. */
export const START_MS = Date.UTC(2026, 8, 1, 7, 0, 0);
/* Sept 30, midnight Pacific — when the clock runs out. */
export const END_MS = Date.UTC(2026, 9, 1, 7, 0, 0);
/* Grace: late-logging a September row is allowed through Oct 3 (Pacific). */
export const LOG_CLOSE_MS = Date.UTC(2026, 9, 4, 7, 0, 0);

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

/* Entry bounds. The split sanity check (seconds per 500m) catches swapped
 * fields and typo'd units: 60s/500m is faster than the world record, 900s
 * is slower than a drifting boat. */
export const METERS_MIN = 200;
export const METERS_MAX = 120_000;
export const SECONDS_MIN = 30;
export const SECONDS_MAX = 86_400;
export const SPLIT_MIN = 60;
export const SPLIT_MAX = 900;
export const NOTE_MAX = 200;
export const MAX_ENTRIES_PER_DAY = 10;
export const MAX_ENTRIES_TOTAL = 400;

/* Record boards: any piece at least the distance qualifies for the 1k/5k/10k
 * board, timed at its average pace pro-rated to the exact distance. Rowing a
 * 10k and having no 5k time reads as broken, and a pro-rated time can't beat
 * a real one anyway — nobody holds 5k pace for 10k — so true test pieces
 * still own the top of the board. Anything beyond the tolerance below is
 * labelled with the row it came out of, so a pro-rated time is never passed
 * off as a tested one. */
export const RECORD_DISTANCES = [1000, 5000, 10000] as const;
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

/* Instagram handle, required at join. Accepts with or without the "@",
 * stores without it. IG allows letters, digits, dots, underscores, ≤30. */
export function parseInstagram(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const handle = v.trim().replace(/^@+/, "").replace(/\/+$/, "");
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/* ---------------------------------------------------------------- entries */

export type EntryInput = { day: string; meters: number; seconds: number; note: string };

export type EntryCheck =
  | { ok: true; value: EntryInput }
  | { ok: false; error: string };

function addDaysUTC(ms: number, days: number): string {
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}

/* Validate a raw submission. The clock is injected for testability. */
export function validateEntry(body: Record<string, unknown>, atMs: number): EntryCheck {
  if (atMs >= LOG_CLOSE_MS) {
    return { ok: false, error: "The challenge is closed — logging ended Oct 3." };
  }

  const day = typeof body.day === "string" ? body.day.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, error: "Pick the day you rowed." };
  }
  if (day < FIRST_DAY || day > LAST_DAY) {
    return { ok: false, error: "That day is outside September — the challenge runs Sep 1–30." };
  }
  // Lenient +1 so "today" works from any timezone; blocks pre-logging the future.
  if (day > addDaysUTC(atMs, 1)) {
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

  return { ok: true, value: { day, meters, seconds, note } };
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
  days: number;
  pct: number; // toward GOAL_METERS, uncapped (110% shows as 110)
  /* Places moved since the latest logged day landed (+2 = up two). */
  delta: number;
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
  community: { meters: number; people: number; sessions: number; finished: number };
};

export function computeBoards(participants: ParticipantLite[], entries: EntryLite[]): Boards {
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
      days,
      pct: Math.round((meters / GOAL_METERS) * 100),
      delta: 0,
    };
  });
  total.sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name));

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
      r.delta = (prevRank.get(r.participantId) ?? i) - i;
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

  const communityMeters = total.reduce((s, r) => s + r.meters, 0);
  return {
    total,
    fastest,
    longest,
    bigDay,
    daily,
    community: {
      meters: communityMeters,
      people: participants.length,
      sessions: total.reduce((s, r) => s + r.sessions, 0),
      finished: total.filter((r) => r.meters >= GOAL_METERS).length,
    },
  };
}
