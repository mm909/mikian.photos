import {
  GOAL_METERS,
  fmtDay,
  fmtPaceTag,
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
 * The ranking half (owner, same evening): the fifteen carry no place at
 * all while hidden — not even to themself ("I shouldn't be able to know
 * that I'm number three or number four, I should just know that I'm in the
 * top fifteen"). They are listed by AVERAGE PACE, fastest first (owner,
 * 2026-09-06: "I want that average pace to be there like identity — and in
 * the elite fifteen they're sorted by that pace"), which is a ratio of two
 * numbers that both stay hidden, so the order gives no total away. Rows
 * sixteen and down keep their places, which the reorder never moves.
 *
 * The RUN-UP (owner, 2026-09-06): for the days before a window the fifteen
 * do not go dark at once — they lose one digit a day from the ones up, so
 * 142,500 reads 142,50▮, then 142,5▮▮, then 142,▮▮▮, until the designated
 * day covers all of it. During the run-up the board is otherwise itself:
 * the fifteen keep their places, their movement and their sections, and
 * only the tail of each number is gone (rampRow).
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
  /* The run-up, when no window is open yet: cover this many low digits of
   * the fifteen's totals (blackout.ts works it out from the window's
   * rampDays). Ignored once `active` is true — the window covers all. */
  hideLow?: number;
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
function maskRow<T extends { meters: number; pct?: number; seconds?: number }>(
  r: T,
): T & { masked: true; digits: number } {
  const floor = tierFloor(r.meters);
  return {
    ...r,
    meters: floor,
    ...("pct" in r ? { pct: Math.round((floor / GOAL_METERS) * 100) } : {}),
    // Time on the erg is a number of theirs too (it is the meters by way
    // of a pace); a masked row carries none.
    ...("seconds" in r ? { seconds: 0 } : {}),
    masked: true as const,
    digits: digitCount(r.meters),
  };
}

/* The run-up shape of a total: the digits still showing, then a block for
 * each one covered, with the commas where the number would have them —
 * 142500 with three covered is "142,###", with four "14#,###". Rendered by
 * Blackout.tsx (# is a block, anything else the real glyph) and by
 * share/cards.ts drawBlockShape, so page and sticker agree.
 *
 * `hide` at or above the digit count covers everything, which is what the
 * last day of the run-up does to the shortest total on the board. */
export function partialShape(shown: number, hide: number, digits?: number): string {
  const n = Math.max(1, Math.floor(digits ?? digitCount(shown)));
  const covered = Math.min(Math.max(0, Math.floor(hide)), n);
  const text = String(Math.max(0, Math.round(shown))).padStart(n, "0");
  const cells = text.slice(-n).split("").map((d, i) => (i < n - covered ? d : "#"));
  const out: string[] = [];
  cells.forEach((c, i) => {
    out.push(c);
    const fromRight = n - i - 1;
    if (fromRight > 0 && fromRight % 3 === 0) out.push(",");
  });
  return out.join("");
}

/* Round a total DOWN to the digits still showing, so the covered ones are
 * not in the row at all: 142,500 with three covered becomes 142,000. */
export function roundToShown(meters: number, hide: number): number {
  const n = digitCount(meters);
  const covered = Math.min(Math.max(0, Math.floor(hide)), n);
  if (covered === 0) return Math.max(0, Math.round(meters));
  const step = Math.pow(10, covered);
  return Math.floor(Math.max(0, Math.round(meters)) / step) * step;
}

/* One of the fifteen during the run-up: the low digits leave the row, the
 * rest of it is untouched — place, movement, section, sessions, seconds.
 * `pct` follows the rounded total so the bar cannot give the tail away. */
function rampRow<T extends { meters: number; pct?: number }>(
  r: T,
  hide: number,
): T & { hideLow: number; digits: number } {
  const shown = roundToShown(r.meters, hide);
  const digits = digitCount(r.meters);
  return {
    ...r,
    meters: shown,
    ...("pct" in r ? { pct: Math.round((shown / GOAL_METERS) * 100) } : {}),
    hideLow: Math.min(Math.max(1, Math.floor(hide)), digits),
    digits,
  };
}

/* How many digits a row shows: the real total's count on a masked row
 * (that is what its blocks draw), the total itself otherwise. */
function shownDigits(r: { meters: number; masked?: boolean; digits?: number }): number {
  return r.masked && r.digits != null ? r.digits : digitCount(r.meters);
}

/* "2:07" as seconds, for sorting; a row with no pace sorts last. */
function paceSeconds(tag?: string): number {
  const m = /^(\d+):(\d{2})$/.exec(tag ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.POSITIVE_INFINITY;
}

/* The order of the hidden fifteen: FASTEST AVERAGE SPLIT first (owner,
 * 2026-09-06 — the pace is their identity while the meters are gone, and
 * it is what the section is sorted by), then the name A to Z (case and
 * accents ignored), then the rower number so the order is total. It is not
 * the meters ranking: a split is a ratio of two hidden numbers, so nobody
 * learns from it whether they are third or fourth. Exported for any
 * surface that lists the fifteen on its own. */
export function eliteOrder<T extends { meters: number; name: string; rowerNumber: number; masked?: boolean; digits?: number; paceTag?: string }>(
  a: T,
  b: T,
): number {
  return (
    paceSeconds(a.paceTag) - paceSeconds(b.paceTag) ||
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
    a.rowerNumber - b.rowerNumber
  );
}

/* prevRank — where a rower stood before the latest logged day landed — is a
 * field of the row, and the board is a client component: it travels into the
 * page source of every board page. On a field that moves as little as this
 * one, yesterday's places ARE today's ranking, so leaving the fifteen's own
 * prevRanks attached hands the hidden order to anyone who reads the source
 * (review, 2026-09-05).
 *
 * So: keep the multiset, destroy the mapping. Within a division the fifteen's
 * prevRanks are collected, sorted and dealt back out in eliteOrder. Every row
 * that is NOT hidden keeps exactly the neighbours it had when a board sorts on
 * prevRank — which is how Boards.tsx rebuilds each tab's movement — so no
 * visible arrow changes; and the only order the field now carries for the
 * fifteen is the one already on the screen, digit count then name. */
function dealPrevRanks(fifteen: TotalRow[]): TotalRow[] {
  const pool = new Map<string, number[]>();
  fifteen.forEach((r) => {
    const list = pool.get(r.division);
    if (list) list.push(r.prevRank);
    else pool.set(r.division, [r.prevRank]);
  });
  pool.forEach((list) => list.sort((a, b) => a - b));
  const taken = new Map<string, number>();
  return fifteen.map((r) => {
    const i = taken.get(r.division) ?? 0;
    taken.set(r.division, i + 1);
    return { ...r, prevRank: pool.get(r.division)?.[i] ?? r.prevRank };
  });
}

/* The public board. The hidden fifteen lose their numbers (the viewer's own
 * row keeps its meters) AND their places: all fifteen come back unranked
 * and reordered by eliteOrder, with their movement zeroed (a place moved is
 * a place known). Rows from sixteen down are untouched and still occupy the
 * same indexes, so their places are unchanged. Idempotent: a second pass
 * finds the same fifteen (masked rows count as elite) in the same order.
 * Returns the same object when nothing needs hiding so the cached board is
 * not copied for nothing. */
export function maskBoards(boards: Boards, opts: MaskOpts): Boards {
  if (opts.admin) return boards;
  // The run-up: no window is open yet, so the board keeps its order, its
  // places and its movement — the fifteen simply lose the tail of their
  // totals. Self is exempt here too: a rower always sees their own number.
  if (!opts.active) {
    const hide = Math.floor(opts.hideLow ?? 0);
    if (hide <= 0) return boards;
    const eliteNow = eliteIndexes(boards.total);
    if (eliteNow.size === 0) return boards;
    return {
      ...boards,
      total: boards.total.map((r, i) => {
        if (!eliteNow.has(i) || r.masked || r.hideLow) return r;
        if (opts.viewerParticipantId && r.participantId === opts.viewerParticipantId) return r;
        return rampRow(r, hide);
      }),
    };
  }
  const elite = eliteIndexes(boards.total);
  if (elite.size === 0) return boards;
  const fifteen: TotalRow[] = [];
  const rest: TotalRow[] = [];
  boards.total.forEach((r, i) => {
    if (!elite.has(i)) {
      rest.push(r);
      return;
    }
    const self = !!opts.viewerParticipantId && r.participantId === opts.viewerParticipantId;
    // The pace comes off the row as it arrived — real meters and seconds —
    // and is the only figure of theirs that survives the mask. A second
    // pass over an already-masked board keeps the tag it computed then.
    const paceTag =
      r.paceTag ?? (r.meters > 0 && r.seconds > 0 ? fmtPaceTag(r.meters, r.seconds) : undefined);
    const row = r.masked || self ? r : maskRow(r);
    fifteen.push({ ...row, unranked: true, delta: 0, ...(paceTag ? { paceTag } : {}) });
  });
  fifteen.sort(eliteOrder);
  // Their previous places travel with the row, so they are dealt out again
  // in this order before the board leaves the server (dealPrevRanks).
  return { ...boards, total: [...dealPrevRanks(fifteen), ...rest] };
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
  /* One of the hidden fifteen: no place is drawn for the row. */
  unranked?: boolean;
  /* Their average split, "2:07" — printed where the club tag goes. */
  paceTag?: string;
};

export function maskStandings(
  rows: StandingRow[],
  opts: { active: boolean; viewerRowerNumber?: number | null; admin?: boolean },
): StandingRow[] {
  if (!opts.active || opts.admin) return rows;
  const elite = eliteIndexes(rows);
  if (elite.size === 0) return rows;
  const fifteen: StandingRow[] = [];
  const rest: StandingRow[] = [];
  rows.forEach((r, i) => {
    if (!elite.has(i)) {
      rest.push(r);
      return;
    }
    const self = opts.viewerRowerNumber != null && r.rowerNumber === opts.viewerRowerNumber;
    const row = r.masked || self ? r : maskRow(r);
    fifteen.push({ ...row, unranked: true });
  });
  fifteen.sort(eliteOrder);
  return [...fifteen, ...rest];
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
