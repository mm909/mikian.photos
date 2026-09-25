import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  FIRST_DAY,
  LAST_DAY,
  MONTH,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  pacificDay,
  type Boards,
  type RecordRow,
} from "@/lib/row100k";
import { maskedIds } from "@/lib/row100kViewer";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { eliteListHref } from "../feed/view";
import { resolvePhotoMedia } from "../photoUrls";
import { pickFollowing } from "./following";
import { STREAM_CAP, type LookFriend, type LookKey, type LookPayload, type LookRecord, type LookRow } from "./view";

/* EVERYTHING THE FIVE LOOKS PRINT, loaded once on the server: the rows of
 * the followed rowers for this month with their photos, titles and
 * seconds; the board for the friends standings and the records; the
 * viewer's own head. One loader, so every look masks the same way — the
 * blackout the feed page applies (feed/page.tsx): a row by one of the
 * elite carries blocks for its meters, no time, the real split, and no
 * photo of theirs reaches the browser; the set is the board's own as THIS
 * viewer sees it (row100kViewer.maskedIds over boardView), and a board
 * that cannot be read while a window is open hides every row but the
 * viewer's own rather than guess. */

/* "1,234" or "4.2" hours, the front page's own rule (page.tsx fmtHours). */
function fmtHours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 100 ? Math.round(h).toLocaleString("en-US") : (Math.round(h * 10) / 10).toLocaleString("en-US");
}

function record(rows: RecordRow[], division: "M" | "F"): LookRecord | null {
  const r = rows.find((x) => x.division === division);
  if (!r) return null;
  return {
    division,
    timeStr: fmtRecordTime(r.value),
    splitStr: fmtSplit(10000, r.value),
    rowerNumber: r.rowerNumber,
    numStr: fmtRowerNumber(r.rowerNumber),
    name: r.name,
    dayStr: fmtDay(r.day).toUpperCase(),
  };
}

export async function loadLook(opts: {
  look: LookKey;
  me: { id: string; rowerNumber: number; displayName: string };
  /* This rower's month, off the page's fresh rows (not the cached board),
   * so a just-logged row shows up straight after the refresh. */
  myMonth: { meters: number; seconds: number; sessions: number };
  /* What boardView is told about the viewer (row100kViewer.previewViewOpts). */
  view: { viewerParticipantId: string | null; admin: boolean; forceBlackout: boolean };
  /* For the fail-closed rule only: an admin not under a test preview is
   * the one reader told they see everything. */
  isAdmin: boolean;
  previewOn: boolean;
}): Promise<LookPayload> {
  const now = nowMs();
  const todayKey = pacificDay(now);

  // The board first: it names everyone, says who is masked, and holds the
  // records. A miss outside a window means an empty board and no records
  // — the rows still print; inside a window it hides every row (feed rule).
  let boards: Boards = EMPTY_BOARDS;
  let hidden = new Set<string>();
  let hideAll = false;
  try {
    const view = await boardView(opts.view);
    boards = view.boards;
    hidden = maskedIds(boards);
  } catch (err) {
    console.error("row100k/looks: failed to load board data for the blackout", err);
    const real = await activeBlackout();
    const active = real.active || opts.view.forceBlackout;
    hideAll = active && !(opts.isAdmin && !opts.previewOn);
    if (hideAll) console.warn("row100k/looks: board unreadable during a blackout window — hiding every row but the viewer's own");
  }
  const isHidden = (participantId: string) =>
    (hideAll && participantId !== opts.me.id) || hidden.has(participantId);

  // Every row of the month, newest first — the following set is picked
  // off them (following.ts), and the followed rowers' rows are the stream.
  // A row dated past today (the demo seed can run ahead of the demo clock)
  // never shows: nobody logs the future.
  type Entry = {
    id: string;
    participantId: string;
    day: string;
    meters: number;
    seconds: number;
    title: string;
    photos: string[];
    createdAt: Date;
  };
  let entries: Entry[] = [];
  try {
    entries = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE, day: { gte: FIRST_DAY, lte: LAST_DAY } },
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, title: true, photos: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  } catch (err) {
    console.error("row100k/looks: failed to load the rows", err);
  }
  entries = entries.filter((e) => e.day <= todayKey);

  const following = pickFollowing(entries, opts.me.id);
  const followed = new Set(following);
  const byId = new Map(boards.total.map((r) => [r.participantId, r]));

  // THE STREAM: the followed rowers' rows, newest first, capped.
  const mine = entries.filter((e) => followed.has(e.participantId) && byId.has(e.participantId));
  const rowsCapped = mine.length > STREAM_CAP;
  const slice = mine.slice(0, STREAM_CAP);
  const hiddenRow = slice.map((e) => isHidden(e.participantId));
  const photoMedia = await Promise.all(
    slice.map((e, i) => (hiddenRow[i] ? Promise.resolve([]) : resolvePhotoMedia(e.photos))),
  );
  const rows: LookRow[] = slice.map((e, i) => {
    const masked = hiddenRow[i];
    const p = byId.get(e.participantId)!;
    return {
      id: e.id,
      participantId: e.participantId,
      rowerNumber: p.rowerNumber,
      numStr: fmtRowerNumber(p.rowerNumber),
      name: p.name,
      dayKey: e.day,
      dayStr: fmtDay(e.day).toUpperCase(),
      absIso: e.createdAt.toISOString(),
      title: e.title,
      metersStr: masked ? "" : fmtMeters(e.meters),
      durationStr: masked ? "" : fmtDuration(e.seconds),
      splitStr: fmtSplit(e.meters, e.seconds),
      photos: photoMedia[i],
      masked,
      digits: masked ? digitCount(e.meters) : undefined,
      elite: masked && hidden.has(e.participantId),
      today: e.day === todayKey,
    };
  });

  // THE FRIENDS: board order (the elite first while hidden, then meters),
  // each with what landed today. The board row is the one boardView masked
  // for this viewer, so its meters are printable as they are; today's
  // meters of a masked friend are zeroed — the row count alone says they
  // moved.
  const todayBy = new Map<string, { rows: number; meters: number; title: string }>();
  for (const e of mine) {
    if (e.day !== todayKey) continue;
    const t = todayBy.get(e.participantId) ?? { rows: 0, meters: 0, title: e.title };
    t.rows += 1;
    t.meters += e.meters;
    todayBy.set(e.participantId, t);
  }
  const friends: LookFriend[] = boards.total
    .filter((r) => followed.has(r.participantId))
    .map((r) => {
      const masked = isHidden(r.participantId);
      const t = todayBy.get(r.participantId);
      return {
        participantId: r.participantId,
        rowerNumber: r.rowerNumber,
        numStr: fmtRowerNumber(r.rowerNumber),
        name: r.name,
        division: r.division,
        meters: masked && !r.masked ? 0 : r.meters,
        masked: masked || undefined,
        digits: masked ? (r.digits ?? digitCount(r.meters)) : undefined,
        unranked: r.unranked || (masked ? true : undefined),
        todayRows: t?.rows ?? 0,
        todayMeters: masked ? 0 : (t?.meters ?? 0),
        todayTitle: t?.title ?? "",
      };
    });

  const ten = boards.fastest[10000] ?? [];

  return {
    look: opts.look,
    monthLabel: MONTH.label,
    todayStr: fmtDay(todayKey).toUpperCase(),
    me: {
      rowerNumber: opts.me.rowerNumber,
      numStr: fmtRowerNumber(opts.me.rowerNumber),
      name: opts.me.displayName,
      metersStr: fmtMeters(opts.myMonth.meters),
      hoursStr: fmtHours(opts.myMonth.seconds),
      sessions: opts.myMonth.sessions,
    },
    friends,
    rows,
    rowsCapped,
    records: { men: record(ten, "M"), women: record(ten, "F") },
    eliteHref: eliteListHref(),
    boardHref: "/row100k/board",
    feedHref: "/row100k/feed",
  };
}
