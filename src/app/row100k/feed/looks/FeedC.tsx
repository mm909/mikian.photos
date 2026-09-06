"use client";

import { useState } from "react";
import { Lightbox } from "../../Lightbox";
import { DayHead, MetersOf, NoPhoto, Thumb, Who, feedPhotoAlt, useReel } from "./pieces";
import { groupByDay, type DayTotal, type FeedLookItem } from "./view";

/* LOOK C — THE GALLERY. Photo first: under each day head a grid of the
 * ROWER photo of every session, square (object-fit cover), two across from
 * 640px (where the caption still fits one line) and one under it, a
 * one-line mono caption under each (number · NAME · meters · split) and
 * the clock and title in gray. The tile loads the full frame, not the
 * 320px thumb (Thumb `hires`): it renders bigger than the thumb on every
 * screen. The erg screen is not on the page — it is the next frame in the
 * lightbox (the reel keeps both photos of a row). A row without photos
 * keeps its cell as a dashed square, so no session goes missing from the
 * feed. A masked row draws blocks for the meters and no split. */
export function FeedC({ items, days }: { items: FeedLookItem[]; days: Record<string, DayTotal> }) {
  const [idx, setIdx] = useState<number | null>(null);
  const { reel, offsetOf } = useReel(items);

  return (
    <div className="fd-list">
      {groupByDay(items).map((g) => (
        <section key={g.dayKey} className="fd-day">
          <DayHead group={g} total={days[g.dayKey]} />
          <div className="fd-grid">
            {g.items.map((it) => (
              <article key={it.id} className="fd-cell">
                {it.photos.length > 0 ? (
                  <Thumb
                    photo={it.photos[0]}
                    alt={feedPhotoAlt(it, 0)}
                    className="fd-tile"
                    hires
                    onOpen={() => setIdx(offsetOf[it.id])}
                  />
                ) : (
                  <NoPhoto className="fd-tile">No photo</NoPhoto>
                )}
                <p className="fd-cap">
                  <Who item={it} />
                  <span className="fd-m">
                    <MetersOf item={it} />
                  </span>
                  {!it.masked && <span className="fd-s">{it.splitStr}</span>}
                </p>
                <p className="fd-ttl2">
                  <span title={it.absIso}>{it.clockStr}</span>
                  {it.title ? ` · ${it.title}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}

      {idx != null && reel.length > 0 && (
        <Lightbox photos={reel} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </div>
  );
}
