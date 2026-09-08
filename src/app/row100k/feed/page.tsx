import type { Metadata } from "next";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { ELITE_LABEL, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import { resolvePhotoMedia } from "../photoUrls";
import {
  CHALLENGE,
  END_MS,
  LOG_CLOSE_MS,
  START_MS,
  daysElapsed,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  pacificDay,
} from "@/lib/row100k";
import { barProps, maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { FeedHead } from "./FeedHead";
import { Strips } from "./Strips";
import {
  DAY_MS,
  eliteListHref,
  pacificDayStartMs,
  stampParts,
  type DayTotal,
  type FeedHeadline,
  type FeedItem,
} from "./view";

/* THE FEED — the strips (the owner's pick, 2026-09-05).
 * This page does every computation on the server — the rows, their
 * stamps, the photo media, the blackout masking, today's headline and the
 * day totals — and FeedHead / Strips lay it out. Styles: the .fd- block in
 * theme.ts. */

export const metadata: Metadata = {
  title: "The feed — 100K September",
  description: "The live ticker — every row as it comes in, for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

const PAGE = 60;

type SearchParams = { [key: string]: string | string[] | undefined };

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

/* Page one is a bare /row100k/feed; older pages carry only the cursor. */
function feedHref(beforeCursor: string | null): string {
  return beforeCursor ? `/row100k/feed?before=${encodeURIComponent(beforeCursor)}` : "/row100k/feed";
}

/* The dateline under THE FEED: today (Pacific) and where the month stands
 * — the front page's own wording — then the blackout line. */
function feedDateline(now: number, todayStr: string, eyebrow: string): string {
  const where =
    now < START_MS
      ? "FIRST STROKE SEP 1"
      : now >= LOG_CLOSE_MS
        ? "FINAL"
        : now >= END_MS
          ? "LATE LOGS THROUGH OCT 3"
          : `DAY ${daysElapsed(now)} OF 30`;
  return `${todayStr} · ${where} · ${eyebrow}`;
}

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  // ?before=<ISO createdAt>~<id> pages back in time; garbage is just ignored.
  // The id tiebreaker matters: the seed (and any busy minute) stamps many rows
  // with identical createdAt, and a strict createdAt < cursor would skip every
  // not-yet-shown row sharing the boundary timestamp. Any other query
  // string is ignored: there is one feed and this is it.
  const beforeRaw = typeof searchParams.before === "string" ? searchParams.before : "";
  const [beforeIso = "", beforeId = ""] = beforeRaw.split("~");
  const beforeMs = Date.parse(beforeIso);
  const before =
    Number.isFinite(beforeMs) && /^[a-z0-9]{1,40}$/i.test(beforeId)
      ? { at: new Date(beforeMs), id: beforeId }
      : null;

  let entries: EntryWithParticipant[] = [];
  try {
    entries = await db.rowEntry.findMany({
      where: {
        challenge: CHALLENGE,
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
  const viewer = await resolveViewer();
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
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";
  // The eyebrow doubles as the blackout line — the feed has no tab row
  // for the board's note to sit under. Only an admin is told they see
  // everything: a reader whose sixty rows happen to hold no elite row is
  // still inside a window (review, 2026-09-05).
  const eyebrow = anyHidden
    ? hideAll
      ? `BLACKOUT — ROWS HIDDEN${until}`
      : `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}`
    : blackout.active
      ? viewer.isAdmin
        ? `BLACKOUT ON${until} — YOU SEE EVERYTHING`
        : `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}`
      : "EVERY ROW, AS IT LANDS";

  const full = entries.length === PAGE;
  const olderCursor = full
    ? `${entries[entries.length - 1].createdAt.toISOString()}~${entries[entries.length - 1].id}`
    : null;
  const olderHref = olderCursor ? feedHref(olderCursor) : null;

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
    // The rows still print; the head shows a dash and the day heads
    // carry the day alone.
    console.error("row100k/feed: failed to load the day totals", err);
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="feed" {...barProps(viewer)} />

      <section className="fd-sec">
        <div className="wrap">
          <FeedHead headline={headline} dateline={feedDateline(now, todayStr, eyebrow)} />

          {items.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET — THE FEED STARTS WITH THE FIRST ROW.</p>
          ) : (
            <Strips items={items} days={days} eliteHref={eliteListHref(viewer.actor !== null)} />
          )}

          {(before || olderHref) && (
            <nav className="fd-pager" aria-label="Feed pages">
              {before ? <a href={feedHref(null)}>← NEWER</a> : <span className="fd-spacer" />}
              {olderHref ? <a href={olderHref}>OLDER →</a> : null}
            </nav>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
