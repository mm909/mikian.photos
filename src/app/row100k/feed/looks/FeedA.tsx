"use client";

import { useState } from "react";
import { Lightbox } from "../../Lightbox";
import { ClockOf, DayHead, MetersOf, Thumb, Who, feedPhotoAlt, useReel } from "./pieces";
import { groupByDay, type DayTotal, type FeedLookItem } from "./view";

/* LOOK A — THE WIRE. A newswire: under each day head (the day, its whole
 * total, a dashed rule) every row is ONE dense mono line — the clock it
 * landed, the number, the NAME, then the meters in blue, the time and the
 * split in right-aligned columns so the figures stack down the page, and
 * the two 40px thumbs at the end opening the lightbox. Nothing boxed;
 * dashed hairlines between lines. The session title rides in the title
 * attribute of the name — the line has no room for it. Under 640px the
 * line folds in two, who over figures, the thumbs spanning both. A masked
 * row draws blocks for the meters and the time and no split. */
export function FeedA({ items, days }: { items: FeedLookItem[]; days: Record<string, DayTotal> }) {
  const [idx, setIdx] = useState<number | null>(null);
  const { reel, offsetOf } = useReel(items);

  return (
    <div className="fd-list">
      {groupByDay(items).map((g) => (
        <section key={g.dayKey} className="fd-day">
          <DayHead group={g} total={days[g.dayKey]} />
          {g.items.map((it) => (
            <article key={it.id} className="fd-line">
              <span className="fd-a">
                <span className="fd-t" title={it.absIso}>
                  {it.clockStr}
                </span>
                <Who item={it} title />
              </span>
              <span className="fd-b">
                <span className="fd-m">
                  <MetersOf item={it} />
                </span>
                <span className="fd-d">
                  <ClockOf item={it} />
                </span>
                {!it.masked && <span className="fd-s">{it.splitStr}</span>}
              </span>
              {it.photos.length > 0 && (
                <span className="fd-pics">
                  {it.photos.map((p, i) => (
                    // Index key: two demo squares in one row can share a
                    // colour, so the URL alone is not unique.
                    <Thumb key={i} photo={p} alt={feedPhotoAlt(it, i)} onOpen={() => setIdx(offsetOf[it.id] + i)} />
                  ))}
                </span>
              )}
            </article>
          ))}
        </section>
      ))}

      {idx != null && reel.length > 0 && (
        <Lightbox photos={reel} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </div>
  );
}
