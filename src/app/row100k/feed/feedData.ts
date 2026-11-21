import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { ELITE_LABEL, digitCount } from "@/lib/blackoutRules";
import { resolvePhotoMedia } from "../photoUrls";
import { CHALLENGE, fmtDay, fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, nowMs, pacificDay } from "@/lib/row100k";
import { maskedIds, previewBlackout, viewOpts, type Viewer } from "@/lib/row100kViewer";
import { followingIds, hiddenRowers } from "@/lib/rowSocial";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { DAY_MS, pacificDayStartMs, stampParts, type DayTotal, type FeedHeadline, type FeedItem } from "./view";

/* THE FEED, COMPUTED (split out of page.tsx 2026-11-20 so the phone app
 * reads the same rows the page prints: api/row100k/app/feed). The rows,
 * their stamps, the photo media, the blackout masking, today's headline and
 * the day totals. SERVER ONLY. */

const PAGE = 60;

type EntryWithParticipant = {
  id: string;
  participantId: string;
  meters: number;
  seconds: number;
  title: string;
  photos: string[];
  createdAt: Date;
  participant: { displayName: string; rowerNumber: number };
};

export type FeedData = {
  items: FeedItem[];
  days: Record<string, DayTotal>;
  headline: FeedHeadline | null;
  eyebrow: string;
  sub: string;
  /* The cursor for the next page back in time; null on the last page. */
  olderCursor: string | null;
  /* True when this page was itself reached by a cursor. */
  paged: boolean;
  now: number;
  todayStr: string;
};

export async function buildFeed(viewer: Viewer, beforeRaw: string, opts: { following?: boolean } = {}): Promise<FeedData> {
  // ?before=<ISO createdAt>~<id> pages back in time; garbage is just ignored.
  // The id tiebreaker matters: the seed (and any busy minute) stamps many rows
  // with identical createdAt, and a strict createdAt < cursor would skip every
  // not-yet-shown row sharing the boundary timestamp. Any other query
  // string is ignored: there is one feed and this is it.
  const [beforeIso = "", beforeId = ""] = beforeRaw.split("~");
  const beforeMs = Date.parse(beforeIso);
  const before =
    Number.isFinite(beforeMs) && /^[a-z0-9]{1,40}$/i.test(beforeId)
      ? { at: new Date(beforeMs), id: beforeId }
      : null;

  let entries: EntryWithParticipant[] = [];
  try {
    /* WHOSE ROWS THIS VIEWER IS NOT SHOWN (lib/rowSocial.ts, 2026-11-21): a
     * private rower's, unless they accepted the viewer, and anybody's on
     * either side of a block. Left out of the list altogether, here and on
     * the website alike. And, when asked, ONLY the rowers the viewer
     * follows, with their own rows among them (owner, 2026-11-20: "see only
     * who I follow in my feed"). The day totals further down still count
     * everybody: a total is nobody's own number. */
    const me = viewer.myParticipantId;
    const [hide, only] = await Promise.all([hiddenRowers(me), opts.following && me ? followingIds(me).then((ids) => [...ids, me]) : Promise.resolve(null)]);
    entries = await db.rowEntry.findMany({
      where: {
        challenge: CHALLENGE,
        ...(only ? { participantId: { in: only.filter((id) => !hide.includes(id)) } } : hide.length ? { participantId: { notIn: hide } } : {}),
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.at } },
                { createdAt: before.at, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE,
      select: {
        id: true,
        participantId: true,
        meters: true,
        seconds: true,
        title: true,
        photos: true,
        createdAt: true,
        participant: { select: { displayName: true, rowerNumber: true } },
      },
    });
  } catch (err) {
    console.error("row100k/feed: failed to load feed data", err);
  }

  // Blackout: a row by one of THE ELITE shows blocks for its meters, NO
  // time at all, and its real split (owner, 2026-09-08: "show the pace but
  // not the time" — the pace is their identity while the meters are gone,
  // and on its own it gives neither the meters nor the time away). The
  // set is the board's own, as THIS viewer sees it — self and admins
  // exempt (row100kViewer.maskedIds over boardView). A board failure
  // while a window is open hides every row rather than guess: the feed
  // cannot know which rowers are elite without it — and, not knowing,
  // it must not call them elite either: those strips draw a bare ink
  // block where THE ELITE mark would go (`elite` on the item says which).
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let hidden = new Set<string>();
  let hideAll = false;
  try {
    const view = await boardView(viewOpts(viewer));
    blackout = view.blackout;
    hidden = maskedIds(view.boards);
  } catch (err) {
    console.error("row100k/feed: failed to load board data for the blackout", err);
    // The window state lives in its own table and activeBlackout() never
    // throws, so the fail-closed hide fires only while a window is actually
    // open — a plain board hiccup outside one must not black out the feed.
    blackout = previewBlackout(viewer, await activeBlackout());
    hideAll = blackout.active && !(viewer.isAdmin && !viewer.preview);
    if (hideAll) {
      console.warn("row100k/feed: board unreadable during a blackout window — hiding every row but the viewer's own");
    }
    hidden = maskedIds(EMPTY_BOARDS);
  }
  const isHidden = (participantId: string) =>
    (hideAll && participantId !== viewer.myParticipantId) || hidden.has(participantId);

  // Resolve photo media (rows keep the rower photo at index 0) — each photo
  // carries its full URL plus its thumb URL, both plain public CDN strings
  // built without touching R2 (the strip renders the thumb and swaps in the
  // full frame if it ever 404s). The Prisma query above is this page's
  // first network wait; the two day-total selects below are the others.
  // Rows whose photos can't resolve still show as text strips with the
  // placeholder square holding the left edge. A hidden rower's photos are
  // not resolved at all: their strip draws THE ELITE mark (or the bare
  // block, when hidden by the fail-closed rule) on the thumbs' footprint
  // (owner, 2026-09-08), and no URL of theirs may reach the browser — not
  // even for a mark that never shows it.
  const hiddenRow = entries.map((e) => isHidden(e.participantId));
  const photoMedia = await Promise.all(
    entries.map((e, i) => (hiddenRow[i] ? Promise.resolve([]) : resolvePhotoMedia(e.photos))),
  );

  const items: FeedItem[] = entries.map((e, i) => {
    const masked = hiddenRow[i];
    return {
      id: e.id,
      absIso: e.createdAt.toISOString(),
      // The absolute Pacific stamp of when the row LANDED — the day it files
      // under and the clock — no relative time. createdAt shifted minus 7
      // hours (the same precedent as admin/fix-days usWestDay), read back as
      // UTC fields; the exact UTC instant stays in absIso for the title
      // attribute. One shift for the strips and the day totals: both read
      // stampParts (view.ts), so they can never disagree about which day a
      // row landed.
      ...stampParts(e.createdAt),
      rowerNumber: e.participant.rowerNumber,
      numStr: fmtRowerNumber(e.participant.rowerNumber),
      name: e.participant.displayName,
      // A hidden row carries NO meters and NO time string — not even the
      // time's shape — because Strips is a client component and nothing of
      // theirs but the split may reach the browser. The split is real: the
      // pace stays public (the same paceTag rule as the board). Only the
      // meters' digit count travels beside it.
      metersStr: masked ? "" : fmtMeters(e.meters),
      durationStr: masked ? "" : fmtDuration(e.seconds),
      splitStr: fmtSplit(e.meters, e.seconds),
      title: e.title,
      photos: photoMedia[i],
      masked,
      digits: masked ? digitCount(e.meters) : undefined,
      // THE ELITE mark only for a rower the BOARD hid; a row hidden by the
      // fail-closed rule (hideAll: `hidden` is empty then) is masked but
      // not elite and draws the bare block instead.
      elite: masked && hidden.has(e.participantId),
    };
  });
  const anyHidden = items.some((it) => it.masked);
  // The eyebrow doubles as the blackout line — the feed has no tab row
  // for the board's note to sit under. Only an admin is told they see
  // everything: a reader whose sixty rows happen to hold no elite row is
  // still inside a window (review, 2026-09-05).
  const eyebrow = anyHidden
    ? hideAll
      ? `${ELITE_LABEL} · ROWS HIDDEN`
      : `${ELITE_LABEL}`
    : blackout.active
      ? viewer.isAdmin && !viewer.preview
        ? `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`
        : `${ELITE_LABEL}`
      : "EVERY ROW, AS IT LANDS";

  const full = entries.length === PAGE;
  const olderCursor = full
    ? `${entries[entries.length - 1].createdAt.toISOString()}~${entries[entries.length - 1].id}`
    : null;

  // The strips group rows under the Pacific day they LANDED (the day the
  // stamps already show) and print, page-independent, the day's whole
  // total and today's headline. Two small selects after the page query,
  // in parallel: every row that landed today (meters + who, for the big
  // number and its ROWS · ROWERS line) and every row across the days on
  // this page (for the day heads).
  //
  // Landing day, decided (2026-09-05): the headline and the heads go by
  // createdAt, not the rowed `day` the front page's todayMeters uses.
  // The feed is ordered by landing time, so grouping by `day` would
  // split a day into repeated sections (a row logged this morning for
  // last night sits between today's rows), and the stamps would sit
  // under heads that disagree with them. The cost: a back-logged row
  // counts here today and on the front page yesterday. Under the demo
  // clock (dev:row100k) todayKey is shifted but createdAt is real time;
  // the demo seed stamps createdAt on the rowed day, so seeded rows
  // still land under the demo's today — only rows logged live through
  // the form during a demo fall on the real date.
  //
  // Everyone counts. The headline and every day head sum EVERY row that
  // landed, THE ELITE's rows included — the owner's rule
  // (restated 2026-09-05): a blacked-out rower's meters still contribute
  // to the total meters in all the stats; only where THEIR number would
  // be displayed is it blocked out, and a day's total is nobody's own
  // number. So isHidden plays no part in these sums, nothing is
  // subtracted, and no hidden count is printed beside a total — even on a
  // day with a single elite row (the owner's call). isHidden still masks
  // the individual strips above.
  const now = nowMs();
  const todayKey = pacificDay(now);
  const todayStr = fmtDay(todayKey).toUpperCase();
  const todayStart = pacificDayStartMs(todayKey);
  const span =
    items.length > 0
      ? {
          from: new Date(pacificDayStartMs(items[items.length - 1].dayKey)),
          to: new Date(pacificDayStartMs(items[0].dayKey) + DAY_MS),
        }
      : null;

  let headline: FeedHeadline | null = null;
  const days: Record<string, DayTotal> = {};
  try {
    const [todayRows, spanRows] = await Promise.all([
      db.rowEntry.findMany({
        where: {
          challenge: CHALLENGE,
          createdAt: { gte: new Date(todayStart), lt: new Date(todayStart + DAY_MS) },
        },
        select: { meters: true, participantId: true },
      }),
      span
        ? db.rowEntry.findMany({
            where: { challenge: CHALLENGE, createdAt: { gte: span.from, lt: span.to } },
            select: { meters: true, createdAt: true },
          })
        : Promise.resolve([] as { meters: number; createdAt: Date }[]),
    ]);
    headline = {
      dayStr: todayStr,
      meters: todayRows.reduce((s, r) => s + r.meters, 0),
      rows: todayRows.length,
      rowers: new Set(todayRows.map((r) => r.participantId)).size,
    };
    for (const r of spanRows) {
      const k = stampParts(r.createdAt).dayKey;
      const d = days[k] ?? (days[k] = { meters: 0, rows: 0 });
      d.meters += r.meters;
      d.rows += 1;
    }
  } catch (err) {
    // The rows still print; the head dims every zero and the day heads
    // carry the day alone.
    console.error("row100k/feed: failed to load the day totals", err);
  }

  // The head's second mono line: the rows and rowers behind today's
  // number. Everyone counts here too, THE ELITE included (see above).
  const sub = !headline
    ? "TODAY COULD NOT BE READ"
    : headline.rows === 0
      ? "NOTHING LANDED TODAY YET"
      : `${headline.rows} ${headline.rows === 1 ? "ROW" : "ROWS"} · ${headline.rowers} ${
          headline.rowers === 1 ? "ROWER" : "ROWERS"
        } TODAY`;

  return { items, days, headline, eyebrow, sub, olderCursor, paged: before !== null, now, todayStr };
}
