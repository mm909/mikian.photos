"use client";

import { useMemo, useState } from "react";
import { BlockClock, Blocks } from "../Blackout";
import { Lightbox, type LightboxPhoto } from "../Lightbox";

/* The feed's PHOTO LEDGER strips — the winner of the dev log drafts
 * (option 4), adapted for the public feed: photos anchor the left edge,
 * a dashed divider, then the name, the Pacific stamp eyebrow, and the
 * numbers with meters loudest. No actions rail here — the share/edit/
 * delete menu belongs to the editable log, not the public feed. The
 * server does every computation — formatting, stamps, photo media URLs —
 * and this component renders the given shape. Client-side it holds ONE
 * piece of state: which photo the shared Lightbox is showing. Every
 * photo on the page joins one flattened reel (rows in page order, newest
 * first; rower photo before erg shot within a row), so a reader can open
 * any thumb and arrow through the whole page. */

/* One photo's display URLs: the public CDN full image plus its grid-sized
 * thumb (null only for shapes that carry none — the server always sends one
 * today, and a thumb that 404s swaps to the full frame in Pics). Structurally
 * compatible with PhotoMedia in photoUrls.ts; declared locally so this client
 * file never imports from the server-only module. */
export type FeedPhoto = {
  full: string;
  thumb: string | null;
};

export type FeedItem = {
  id: string;
  /* "SEP 2 · 3:54 PM" — absolute Pacific stamp of when the row landed
   * (createdAt shifted minus 7 hours, the repo convention) */
  whenStr: string;
  /* the exact UTC instant as an ISO string, for the title attribute */
  absIso: string;
  rowerNumber: number;
  /* "023" */
  numStr: string;
  name: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  /* session title, may be "" */
  title: string;
  /* resolved photo media, rower photo first — stable public CDN URLs for
   * real keys, inline SVG data URIs for demo color squares; empty when the
   * row has no photos or photos can't be served on this deploy */
  photos: FeedPhoto[];
  /* Blackout (blackoutRules.ts): the rower is one of the hidden fifteen —
   * metersStr, durationStr and splitStr are all "", `digits` says how many
   * blocks to draw in the meters slot and `timeShape` ("#:##:##") is the
   * silhouette of the time. No number of theirs is in this object. */
  masked?: boolean;
  digits?: number;
  timeShape?: string;
};

function photoAlt(item: FeedItem, i: number): string {
  return i === 0 ? `${item.name} after the row` : "Erg screen";
}

/* Left cell: ~64px thumbs opening the shared Lightbox at this photo's slot
 * in the page-wide reel; a row with no photos shows one dashed placeholder
 * square so the left edge stays aligned. The thumb URL is emitted without an
 * existence check (that check used to cost a bucket listing per render), so
 * the one thumb that never landed 404s and the img swaps to the full frame
 * — once: a dead full frame must not loop. */
function Pics({
  item,
  offset,
  onOpen,
}: {
  item: FeedItem;
  /* global reel index of this row's first photo */
  offset: number;
  onOpen: (globalIndex: number) => void;
}) {
  if (item.photos.length === 0) {
    return <span className="fl-noph">—</span>;
  }
  return (
    <>
      {item.photos.map((p, i) => (
        // Index key: two demo squares in one row can share a color, so the
        // URL alone isn't unique.
        <button key={i} type="button" onClick={() => onOpen(offset + i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.thumb ?? p.full}
            alt={photoAlt(item, i)}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              // The raw attribute, not .src: the getter resolves URLs and
              // would never compare equal to a data: or relative value.
              if (img.getAttribute("src") !== p.full) img.src = p.full;
            }}
          />
        </button>
      ))}
    </>
  );
}

function LedgerStrip({
  item,
  offset,
  onOpen,
}: {
  item: FeedItem;
  offset: number;
  onOpen: (globalIndex: number) => void;
}) {
  return (
    <article className="fl-strip">
      <span className="fl-left">
        <Pics item={item} offset={offset} onOpen={onOpen} />
      </span>

      <span className="fl-mid">
        {/* Who — bold ink, bib + name, linking to the rower page. */}
        <span className="fl-who">
          <a href={`/row100k/r/${item.rowerNumber}`}>
            {item.numStr} · {item.name}
          </a>
        </span>

        {/* Eyebrow: the Pacific stamp (UTC instant in the title attribute),
         * then the session title on the same line when there is one. */}
        <span className="fl-meta">
          <span title={item.absIso}>{item.whenStr}</span>
          {item.title ? <span>{item.title}</span> : null}
        </span>

        {/* The hierarchy: meters loudest, then the time, then the pace. A
            hidden row draws blocks where the meters AND the time go, and no
            pace at all — the split with either would hand the number back. */}
        <span className="fl-nums">
          <span className="fl-m">
            {item.masked ? (
              <>
                <Blocks digits={item.digits ?? 1} /> m
              </>
            ) : (
              item.metersStr
            )}
          </span>
          <span className="fl-t">
            {item.masked ? <BlockClock shape={item.timeShape} /> : item.durationStr}
          </span>
          {!item.masked && <span className="fl-s">{item.splitStr} /500M</span>}
        </span>
      </span>
    </article>
  );
}

export function FeedViews({ items }: { items: FeedItem[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // The page-wide reel: every photo flattened in strip order (the server
  // sends rows newest first; each row keeps the rower photo before the erg
  // shot), always at FULL resolution — thumbs are for the 64px strip only.
  // offsets[i] is the reel index of item i's first photo.
  const { reel, offsets } = useMemo(() => {
    const reel: LightboxPhoto[] = [];
    const offsets: number[] = [];
    for (const item of items) {
      offsets.push(reel.length);
      item.photos.forEach((p, i) => {
        reel.push({ full: p.full, alt: photoAlt(item, i) });
      });
    }
    return { reel, offsets };
  }, [items]);

  return (
    <div>
      {items.map((item, i) => (
        <LedgerStrip key={item.id} item={item} offset={offsets[i]} onOpen={setLightboxIndex} />
      ))}

      {lightboxIndex != null && reel.length > 0 && (
        <Lightbox
          photos={reel}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
