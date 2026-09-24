import { cache } from "react";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { clockShape, digitCount, forcedBlackout } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  MONTH,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  fmtMeters,
  fmtRecordTime,
  fmtSplit,
  nowMs as clockNow,
  recordPlacements,
  type Boards,
  type RecordBadge,
} from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { inPeriod, parsePeriod, type Period } from "@/lib/rowPeriod";
import { boardView } from "../../boardData";
import { myWaveShare } from "../../shareables/waveShare";
import type { ShareData } from "../../share/cards";
import type { ProfileBest } from "./looks/view";

/* WHAT A ROWER'S SHARE CARDS DRAW, in one place (owner, 2026-09-24: "a
 * master shareables page ... the ones you'd have for your profile (meters
 * this month, meters this day, the bests) and also select a row and share
 * based on that row's stats"). The profile page (page.tsx) used to build
 * its share payload inline; the shareables page (share/page.tsx) needs the
 * same one, over the same ?m= month, so the pieces both pages share live
 * here: the rower read, the payload, and the bests the best card reads.
 * page.tsx keeps every decision about masking and rank that the rest of
 * the profile also needs and hands the answers in; rowerShareView() below
 * makes the same decisions for the page that only wants the cards. */

export const getRower = cache(async (num: number) => {
  const participant = await db.rowParticipant.findUnique({
    where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: num } },
    select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
  });
  if (!participant) return null;
  const entries = await db.rowEntry.findMany({
    where: { participantId: participant.id },
    select: {
      id: true,
      participantId: true,
      day: true,
      meters: true,
      seconds: true,
      title: true,
      photos: true,
    },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
  });
  return { participant, entries };
});

export type RowerRecord = NonNullable<Awaited<ReturnType<typeof getRower>>>;
export type RowerParticipant = RowerRecord["participant"];

/* The month the cards draw, off a period: a past month is its own grid and
 * its full run of days, this month stops at today, all time has no one
 * month (null — the calendar and day cards stay out). */
export function periodMonthOf(period: Period): { days: number; month: ShareData["month"] } {
  return {
    days: period.kind === "month" && period.key !== MONTH.key ? period.days : daysElapsed(),
    month: period.kind === "month" ? { key: period.key, firstDow: period.firstDow, days: period.days } : null,
  };
}

/* Everything the share cards draw. `masked`/`digits` ride along so a card
 * of a hidden rower draws blocks (share/cards.ts); the placement values —
 * real meters off the record boards — are blanked under a viewer-level
 * mask so they cannot ride into a client prop.
 *
 * `shareElite` is elite status off the PUBLIC board, not the viewer's: the
 * page may show a rower their own number, but a card leaves the site, so an
 * elite rower's own dialog (and an admin's repost card) must draw blocks
 * too. No place on a card of one of the elite, ever: "#3" is the number by
 * another route (the PLACES half of the rule). */
export function buildShareData(args: {
  p: RowerParticipant;
  boards: Boards;
  byDay: Record<string, number>;
  period: Period;
  rank: { place: number; of: number } | null | undefined;
  records: RecordBadge[] | undefined;
  masked: boolean;
  shareElite: boolean;
  race: ShareData["race"];
}): ShareData {
  const { p, boards, byDay, period, rank, records, masked, shareElite, race } = args;
  const me = boards.total[0];
  const { days, month } = periodMonthOf(period);
  return {
    displayName: p.displayName,
    rowerNumber: p.rowerNumber,
    instagram: p.instagram,
    meters: me.meters,
    sessions: me.sessions,
    byDay,
    division: p.division,
    longest: boards.longest[0]?.value ?? 0,
    rank: shareElite ? null : rank,
    records: masked ? records?.map((r) => ({ ...r, value: "" })) : records,
    // The cards stop at today like the page calendar does — and draw THE
    // SELECTED month (owner, 2026-09-24: "the month share card, when
    // looking at previous months, is not populated: the total is right but
    // the calendar squares are empty"): byDay is already this period's, so
    // the card only needs telling which month its keys are in. Null over
    // all time — no one month to draw, the month card stays out of the menu.
    days,
    month,
    masked: shareElite,
    digits: shareElite ? digitCount(me.meters) : undefined,
    race,
  };
}

/* The four bests as the profile prints them and the best card reads them.
 * Each knows its record-board key so it can wear the rower's division
 * ranking (top 10 only — that's as deep as `records` goes) as a chip, and
 * links to that record's leaderboard filtered to the same division so the
 * board you land on matches the chip. A masked profile's bests carry no
 * value string at all: the two meters bests keep only a digit count for
 * the blocks, the two pace bests only the silhouette of the time
 * (ProfileBest.shape, "##:##.#") and no split — and the prorated note stops
 * naming the piece, since "pace from a 12,345 m row" is a row's meters by
 * another route. */
export function buildBests(args: {
  p: RowerParticipant;
  boards: Boards;
  records: RecordBadge[] | undefined;
  masked: boolean;
}): ProfileBest[] {
  const { p, boards: b, records, masked } = args;
  const divQ = p.division === "F" ? "f" : p.division === "M" ? "m" : "all";
  const boardHref = (board: string) => `/row100k/records/${board}?d=${divQ}`;
  const placeOf = (key: string) => records?.find((r) => r.key === key)?.place ?? null;
  const metersBest = (key: string, label: string, r: { value: number; day: string } | undefined): ProfileBest => ({
    key,
    label,
    value: r ? (masked ? "" : fmtMeters(r.value)) : "—",
    sub: r ? fmtDay(r.day) : "not yet rowed",
    href: boardHref(key),
    place: placeOf(key),
    digits: r && masked ? digitCount(r.value) : undefined,
  });
  return [
    ...([5000, 10000] as const).map((d): ProfileBest => {
      const r = b.fastest[d][0];
      return {
        key: `fastest${d}`,
        label: `Fastest ${d / 1000}k`,
        value: r ? (masked ? "" : fmtRecordTime(r.value)) : "—",
        shape: r && masked ? clockShape(r.value, true) : undefined,
        sub: r
          ? r.prorated && r.meters
            ? `${fmtDay(r.day)} · pace from a ${masked ? "longer" : fmtMeters(r.meters)} row`
            : masked
              ? fmtDay(r.day)
              : `${fmtDay(r.day)} · ${fmtSplit(d, r.value)} /500m`
          : "not yet rowed",
        href: boardHref(String(d)),
        place: placeOf(`fastest${d}`),
      };
    }),
    metersBest("longest", "Longest row", b.longest[0]),
    metersBest("bigday", "Biggest day", b.bigDay[0]),
  ];
}

/* One row of the rower's, as the shareables page lists it and as the
 * single-row cards draw it (ShareData.row). Real numbers: the page is the
 * rower's own or an admin's, never a stranger's. */
export type ShareRow = { id: string; day: string; meters: number; seconds: number; title?: string };

export type RowerShareView = {
  p: RowerParticipant;
  period: Period;
  shareData: ShareData;
  /* The bests with a value — the ones a best card can be made of. */
  bests: ProfileBest[];
  /* The period's rows, latest first. */
  rows: ShareRow[];
  /* The VIEWER cannot see this rower's numbers (one of the elite under a
   * real window, seen by an admin who is looking as everyone does): the
   * profile shows a dog tag in this state and this page should show
   * nothing either. */
  masked: boolean;
};

/* THE SHAREABLES PAGE's read: the same rower, month and mask decisions the
 * profile makes, without the rest of the profile. Null when there is no
 * such rower. The caller has already decided the viewer may see this page
 * (the rower themself or an admin — share/page.tsx). */
export async function rowerShareView(num: number, m: string | string[] | undefined, viewer: Viewer): Promise<RowerShareView | null> {
  const data = await getRower(num).catch(() => null);
  if (!data) return null;
  const { participant: p, entries: allEntries } = data;
  const period = parsePeriod(m, clockNow());
  const entries = allEntries.filter((e) => inPeriod(e.day, period));
  const isAdmin = viewer.isAdmin;
  const isMe = viewer.myParticipantId === p.id;

  const boards = computeBoards([p], entries);
  const byDay: Record<string, number> = {};
  for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;

  // The same mask the profile applies (page.tsx has the long form): the
  // viewer's board decides whether this rower is hidden from THIS viewer,
  // failing closed for anyone who is not exempt when the board cannot be
  // read while a window is open.
  const blackout = previewBlackout(viewer, await activeBlackout());
  const maskAdmin = isAdmin && !viewer.preview;
  const maskMe = isMe && viewer.preview !== "public";
  let masked = blackout.active && !maskMe && !maskAdmin;
  let rank: { place: number; of: number } | null | undefined;
  let records: RecordBadge[] | undefined;
  try {
    const { boards: full } = await boardView({ ...viewOpts(viewer), period });
    rank = divisionRank(full, p.id);
    records = recordPlacements(full, p.id, 10);
    if (masked) masked = maskedIds(full).has(p.id);
  } catch (err) {
    console.error(`row100k: failed to load board data for placements (rower ${num}, shareables)`, err);
  }

  // Elite status for the cards comes off the PUBLIC board (see
  // buildShareData). Fails closed while a window is open and the board
  // cannot be read.
  let shareElite = false;
  if (blackout.active) {
    try {
      const { boards: pub } = await boardView({ forceBlackout: forcedBlackout(viewer.preview), period });
      shareElite = maskedIds(pub).has(p.id);
    } catch {
      shareElite = true;
    }
  }

  const shareData = buildShareData({
    p,
    boards,
    byDay,
    period,
    rank,
    records,
    masked,
    shareElite,
    // MY WAVE (owner, 2026-09-16): the rower's own told wave. This page is
    // only ever the rower's own or an admin's, so it always rides along.
    race: await myWaveShare(p.id),
  });
  const bests = buildBests({ p, boards, records, masked }).filter((b) => b.value !== "—");
  const rows: ShareRow[] = entries
    .map((e) => ({ id: e.id, day: e.day, meters: e.meters, seconds: e.seconds, title: e.title || undefined }))
    .reverse();
  return { p, period, shareData, bests, rows, masked };
}
