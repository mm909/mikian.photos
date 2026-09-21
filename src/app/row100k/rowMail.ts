import { digitCount, maskBoards, partialShape, type BlackoutPolicy } from "@/lib/blackoutRules";
import {
  GOAL_METERS,
  TIERS,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  type Boards,
  type TotalRow,
} from "@/lib/row100k";

/* THE ROW-LOGGED NOTE and THE MILESTONE NOTE — the two plain-text mails
 * the owner gets from api/row100k/rows when a rower logs a session.
 *
 * PURE, like raceSignupMail.ts: the row in, the blackout verdict in,
 * { subject, text } out. No db, no next imports, so every wording can be
 * read (and the milestone math checked) without mailing anybody.
 *
 * THE OWNER IS A ROWER. His inbox is a surface like any other (owner,
 * 2026-09-16: "make sure that during black out the emails that I get when
 * rowers submit meters is also censored"), so a row by one of THE ELITE
 * while a window is open reaches him the way the feed prints it: blocks for
 * the meters, NO time, the real split (a ratio of two hidden numbers gives
 * neither away — blackoutRules.ts), blocks for the total. During the run-up
 * the low digits go, the way the board rounds them off. Names, numbers,
 * session counts, days and titles stay. */

export type RowMail = { subject: string; text: string };

/* The block glyph the mail uses for a hidden digit. The site draws its
 * blocks in CSS (Blackout.tsx); a plain-text mail gets one full block per
 * digit, commas kept, so ██,███ m still reads as a five-figure number. */
export const BLOCK = "█";

/* Blocks for a shape or a digit count: a partialShape/shapeOf string
 * ("12,3##") has each # swapped for a block, a number n becomes n blocks
 * with the thousands commas where a number that long would have them
 * (6 -> ███,███). */
export function blocksOf(shapeOrDigits: string | number): string {
  const shape =
    typeof shapeOrDigits === "number"
      ? partialShape(0, shapeOrDigits, Math.max(1, Math.floor(shapeOrDigits)))
      : shapeOrDigits;
  return shape.replace(/#/g, BLOCK);
}

/* The row as the route knows it once the insert is in: the rower, the
 * session, and where they stand after it. `total` and `sessions` are the
 * fresh aggregate, not the board (the board is cached). */
export type RowLogged = {
  name: string;
  rowerNumber: number;
  meters: number;
  seconds: number;
  /* "2026-09-16" */
  day: string;
  title: string;
  total: number;
  sessions: number;
  profileUrl: string;
};

/* What the blackout says about this rower right now. `full`: every number
 * is blocks — `why` says whether the board masked them ("elite") or could
 * not say and the safe read won ("unknown"; the mail must not call that
 * rower elite, the way the feed does not — review, 2026-09-16);
 * `partial`: the run-up, this many low digits covered. */
export type Censor =
  | { kind: "none" }
  | { kind: "full"; digits: number; why: "elite" | "unknown" }
  | { kind: "partial"; hideLow: number };

/* The verdict from the PUBLIC board's row for this rower (maskBoards with
 * admin false) and the blackout state. A masked row is the window; hideLow
 * is the run-up. No row at all while a window or run-up is on is treated
 * as the window — the safe read wins. A public row that is neither masked
 * nor rounded carries its REAL meters, so one whose meters are not the
 * fresh total is a board without this row in it: while a window or run-up
 * is on that fails closed too (review, 2026-09-16 — a stale board must
 * not print a newly-elite rower once). The digit count comes off the
 * fresh total rather than row.digits, same information, one insert newer. */
export function censorFor(
  row: { meters: number; masked?: boolean; digits?: number; hideLow?: number } | undefined,
  total: number,
  state: { active: boolean; hideLow?: number },
): Censor {
  const guarded = state.active || (state.hideLow ?? 0) > 0;
  const unknown: Censor = { kind: "full", digits: digitCount(total), why: "unknown" };
  if (!row) return guarded ? unknown : { kind: "none" };
  if (row.masked) return { kind: "full", digits: digitCount(total), why: "elite" };
  if ((row.hideLow ?? 0) > 0) return { kind: "partial", hideLow: row.hideLow as number };
  if (row.meters !== total) return guarded ? unknown : { kind: "none" };
  return { kind: "none" };
}

/* The public board's row for this rower WITH THIS ROW IN IT. The route
 * reads the cached board in the same request as the revalidateTag meant to
 * refresh it, and Next 14 applies that tag only after the handler returns
 * (app-route module.js), so the board it gets is the one from before the
 * insert — every time, not on a bad day. Judged on that, the row that
 * lifts a rower into the elite is found unmasked and mailed in the clear
 * (review, 2026-09-16). So the fresh total is laid over the rower's raw
 * row (a row is made when the board has none), the standings re-sorted
 * the way computeBoards sorts them, and the PUBLIC mask applied to that:
 * the verdict the board itself gives a moment later. Pure — the raw board
 * comes in, nothing is read. */
export function freshPublicRow(
  raw: Boards,
  who: { participantId: string; name: string; division: string; rowerNumber: number; instagram: string },
  row: RowLogged,
  state: { active: boolean; hideLow?: number },
  policy?: BlackoutPolicy,
): TotalRow | undefined {
  const was = raw.total.find((r) => r.participantId === who.participantId);
  const rest = raw.total.filter((r) => r.participantId !== who.participantId);
  // A board that already carries this row (a cache miss rebuilt it) keeps
  // its time; otherwise this row's time joins the sum, so the pace the
  // hidden elite are ordered by stays honest.
  const seconds = was && was.meters === row.total ? was.seconds : (was?.seconds ?? 0) + row.seconds;
  const mine: TotalRow = {
    ...(was ?? {
      participantId: who.participantId,
      name: who.name,
      division: who.division,
      rowerNumber: who.rowerNumber,
      instagram: who.instagram,
      days: 1,
      delta: 0,
      prevRank: raw.total.length,
    }),
    meters: row.total,
    sessions: row.sessions,
    seconds,
    pct: Math.round((row.total / GOAL_METERS) * 100),
  };
  const total = [...rest, mine].sort((a, b) => b.meters - a.meters || a.name.localeCompare(b.name));
  return maskBoards(
    { ...raw, total },
    { active: state.active, hideLow: state.hideLow, admin: false, policy },
  ).total.find((r) => r.participantId === who.participantId);
}

/* The meters of one figure under a censor: blocks for the digit count when
 * the window is open, the run-up shape otherwise, the real number when
 * nothing is hidden. */
function metersUnder(value: number, censor: Censor): string {
  if (censor.kind === "full") return `${blocksOf(digitCount(value))} m`;
  if (censor.kind === "partial") return `${blocksOf(partialShape(value, censor.hideLow))} m`;
  return fmtMeters(value);
}

/* The heads-up on every logged row (owner call, launch day). The subject is
 * the whole story — name, meters, time — so the phone's mail preview says
 * it without opening (owner call, day 3); the body is the two lines that
 * matter plus the rower's page. Under a censor the time leaves the subject
 * and the body both (a time over a known distance is the meters by another
 * route) and the split takes its place; the tail of the subject says why.
 * A rower hidden because the board could not say is "hidden", never
 * "elite" — the mail must not state what nobody knows. */
export function rowLoggedMail(row: RowLogged, censor: Censor): RowMail {
  const split = `${fmtSplit(row.meters, row.seconds)} /500m`;
  const meters = metersUnder(row.meters, censor);
  const total = censor.kind === "full" ? `${blocksOf(censor.digits)} m` : metersUnder(row.total, censor);
  const elite = censor.kind === "full" && censor.why === "elite";
  const tag = censor.kind === "full" ? (elite ? "lights out" : "hidden") : censor.kind === "partial" ? "run-up" : "";
  const subject =
    censor.kind === "none"
      ? `${row.name} · ${fmtMeters(row.meters)} · ${fmtDuration(row.seconds)}`
      : `${row.name} · ${meters} · ${split} · ${tag}`;
  const why =
    censor.kind === "full"
      ? elite
        ? "lights out, numbers hidden"
        : "board could not say, numbers hidden"
      : "low digits hidden";
  const session =
    censor.kind === "none"
      ? `${meters} in ${fmtDuration(row.seconds)} (${split})`
      : `${meters} · ${split} · ${tag.toUpperCase()} — ${why}`;
  return {
    subject,
    text: [
      `${row.name} · ${fmtRowerNumber(row.rowerNumber)} · ${session}`,
      `${fmtDay(row.day)}${row.title ? ` · ${row.title}` : ""} · total ${total} · ${row.sessions} sessions`,
      ``,
      row.profileUrl,
    ].join("\n"),
  };
}

/* ------------------------------------------------------------ milestones */

/* The rungs worth a mail of their own (owner, 2026-09-16: "give me a
 * special email when people hit milestones like 50k, 100k, 250, 500 etc").
 * Where a TIER sits on the same meters its title is the headline; the two
 * above the tiers are just the number. */
export const MILESTONES = [50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000] as const;

/* "50K", "250K", "1M" — the number as a rower says it. */
export function milestoneLabel(m: number): string {
  return m >= 1_000_000 ? `${m / 1_000_000}M` : `${Math.round(m / 1000)}K`;
}

/* The tier title on that rung, or null above the tiers. */
export function milestoneTitle(m: number): string | null {
  return TIERS.find((t) => t.meters === m)?.title ?? null;
}

/* Every milestone a total crossed going from prev to next, ascending: the
 * rungs with prev < m <= next. Empty when nothing was crossed (or the
 * total went down — an edit is not a milestone). */
export function crossedMilestones(prev: number, next: number): number[] {
  return MILESTONES.filter((m) => prev < m && m <= next);
}

/* "★ Name crossed 100K — The 100K Club". Several rungs at once (one huge
 * row, or a first log after a long gap) headline the highest and list the
 * rest in the body. Never built under a censor — the route skips it while
 * a window is open or the rower is hidden — so every number here is real
 * on purpose. `dayN` is the challenge day today (daysElapsed), 1..30. */
export function milestoneMail(row: RowLogged, crossed: number[], dayN: number): RowMail {
  const rungs = [...crossed].sort((a, b) => b - a);
  const top = rungs[0];
  const rest = rungs.slice(1);
  const headline = (m: number) => {
    const title = milestoneTitle(m);
    return `${milestoneLabel(m)}${title ? ` — ${title}` : ""}`;
  };
  return {
    subject: `★ ${row.name} crossed ${headline(top)}`,
    text: [
      `★ ${headline(top).toUpperCase()}`,
      `${row.name} · rower ${fmtRowerNumber(row.rowerNumber)}`,
      ``,
      `THE ROW THAT DID IT`,
      `${fmtMeters(row.meters)} in ${fmtDuration(row.seconds)} (${fmtSplit(row.meters, row.seconds)} /500m) · ${fmtDay(row.day)}${row.title ? ` · ${row.title}` : ""}`,
      ``,
      `NOW`,
      `${fmtMeters(row.total)} · ${row.sessions} sessions · day ${dayN} of 30`,
      ...(rest.length ? [`Also crossed with this row: ${rest.map(headline).join(", ")}`] : []),
      ``,
      row.profileUrl,
    ].join("\n"),
  };
}
