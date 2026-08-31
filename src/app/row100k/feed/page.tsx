import type { Metadata } from "next";
import { db } from "@/lib/db";
import { resolvePhotoUrls } from "../photoUrls";
import {
  CHALLENGE,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { FeedViews, type FeedItem } from "./FeedViews";

export const metadata: Metadata = {
  title: "The feed — 100K September",
  description: "The live ticker — every row as it comes in, for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

const PAGE = 60;

/* Relative wall-clock age. createdAt is REAL time even when the demo clock
 * (nowMs) is shifted into September, so this compares against Date.now() —
 * "2h ago" should mean two actual hours since the row was logged. */
function relTime(thenMs: number, nowMsReal: number): string {
  const s = Math.max(0, Math.floor((nowMsReal - thenMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* Absolute time for the title attribute. UTC on purpose: rowers span
 * timezones and the server's zone is nobody's. */
function absTime(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/* Feed-only styles — scoped with a .feed- prefix; theme.ts stays untouched.
 * Rendered as the text child of a style tag, so no double quotes and no
 * angle brackets anywhere in the string (see the note in theme.ts). */
const feedCss = `
.row100k .feed-card{border:2px solid var(--ink);padding:16px 16px 15px;margin-bottom:14px}
.row100k .feed-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.row100k .feed-who{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:15px}
.row100k .feed-who a{text-decoration:none}
.row100k .feed-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .feed-who .feed-num{color:var(--gray);font-family:var(--row-mono),monospace;font-weight:400;font-size:12px}
.row100k .feed-when{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);letter-spacing:.06em;white-space:nowrap}
.row100k .feed-title{margin-top:8px;font-weight:700;font-size:17px;line-height:1.35}
.row100k .feed-nums{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:8px}
.row100k .feed-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(24px,6vw,34px);line-height:1;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .feed-time{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(16px,4vw,21px);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .feed-split{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);letter-spacing:.04em}
.row100k .feed-photos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.row100k .feed-photos.one{grid-template-columns:1fr}
.row100k .feed-photos img{display:block;width:100%;max-width:100%;height:auto;border:6px solid var(--frame);background:var(--frame)}
.row100k .feed-pager{display:flex;justify-content:space-between;gap:10px;margin-top:28px;font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.08em}
.row100k .feed-pager a{text-decoration:none;border:2px solid var(--ink);padding:9px 16px;color:var(--ink)}
.row100k .feed-pager a:hover{border-color:var(--water);color:var(--water)}
.row100k .feed-pager .feed-spacer{flex:1}
`;

type SearchParams = { [key: string]: string | string[] | undefined };

type EntryWithParticipant = {
  id: string;
  participantId: string;
  day: string;
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
        day: true,
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

  // Resolve photo URLs (rows keep the rower photo at index 0); rows whose
  // photos can't resolve still show as text cards.
  const photoUrls = await Promise.all(entries.map((e) => resolvePhotoUrls(e.photos)));

  // Relative times against REAL wall clock — never nowMs(): the demo clock is
  // shifted but createdAt is not.
  const nowReal = Date.now();
  const items: FeedItem[] = entries.map((e, i) => ({
    id: e.id,
    // One timestamp slot: the day rowed, then how long ago it landed.
    when: `${fmtDay(e.day)} · ${relTime(e.createdAt.getTime(), nowReal)}`,
    abs: absTime(e.createdAt),
    rowerNumber: e.participant.rowerNumber,
    numStr: fmtRowerNumber(e.participant.rowerNumber),
    name: e.participant.displayName,
    metersStr: fmtMeters(e.meters),
    durationStr: fmtDuration(e.seconds),
    splitStr: fmtSplit(e.meters, e.seconds),
    title: e.title,
    photoUrls: photoUrls[i],
  }));

  const full = entries.length === PAGE;
  const olderCursor = full
    ? `${entries[entries.length - 1].createdAt.toISOString()}~${entries[entries.length - 1].id}`
    : null;
  const olderHref = olderCursor ? feedHref(olderCursor) : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{feedCss}</style>

      <RowBar active="feed" />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The feed</h2>
            <span className="mono">EVERY ROW, AS IT LANDS</span>
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
