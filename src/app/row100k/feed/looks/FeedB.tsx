"use client";

import { useState } from "react";
import { Lightbox } from "../../Lightbox";
import { ClockOf, DayHead, MetersOf, NoPhoto, Thumb, feedPhotoAlt, useReel } from "./pieces";
import { groupByDay, type DayTotal, type FeedLookItem } from "./view";

/* LOOK B — THE STRIPS. The boxed photo ledger, unboxed: each row a strip
 * parted by dashed hairlines — the two 96px thumbs on the left, then the
 * name line (number · NAME · title), the meters in Archivo Black at 26px,
 * the time, the split and the clock it landed in mono under it. Day heads
 * carry the day's whole total as a small blue figure. A masked row draws
 * blocks for the meters and the time and no split. */
export function FeedB({ items, days }: { items: FeedLookItem[]; days: Record<string, DayTotal> }) {
  const [idx, setIdx] = useState<number | null>(null);
  const { reel, offsetOf } = useReel(items);

  return (
    <div className="fd-list">
      {groupByDay(items).map((g) => (
        <section key={g.dayKey} className="fd-day">
          <DayHead group={g} total={days[g.dayKey]} blue />
          {g.items.map((it) => (
            <article key={it.id} className="fd-strip">
              <span className="fd-pics">
                {it.photos.length > 0 ? (
                  it.photos.map((p, i) => (
                    <Thumb key={i} photo={p} alt={feedPhotoAlt(it, i)} onOpen={() => setIdx(offsetOf[it.id] + i)} />
                  ))
                ) : (
                  <NoPhoto />
                )}
              </span>
              <span className="fd-mid">
                <span className="fd-nm">
                  <span className="fd-n">{it.numStr} ·</span>
                  <a className="fd-who" href={`/row100k/r/${it.rowerNumber}`}>
                    {it.name}
                  </a>
                  {it.title ? <span className="fd-ttl">· {it.title}</span> : null}
                </span>
                <span className="fd-m">
                  <MetersOf item={it} />
                </span>
                <span className="fd-sub">
                  <span className="fd-d">
                    <ClockOf item={it} />
                  </span>
                  {!it.masked && <span className="fd-s">{it.splitStr} /500m</span>}
                  <span className="fd-t" title={it.absIso}>
                    {it.clockStr}
                  </span>
                </span>
              </span>
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
