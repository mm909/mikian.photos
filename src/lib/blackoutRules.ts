import {
  GOAL_METERS,
  fmtDay,
  fmtDuration,
  fmtRecordTime,
  tierFloor,
  type Boards,
  type TotalRow,
} from "./row100k";

/* Blackout rules — pure, no db, safe in client components.
 *
 * The owner's call (2026-09-05): while a blackout window is open, the top
 * fifteen on the board — THE ELITE FIFTEEN — do not have their numbers
 * shown to the public. Not a black bar: one fat block per digit, commas in
 * the right places, so you can see it is a six-figure number and where the
 * 100k starts, just not which six figures. Sixteenth and everyone else are
 * always visible. Admins and the rower themself keep the real number.
 *
 * "Their numbers" means every one of them (owner, same day, after the feed
 * was found still printing elite rowers' times): the total, a session's
 * meters, its TIME, its split, and the bests — a time over a known distance
 * is the meters by another route. Names, rower numbers, places, session
 * counts, dates and titles stay. Share cards leave the site, so they draw
 * blocks even in the rower's own dialog.
 *
 * Masking happens on the way OUT of the cached board (boardView), never in
 * computeBoards, so the cached object stays the one source of truth and the
 * admin/self views need no second query. */

export const ELITE_N = 15;
export const ELITE_LABEL = "THE ELITE FIFTEEN";
/* The tag in front of a hidden row's name — where the tier tag would go. */
export const ELITE_TAG = "ELITE 15";

/* How many digits a total has, commas not counted: 123,456 -> 6. Zero is
 * one digit, so a block always draws. */
export function digitCount(n: number): number {
  return String(Math.max(0, Math.round(n))).length;
}

/* The silhouette of a formatted number: every digit becomes a `#` and the
 * commas, colons and points stay where they were — "1:04:01" -> "#:##:##",
 * "22,179 m" -> "##,### m". Plain text, so a page can hand it to a client
 * component in place of the number, which must never get there. */
export function shapeOf(formatted: string): string {
  return formatted.replace(/\d/g, "#");
}

/* The shape of a hidden time: exactly the digits fmtDuration prints (or
 * fmtRecordTime with `tenths`, for the record boards), as blocks with the
 * separators kept — 22:14 -> "##:##", 1:04:01 -> "#:##:##", a record
 * 18:51.0 -> "##:##.#". The shape shows and nothing else. */
export function clockShape(seconds: number, tenths = false): string {
  return shapeOf(tenths ? fmtRecordTime(seconds) : fmtDuration(seconds));
}

export type MaskOpts = {
  active: boolean;
  /* The signed-in viewer's own participant id — their row stays real. */
  viewerParticipantId?: string | null;
  /* Challenge admins see everything. */
  admin?: boolean;
};

/* The rows that are hidden: the first ELITE_N of a standings-ordered list
 * that have any meters at all. Rows already masked count as elite too, so
 * re-masking an already-masked list never slides the cut-off down onto
 * row sixteen (a masked row under 10k carries a floor of 0). */
function eliteIndexes<T extends { meters: number; masked?: boolean }>(rows: T[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < rows.length && out.size < ELITE_N; i++) {
    if (rows[i].meters > 0 || rows[i].masked) out.add(i);
  }
  return out;
}

/* Replace the real total with the floor of the tier it sits in, so client
 * sectioning (tierFor) still files the row under the right heading, and
 * keep only the digit count of the truth. `pct` follows the floor only on
 * rows that carry one (board rows do, sticker rows do not) so a masked row
 * never grows a field its neighbours lack. */
function maskRow<T extends { meters: number; pct?: number }>(r: T): T & { masked: true; digits: number } {
  const floor = tierFloor(r.meters);
  return {
    ...r,
    meters: floor,
    ...("pct" in r ? { pct: Math.round((floor / GOAL_METERS) * 100) } : {}),
    masked: true as const,
    digits: digitCount(r.meters),
  };
}

/* The public board. Rank order is untouched — the hidden rows keep their
 * places, only their numbers go. Returns the same object when nothing needs
 * hiding so the cached board is not copied for nothing. */
export function maskBoards(boards: Boards, opts: MaskOpts): Boards {
  if (!opts.active || opts.admin) return boards;
  const elite = eliteIndexes(boards.total);
  if (elite.size === 0) return boards;
  const total: TotalRow[] = boards.total.map((r, i) => {
    if (!elite.has(i) || r.masked) return r;
    if (opts.viewerParticipantId && r.participantId === opts.viewerParticipantId) return r;
    return maskRow(r);
  });
  return { ...boards, total };
}

/* The share-sticker rows (cards.ts boardCard) carry no participant id, so
 * a viewer, when one is given, is matched by rower number. Same rules
 * otherwise. The board sticker on /row100k passes neither viewer nor admin:
 * it leaves the site, so it hides the fifteen for everybody, the owner and
 * the elite rower included (review, 2026-09-05). */
export type StandingRow = {
  name: string;
  rowerNumber: number;
  meters: number;
  masked?: boolean;
  digits?: number;
};

export function maskStandings(
  rows: StandingRow[],
  opts: { active: boolean; viewerRowerNumber?: number | null; admin?: boolean },
): StandingRow[] {
  if (!opts.active || opts.admin) return rows;
  const elite = eliteIndexes(rows);
  if (elite.size === 0) return rows;
  return rows.map((r, i) => {
    if (!elite.has(i) || r.masked) return r;
    if (opts.viewerRowerNumber != null && r.rowerNumber === opts.viewerRowerNumber) return r;
    return maskRow(r);
  });
}

/* ------------------------------------------------------------- pacific */

/* "Pacific" across the challenge is a fixed UTC-7 shift, never a real time
 * zone (see daysElapsed) — wrong by an hour after DST ends Nov 1, fine for
 * September. Windows are stored as UTC instants; these read and write the
 * admin's wall-clock view of them. */
export const PACIFIC_SHIFT_MS = 7 * 3_600_000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "Sep 27" — the day a window ends, Pacific. */
export function fmtPacificDay(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return fmtDay(new Date(ms - PACIFIC_SHIFT_MS).toISOString().slice(0, 10));
}

/* "Sep 20 · 6:00 PM PT" — how the admin page lists a window edge. */
export function fmtPacificStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const p = new Date(ms - PACIFIC_SHIFT_MS);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(p.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[p.getUTCMonth()]} ${p.getUTCDate()} · ${h}:${min} ${h24 < 12 ? "AM" : "PM"} PT`;
}

/* A datetime-local value ("2026-09-20T18:00") typed as Pacific -> the UTC
 * ISO instant to store, or null when it does not parse. Read as UTC fields
 * then shifted, so the admin's own browser zone never leaks in. */
export function pacificLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  const ms =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) +
    PACIFIC_SHIFT_MS;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/* The reverse: a UTC instant -> the Pacific wall clock a datetime-local
 * input wants, minutes precision. */
export function msToPacificLocal(ms: number): string {
  return new Date(ms - PACIFIC_SHIFT_MS).toISOString().slice(0, 16);
}
