import type { Metadata } from "next";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { ELITE_LABEL, clockShape, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
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
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { boardView, EMPTY_BOARDS } from "../boardData";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { FeedViews, type FeedItem } from "./FeedViews";
import { FeedA } from "./looks/FeedA";
import { FeedB } from "./looks/FeedB";
import { FeedC } from "./looks/FeedC";
import { FeedHead } from "./looks/FeedHead";
import {
  DAY_MS,
  pacificDayStartMs,
  pickFeedLook,
  stampParts,
  type DayTotal,
  type FeedHeadline,
  type FeedLook,
  type FeedLookItem,
} from "./looks/view";

export const metadata: Metadata = {
  title: "The feed — 100K September",
  description: "The live ticker — every row as it comes in, for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

const PAGE = 60;

/* The stamp drops relative time for the real clock: createdAt shifted minus
 * 7 hours (Pacific — the same precedent as admin/fix-days usWestDay), then
 * read back as UTC fields. "SEP 2 · 3:54 PM". createdAt is REAL time even
 * when the demo clock (nowMs) is shifted into September, and the exact UTC
 * instant stays available in a title attribute on every strip. One shift
 * for the boxed feed and the looks: both read stampParts (looks/view.ts),
 * so they can never disagree about which day a row landed. */
function stampWhen(createdAt: Date): string {
  const p = stampParts(createdAt);
  return `${p.dayStr} · ${p.clockStr}`;
}

/* Feed-only styles — the PHOTO LEDGER (winner of the dev drafts, option 4):
 * one compact strip per row inside a 2px ink border — thumbs left, dashed
 * divider, then name, stamp eyebrow, and the numbers. Scoped with a .fl-
 * prefix; theme.ts stays untouched. Rendered as the text child of a style
 * tag, so no double quotes and no angle brackets anywhere in the string
 * (see the note in theme.ts). */
const feedCss = `
.row100k .fl-strip{display:flex;align-items:stretch;border:2px solid var(--ink);margin-bottom:12px}
.row100k .fl-left{flex-shrink:0;display:flex;align-items:center;gap:6px;padding:8px 12px 8px 10px;border-right:1px dashed var(--line)}
.row100k .fl-left button{display:block;flex-shrink:0;appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:0;margin:0;cursor:pointer}
.row100k .fl-left img{display:block;width:64px;height:64px;object-fit:cover;border:1px solid var(--line)}
.row100k .fl-left button:hover img{border-color:var(--water)}
.row100k .fl-noph{width:64px;height:64px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px dashed var(--line);color:var(--gray);font-family:var(--row-mono),monospace;font-size:12px}
.row100k .fl-mid{flex:1;min-width:0;padding:9px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px}
.row100k .fl-who{font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink)}
.row100k .fl-who a{color:var(--ink);text-decoration:none}
.row100k .fl-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .fl-meta{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);display:flex;gap:12px;flex-wrap:wrap}
.row100k .fl-nums{display:flex;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums;flex-wrap:wrap}
.row100k .fl-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,4.5vw,26px);line-height:1;color:var(--water)}
.row100k .fl-t{font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink)}
.row100k .fl-s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray)}
.row100k .feed-pager{display:flex;justify-content:space-between;gap:10px;margin-top:28px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em}
.row100k .feed-pager a{text-decoration:none;border:2px solid var(--ink);padding:9px 16px;color:var(--ink)}
.row100k .feed-pager a:hover{border-color:var(--water);color:var(--water)}
.row100k .feed-pager .feed-spacer{flex:1}
`;

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

/* Page one is a bare /row100k/feed; older pages carry only the cursor. A
 * look under review (?look=a|b|c) rides along so paging keeps the look. */
function feedHref(beforeCursor: string | null, look: FeedLook | null = null): string {
  const q: string[] = [];
  if (look) q.push(`look=${look}`);
  if (beforeCursor) q.push(`before=${encodeURIComponent(beforeCursor)}`);
  return q.length > 0 ? `/row100k/feed?${q.join("&")}` : "/row100k/feed";
}

/* The dateline under THE FEED on a look: today (Pacific) and where the
 * month stands — the front page's own wording — then the eyebrow line the
 * boxed feed prints in its section head, which is the blackout line. */
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
  // not-yet-shown row sharing the boundary timestamp.
  const beforeRaw = typeof searchParams.before === "string" ? searchParams.before : "";
  const [beforeIso = "", beforeId = ""] = beforeRaw.split("~");
  const beforeMs = Date.parse(beforeIso);
  const before =
    Number.isFinite(beforeMs) && /^[a-z0-9]{1,40}$/i.test(beforeId)
      ? { at: new Date(beforeMs), id: beforeId }
      : null;
  // ?look=a|b|c: one of the three unboxed looks under review (looks/);
  // anything else is the feed as it stands.
  const look = pickFeedLook(searchParams.look);

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

  // Blackout: a row by one of the hidden fifteen shows blocks for its
  // meters AND its time, and no split (any two of the three give the
  // third; the owner's rule, 2026-09-05, after the feed was found still
  // printing elite times). The set is
  // the board's own, as THIS viewer sees it — self and admins exempt
  // (row100kViewer.maskedIds over boardView). A board failure while a
  // window is open hides every row rather than guess: the feed cannot know
  // which rowers are elite without it.
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
    blackout = await activeBlackout();
    hideAll = blackout.active && !viewer.isAdmin;
    if (hideAll) {
      console.warn("row100k/feed: board unreadable during a blackout window — hiding every row but the viewer's own");
    }
    hidden = maskedIds(EMPTY_BOARDS);
  }
  const isHidden = (participantId: string) =>
    (hideAll && participantId !== viewer.myParticipantId) || hidden.has(participantId);

  // Resolve photo media (rows keep the rower photo at index 0) — each photo
  // carries its full URL plus its thumb URL, both plain public CDN strings
  // built without touching R2 (the 64px strip renders the thumb and swaps in
  // the full frame if it ever 404s). The Prisma query above is this page's
  // only network wait. Rows whose photos can't resolve still show as text
  // strips with the placeholder square holding the left edge.
  const photoMedia = await Promise.all(entries.map((e) => resolvePhotoMedia(e.photos)));

  const items: FeedItem[] = entries.map((e, i) => {
    const masked = isHidden(e.participantId);
    return {
      id: e.id,
      // Absolute Pacific stamp of when the row LANDED — no relative time.
      whenStr: stampWhen(e.createdAt),
      absIso: e.createdAt.toISOString(),
      rowerNumber: e.participant.rowerNumber,
      numStr: fmtRowerNumber(e.participant.rowerNumber),
      name: e.participant.displayName,
      // A hidden row carries NO meters, time or split string — FeedViews is
      // a client component, and none of the numbers may reach the browser.
      // Only their shapes travel: the digit count and the time silhouette.
      metersStr: masked ? "" : fmtMeters(e.meters),
      durationStr: masked ? "" : fmtDuration(e.seconds),
      splitStr: masked ? "" : fmtSplit(e.meters, e.seconds),
      title: e.title,
      photos: photoMedia[i],
      masked,
      digits: masked ? digitCount(e.meters) : undefined,
      timeShape: masked ? clockShape(e.seconds) : undefined,
    };
  });
  const anyHidden = items.some((it) => it.masked);
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";
  // The eyebrow doubles as the blackout line — the feed has no tab row
  // for the board's note to sit under.
  const eyebrow = anyHidden
    ? hideAll
      ? `BLACKOUT — ROWS HIDDEN${until}`
      : `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}`
    : blackout.active
      ? `BLACKOUT ON${until} — YOU SEE EVERYTHING`
      : "EVERY ROW, AS IT LANDS";

  const full = entries.length === PAGE;
  const olderCursor = full
    ? `${entries[entries.length - 1].createdAt.toISOString()}~${entries[entries.length - 1].id}`
    : null;
  const olderHref = olderCursor ? feedHref(olderCursor, look) : null;

  if (look) {
    // The looks group rows under the Pacific day they LANDED (the day the
    // stamps already show) and print, page-independent, the day's whole
    // total and today's headline. Two small selects after the page query,
    // in parallel: every row that landed today (meters + who, for the big
    // number and its ROWS · ROWERS line) and every row across the days on
    // this page (for the day heads). Only a look pays for them; the
    // default feed is untouched.
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
    // Not the front page's aggregate rule: a masked rower's meters are
    // left OUT of every sum here and counted as `hidden` instead (view.ts
    // DayTotal). A day, or a today, with a single elite row would print
    // that row's meters as its total, and any other day would give them
    // away by subtracting the visible rows — the whole day is on this
    // page and the next. Visible meters plus a hidden count give nothing
    // back. isHidden is the page's own, so self and admins keep the full
    // figures.
    const now = nowMs();
    const todayKey = pacificDay(now);
    const todayStr = fmtDay(todayKey).toUpperCase();
    const todayStart = pacificDayStartMs(todayKey);
    const lookItems: FeedLookItem[] = items.map((it, i) => ({ ...it, ...stampParts(entries[i].createdAt) }));
    const span =
      lookItems.length > 0
        ? {
            from: new Date(pacificDayStartMs(lookItems[lookItems.length - 1].dayKey)),
            to: new Date(pacificDayStartMs(lookItems[0].dayKey) + DAY_MS),
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
              select: { meters: true, createdAt: true, participantId: true },
            })
          : Promise.resolve([] as { meters: number; createdAt: Date; participantId: string }[]),
      ]);
      headline = {
        dayStr: todayStr,
        meters: todayRows.reduce((s, r) => (isHidden(r.participantId) ? s : s + r.meters), 0),
        rows: todayRows.length,
        rowers: new Set(todayRows.map((r) => r.participantId)).size,
        hidden: todayRows.filter((r) => isHidden(r.participantId)).length,
      };
      for (const r of spanRows) {
        const k = stampParts(r.createdAt).dayKey;
        const d = days[k] ?? (days[k] = { meters: 0, rows: 0, hidden: 0 });
        if (isHidden(r.participantId)) d.hidden += 1;
        else d.meters += r.meters;
        d.rows += 1;
      }
    } catch (err) {
      // The rows still print; the head shows a dash and the day heads
      // carry the day alone.
      console.error("row100k/feed: failed to load the day totals for a look", err);
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
            ) : look === "a" ? (
              <FeedA items={lookItems} days={days} />
            ) : look === "b" ? (
              <FeedB items={lookItems} days={days} />
            ) : (
              <FeedC items={lookItems} days={days} />
            )}

            {(before || olderHref) && (
              <nav className="fd-pager" aria-label="Feed pages">
                {before ? <a href={feedHref(null, look)}>← NEWER</a> : <span className="fd-spacer" />}
                {olderHref ? <a href={olderHref}>OLDER →</a> : null}
              </nav>
            )}
          </div>
        </section>

        <RowFooter />
      </div>
    );
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{feedCss}</style>

      <RowBar active="feed" {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The feed</h2>
            <span className="mono">{eyebrow}</span>
          </div>

          {items.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET — THE FEED STARTS WITH THE FIRST ROW.</p>
          ) : (
            <FeedViews items={items} />
          )}

          {(before || olderHref) && (
            <nav className="feed-pager" aria-label="Feed pages">
              {before ? <a href={feedHref(null)}>← NEWER</a> : <span className="feed-spacer" />}
              {olderHref ? <a href={olderHref}>OLDER →</a> : null}
            </nav>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
