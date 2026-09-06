"use client";

import { useMemo, useState } from "react";
import { BlockClock, Blocks } from "../Blackout";
import { Lightbox, type LightboxPhoto } from "../Lightbox";
import { groupByDay, type DayTotal, type FeedDayGroup, type FeedItem, type FeedPhoto } from "./view";

/* THE FEED — the strips (the owner's pick, 2026-09-05). Under each Pacific
 * day head every row is a strip parted by dashed hairlines: the two 96px
 * thumbs on the left, then the session title on its own gray line, the
 * number · NAME line under it, the meters in Archivo Black at 26px, and
 * the time, the split and the clock it landed in mono under that. Nothing
 * boxed. A masked row draws blocks for the meters and the time and no
 * split — the item carries no number of theirs anyway (page.tsx blanks the
 * strings before they reach this client component), only the shapes.
 * Client module: the thumbs carry the onError swap and the page-wide
 * lightbox index lives here. */

function photoAlt(item: FeedItem, i: number): string {
  return i === 0 ? `${item.name} after the row` : "Erg screen";
}

/* The page-wide reel: every photo flattened in page order (newest row
 * first; rower photo before the erg shot within a row), always at FULL
 * resolution — thumbs are for the strips only. offsetOf[id] is the reel
 * index of that row's first photo, so opening any thumb lets the reader
 * arrow through the whole page. */
function useReel(items: FeedItem[]): { reel: LightboxPhoto[]; offsetOf: Record<string, number> } {
  return useMemo(() => {
    const reel: LightboxPhoto[] = [];
    const offsetOf: Record<string, number> = {};
    for (const item of items) {
      offsetOf[item.id] = reel.length;
      item.photos.forEach((p, i) => reel.push({ full: p.full, alt: photoAlt(item, i) }));
    }
    return { reel, offsetOf };
  }, [items]);
}

/* One thumb: a bare button around a plain lazy img on the CDN thumb URL,
 * which is emitted without an existence check (that check used to cost a
 * bucket listing per render) — the rare thumb that never landed 404s once
 * and the img swaps to the full frame. Once: a dead full frame must not
 * loop. */
function Thumb({ photo, alt, onOpen }: { photo: FeedPhoto; alt: string; onOpen: () => void }) {
  return (
    <button type="button" className="fd-pic" onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumb ?? photo.full}
        alt={alt}
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          // The raw attribute, not .src: the getter resolves URLs and would
          // never compare equal to a data: or relative value.
          if (img.getAttribute("src") !== photo.full) img.src = photo.full;
        }}
      />
    </button>
  );
}

/* The dashed square a row with no photos keeps, so the left edge stays
 * lined up. */
function NoPhoto() {
  return <span className="fd-noph">—</span>;
}

/* "SEP 5 — 43,210 M · 12 ROWS": ONE small mono line as the owner spelled
 * it — the day, a dash, the WHOLE day's total in blue (every row that
 * landed that day, not only this page's, every rower's meters included —
 * see DayTotal in view.ts), the row count. Inline, not justified to the
 * edges: on the 760px column the two halves sat 500px apart and read as
 * two labels. A day the totals query could not cover prints the day
 * alone. */
function DayHead({ group, total }: { group: FeedDayGroup; total?: DayTotal }) {
  return (
    <h2 className="fd-dayh">
      <span>{group.dayStr}</span>
      {total ? (
        <span className="r">
          {"— "}
          <b>{total.meters.toLocaleString("en-US")} m</b>
          {" · "}
          {total.rows} {total.rows === 1 ? "row" : "rows"}
        </span>
      ) : null}
    </h2>
  );
}

/* A row's meters: blocks of the right width while masked. */
function MetersOf({ item }: { item: FeedItem }) {
  return item.masked ? (
    <>
      <Blocks digits={item.digits ?? 1} /> m
    </>
  ) : (
    <>{item.metersStr}</>
  );
}

/* A row's time: the clock's silhouette while masked. */
function ClockOf({ item }: { item: FeedItem }) {
  return item.masked ? <BlockClock shape={item.timeShape} /> : <>{item.durationStr}</>;
}

function Strip({ item, onOpen }: { item: FeedItem; onOpen: (photoIndex: number) => void }) {
  return (
    <article className="fd-strip">
      <span className="fd-pics">
        {item.photos.length > 0 ? (
          item.photos.map((p, i) => (
            // Index key: two demo squares in one row can share a colour, so
            // the URL alone is not unique.
            <Thumb key={i} photo={p} alt={photoAlt(item, i)} onOpen={() => onOpen(i)} />
          ))
        ) : (
          <NoPhoto />
        )}
      </span>
      <span className="fd-mid">
        {/* The lead: the session title on its own line ABOVE the number and
         * the name (owner, 2026-09-05), in the gray title style; a row
         * without a title has no title line. */}
        <span className="fd-lead">
          {item.title ? <span className="fd-ttl">{item.title}</span> : null}
          <span className="fd-nm">
            <span className="fd-n">{item.numStr} ·</span>
            <a className="fd-who" href={`/row100k/r/${item.rowerNumber}`}>
              {item.name}
            </a>
          </span>
        </span>
        <span className="fd-m">
          <MetersOf item={item} />
        </span>
        <span className="fd-sub">
          <span className="fd-d">
            <ClockOf item={item} />
          </span>
          {!item.masked && <span className="fd-s">{item.splitStr} /500m</span>}
          <span className="fd-t" title={item.absIso}>
            {item.clockStr}
          </span>
        </span>
      </span>
    </article>
  );
}

export function Strips({ items, days }: { items: FeedItem[]; days: Record<string, DayTotal> }) {
  const [idx, setIdx] = useState<number | null>(null);
  const { reel, offsetOf } = useReel(items);

  return (
    <div className="fd-list">
      {groupByDay(items).map((g) => (
        <section key={g.dayKey} className="fd-day">
          <DayHead group={g} total={days[g.dayKey]} />
          {g.items.map((it) => (
            <Strip key={it.id} item={it} onOpen={(i) => setIdx(offsetOf[it.id] + i)} />
          ))}
        </section>
      ))}

      {idx != null && reel.length > 0 && (
        <Lightbox photos={reel} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </div>
  );
}
