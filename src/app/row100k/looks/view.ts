/* What the five landing looks render (looks/*.tsx) and the pure helpers
 * that shape it. No db, no server-only imports: looksData.ts computes
 * everything on the server and the look components — client ones for the
 * lightbox, the SHOW MORE and the wall — only lay it out. Every figure in
 * here is either an aggregate or a string the loader already blanked for a
 * masked rower, so no hidden number reaches the browser (the feed's
 * view.ts is the model). */

export type LookKey = "a" | "b" | "c" | "d" | "e";

export const LOOK_KEYS: LookKey[] = ["a", "b", "c", "d", "e"];

export function parseLook(q: string | string[] | undefined): LookKey | null {
  const v = typeof q === "string" ? q.toLowerCase() : "";
  return (LOOK_KEYS as string[]).includes(v) ? (v as LookKey) : null;
}

/* One photo, the feed's shape: the CDN full frame plus its thumb (demo
 * colour squares are their own thumb). */
export type LookPhoto = { full: string; thumb: string | null };

/* One row by a followed rower, as a stream card prints it. */
export type LookRow = {
  id: string;
  participantId: string;
  rowerNumber: number;
  /* "023" */
  numStr: string;
  name: string;
  /* "2026-12-14" — the day the rower said they rowed it, and "DEC 14". */
  dayKey: string;
  dayStr: string;
  /* the exact UTC instant it landed, for the title attribute */
  absIso: string;
  title: string;
  /* "" on a masked row (blackoutRules.ts: the meters and the time of one
   * of the elite are hidden; the split stays real, the pace being the one
   * figure of theirs that is public — owner, 2026-09-08). */
  metersStr: string;
  durationStr: string;
  splitStr: string;
  /* The rower photo first, then the erg screen; empty for a masked row
   * (their photos never leave the server) or a row without any. */
  photos: LookPhoto[];
  masked?: boolean;
  digits?: number;
  /* True when the board itself hid the rower (they wear the LIGHTS OUT
   * mark); a masked row without it was hidden by the fail-closed rule. */
  elite?: boolean;
  /* Rowed today (Pacific). */
  today: boolean;
};

/* One followed rower on the friends board and the moved-today table. */
export type LookFriend = {
  participantId: string;
  rowerNumber: number;
  numStr: string;
  name: string;
  division: string;
  /* This month, as the viewer may see it: the real total, or the tier
   * floor while masked (the board row as boardView handed it over). */
  meters: number;
  masked?: boolean;
  digits?: number;
  /* The elite carry no place while a window is open. */
  unranked?: boolean;
  /* Today: how many rows and how many meters landed — the meters 0 on a
   * masked row (nothing of theirs but the pace is public). */
  todayRows: number;
  todayMeters: number;
  /* The title of their latest row today, for the moved-today table. */
  todayTitle: string;
};

/* This month's fastest 10K in one division, times public whatever the
 * blackout says (owner, 2026-09-08). */
export type LookRecord = {
  division: "M" | "F";
  timeStr: string;
  splitStr: string;
  rowerNumber: number;
  numStr: string;
  name: string;
  dayStr: string;
};

export type LookMe = {
  rowerNumber: number;
  numStr: string;
  name: string;
  metersStr: string;
  hoursStr: string;
  sessions: number;
};

export type LookPayload = {
  look: LookKey;
  /* "December 2026" */
  monthLabel: string;
  /* "DEC 15" */
  todayStr: string;
  me: LookMe;
  /* Everyone the viewer follows, board order (meters, the elite first
   * while hidden), every one of them — the looks cap what they print. */
  friends: LookFriend[];
  /* Their rows this month, newest first, up to STREAM_CAP of them. */
  rows: LookRow[];
  /* True when more rows than STREAM_CAP exist: the stream ends on a link
   * to the feed instead of the last card. */
  rowsCapped: boolean;
  records: { men: LookRecord | null; women: LookRecord | null };
  /* Where the LIGHTS OUT mark links. */
  eliteHref: string;
  /* The board page, where the friends board sends the rest of 400. */
  boardHref: string;
  feedHref: string;
};

/* How many cards the stream shows at once and adds per SHOW MORE, and how
 * many rows the loader sends at all: 400 friends rowing daily is 400 rows
 * a day, and nobody scrolls a month of that — the stream ends on the feed
 * page instead. */
export const STREAM_PAGE = 12;
export const STREAM_CAP = 200;

/* How deep the friends board runs before it links to the board page, and
 * how many rows the moved-today table shows before SEE ALL. */
export const BOARD_CAP = 25;
export const MOVED_TOP = 10;

/* The wall grows by this many tiles each time its foot scrolls into view. */
export const WALL_BATCH = 48;

/* The rows that were rowed today, newest first. */
export function rowsToday(rows: LookRow[]): LookRow[] {
  return rows.filter((r) => r.today);
}

/* The friends who moved today, most meters first (a masked friend, whose
 * meters are 0 here, sorts after everyone with a number but before nobody:
 * they still moved). */
export function movedToday(friends: LookFriend[]): LookFriend[] {
  return friends
    .filter((f) => f.todayRows > 0)
    .sort((a, b) => b.todayMeters - a.todayMeters || b.todayRows - a.todayRows || a.name.localeCompare(b.name));
}
