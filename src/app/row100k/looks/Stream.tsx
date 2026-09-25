"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Lightbox, type LightboxPhoto } from "../Lightbox";
import { Eyebrow, RecordCard, RowCard, SponsorCard, photoAlt } from "./pieces";
import { STREAM_PAGE, type LookRecord, type LookRow } from "./view";

/* THE STREAM (owner, 2026-09-25: "mostly I want a scroll page: scroll
 * through my friends' submissions"): one card per row, newest first, a
 * record card every eighth card and one sponsor slot among them. It
 * paginates in place — STREAM_PAGE cards, then SHOW MORE as a word — so
 * 400 friends do not put a month of cards in the first paint; the loader
 * already stopped at STREAM_CAP rows and the stream then ends on the feed
 * page. The lightbox reel is every photo of every card shown, so a tap on
 * any thumb pages through the lot. */

/* Where the cards between the rows go: a record card after every eighth
 * row, and the sponsor slot once, after the fourth (where a reader has
 * warmed up but not yet scrolled past the fold on a phone). */
const RECORD_EVERY = 8;
const SPONSOR_AFTER = 4;

function useReel(rows: LookRow[]): { reel: LightboxPhoto[]; offsetOf: Record<string, number> } {
  return useMemo(() => {
    const reel: LightboxPhoto[] = [];
    const offsetOf: Record<string, number> = {};
    for (const r of rows) {
      offsetOf[r.id] = reel.length;
      r.photos.forEach((p, i) => reel.push({ full: p.full, alt: photoAlt(r, i) }));
    }
    return { reel, offsetOf };
  }, [rows]);
}

export function Stream({
  rows,
  records,
  monthLabel,
  eliteHref,
  feedHref,
  capped,
  title,
  aside,
  /* Look c prints the record cards itself above the stream; the stream
   * then carries the sponsor slot only. */
  cards = true,
  /* The wall (look e) hands the stream a smaller first page. */
  page = STREAM_PAGE,
}: {
  rows: LookRow[];
  records: { men: LookRecord | null; women: LookRecord | null };
  monthLabel: string;
  eliteHref: string;
  feedHref: string;
  capped: boolean;
  title?: ReactNode;
  aside?: ReactNode;
  cards?: boolean;
  page?: number;
}) {
  const [shown, setShown] = useState(page);
  const [idx, setIdx] = useState<number | null>(null);
  const { reel, offsetOf } = useReel(rows);
  const visible = rows.slice(0, shown);
  const more = rows.length - visible.length;

  const items: ReactNode[] = [];
  visible.forEach((r, i) => {
    items.push(<RowCard key={r.id} row={r} eliteHref={eliteHref} onOpen={(p) => setIdx(offsetOf[r.id] + p)} />);
    const n = i + 1;
    if (cards && n % RECORD_EVERY === 0) items.push(<RecordCard key={`rec${n}`} records={records} monthLabel={monthLabel} />);
    if (n === SPONSOR_AFTER && rows.length > SPONSOR_AFTER) items.push(<SponsorCard key="spon" />);
  });

  return (
    <section className="lk-stream">
      {title != null ? <Eyebrow aside={aside}>{title}</Eyebrow> : null}
      {rows.length === 0 ? (
        <p className="lk-empty mono">Nobody you follow has rowed this month yet.</p>
      ) : (
        <div className="lk-cards">{items}</div>
      )}
      {more > 0 ? (
        <p className="lk-more mono">
          <button type="button" className="lk-word" onClick={() => setShown((s) => s + page)}>
            Show more
          </button>
          <span className="dim"> · {more} left</span>
        </p>
      ) : capped ? (
        <p className="lk-more mono">
          <a className="lk-word" href={feedHref}>
            The feed
          </a>
          <span className="dim"> · everything else</span>
        </p>
      ) : null}

      {idx != null && reel.length > 0 && (
        <Lightbox photos={reel} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </section>
  );
}
