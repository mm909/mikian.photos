"use client";

import { useMemo, type ReactNode } from "react";
import { BlockClock, Blocks } from "../../Blackout";
import type { LightboxPhoto } from "../../Lightbox";
import type { FeedPhoto } from "../FeedViews";
import type { DayTotal, FeedDayGroup, FeedLookItem } from "./view";

/* The pieces the three feed looks share. Client module: the thumbs carry
 * the onError swap and the looks hold the lightbox index, so everything
 * here rides in the same bundle. Every figure of a rower's is printed
 * through MetersOf / ClockOf, which draw blocks for a masked row — the
 * item carries no number of theirs anyway (page.tsx blanks the strings
 * before they reach a client component), only the shapes. */

export function feedPhotoAlt(item: FeedLookItem, i: number): string {
  return i === 0 ? `${item.name} after the row` : "Erg screen";
}

/* The page-wide reel: every photo flattened in page order (newest row
 * first; rower photo before the erg shot within a row), always at FULL
 * resolution — thumbs are for the page only. offsetOf[id] is the reel
 * index of that row's first photo, so a look can open any thumb and the
 * reader arrows through the whole page; in the gallery the erg screen is
 * simply the next frame. */
export function useReel(items: FeedLookItem[]): { reel: LightboxPhoto[]; offsetOf: Record<string, number> } {
  return useMemo(() => {
    const reel: LightboxPhoto[] = [];
    const offsetOf: Record<string, number> = {};
    for (const item of items) {
      offsetOf[item.id] = reel.length;
      item.photos.forEach((p, i) => reel.push({ full: p.full, alt: feedPhotoAlt(item, i) }));
    }
    return { reel, offsetOf };
  }, [items]);
}

/* One thumb: a bare button around a plain lazy img on the CDN thumb URL,
 * which is emitted without an existence check (that check used to cost a
 * bucket listing per render) — the rare thumb that never landed 404s once
 * and the img swaps to the full frame. Once: a dead full frame must not
 * loop. `hires` loads the full frame outright (still lazy): the gallery
 * tile renders at ~370px on the column and 335px on a phone, and the 320px
 * thumb (scripts/row100k-thumbs.ts EDGE) upscales there — soft at 1x,
 * blurry at 2x/3x, which would have skewed the pick against the
 * photo-first look. The full frame is capped at 1600px (PhotoPair
 * MAX_EDGE), a sane tile source, and it is the same URL the lightbox loads,
 * so opening a tile hits the cache. Nothing to swap to if it 404s. */
export function Thumb({
  photo,
  alt,
  className,
  hires,
  onOpen,
}: {
  photo: FeedPhoto;
  alt: string;
  className?: string;
  hires?: boolean;
  onOpen: () => void;
}) {
  return (
    <button type="button" className={`fd-pic${className ? ` ${className}` : ""}`} onClick={onOpen}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hires ? photo.full : (photo.thumb ?? photo.full)}
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

/* The dashed square a row with no photos keeps, so the edge stays lined
 * up (the strips) or the cell still exists (the gallery). */
export function NoPhoto({ className, children }: { className?: string; children?: ReactNode }) {
  return <span className={`fd-noph${className ? ` ${className}` : ""}`}>{children ?? "—"}</span>;
}

/* "SEP 5 — 43,210 M · 12 ROWS": ONE small mono line as the owner spelled
 * it — the day, a dash, the WHOLE day's total (every row that landed that
 * day, not only this page's — the wire reads like a day's summary line
 * even when a day runs over a page break). Inline, not justified to the
 * edges: on the 760px column the two halves sat 500px apart and read as
 * two labels. `blue` sets the figure in water for the strips. A day the
 * totals query could not cover prints the day alone. While a window is
 * open the figure is the visible rows' sum and "· 1 hidden" says what it
 * leaves out (see DayTotal); no elite's meters are on the page or
 * subtractable from it. */
export function DayHead({ group, total, blue }: { group: FeedDayGroup; total?: DayTotal; blue?: boolean }) {
  return (
    <h3 className="fd-dayh">
      <span>{group.dayStr}</span>
      {total ? (
        <span className="r">
          {"— "}
          {blue ? <b>{total.meters.toLocaleString("en-US")} m</b> : `${total.meters.toLocaleString("en-US")} m`}
          {" · "}
          {total.rows} {total.rows === 1 ? "row" : "rows"}
          {total.hidden > 0 ? ` · ${total.hidden} hidden` : ""}
        </span>
      ) : null}
    </h3>
  );
}

/* A row's meters: blocks of the right width while masked. */
export function MetersOf({ item }: { item: FeedLookItem }) {
  return item.masked ? (
    <>
      <Blocks digits={item.digits ?? 1} /> m
    </>
  ) : (
    <>{item.metersStr}</>
  );
}

/* A row's time: the clock's silhouette while masked. */
export function ClockOf({ item }: { item: FeedLookItem }) {
  return item.masked ? <BlockClock shape={item.timeShape} /> : <>{item.durationStr}</>;
}

/* Number then NAME, the name a link to the rower page. `title` on the
 * link carries the session title where a look has no room for it. */
export function Who({ item, title }: { item: FeedLookItem; title?: boolean }) {
  return (
    <>
      <span className="fd-n">{item.numStr}</span>
      <a className="fd-who" href={`/row100k/r/${item.rowerNumber}`} title={title && item.title ? item.title : undefined}>
        {item.name}
      </a>
    </>
  );
}
