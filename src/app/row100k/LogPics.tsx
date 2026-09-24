"use client";

import type { LightboxPhoto } from "./Lightbox";

/* The photo pair on a log row, as 40px squares under the day (owner,
 * 2026-09-24: "show the photos on the table" — the ledger's strip, moved
 * into the table cell). The thumb renders, the full frame is the fallback
 * once if the thumb 404s (the server emits thumb URLs without an existence
 * check so it never has to list the bucket), and a tap hands the index up
 * so the caller opens the shared Lightbox over the whole log's reel.
 * Buttons, not links: the tap opens the reel, it does not leave the page.
 * Shared by the rower's own table (MyRows) and the visitor's (ProfileLog). */
export type LogMedia = { full: string; thumb: string | null };

export function whichPhoto(i: number): string {
  return i === 0 ? "the rower" : "the erg screen";
}

export function LogPics({
  media,
  onOpen,
  altFor,
}: {
  media: LogMedia[];
  onOpen: (i: number) => void;
  /* The alt text per photo; "The rower" / "The erg screen" when absent. */
  altFor?: (i: number) => string;
}) {
  if (media.length === 0) return null;
  return (
    <span className="lgt-pics">
      {media.map((m, i) => (
        /* Index in the key — demo colour squares can repeat a URL within a
         * pair. */
        <button
          key={`${m.full}#${i}`}
          type="button"
          aria-label={`View photo — ${whichPhoto(i)}`}
          onClick={() => onOpen(i)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.thumb ?? m.full}
            alt={altFor ? altFor(i) : i === 0 ? "The rower" : "The erg screen"}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              // The raw attribute, not .src: the getter resolves URLs and
              // would never compare equal to a data: or relative value.
              // Swap once — a dead full frame must not loop.
              if (img.getAttribute("src") !== m.full) img.src = m.full;
            }}
          />
        </button>
      ))}
    </span>
  );
}

/* One reel for a whole log: every row's photos flattened in the order the
 * rows are shown (rower before erg within a row), and each row's offset
 * into it — offsets[i] is row i's first photo, so a tap on a row's j-th
 * square opens the reel at offsets[i] + j. */
export function flattenReel<T>(
  rows: T[],
  mediaOf: (row: T) => LogMedia[],
  altOf: (row: T, i: number) => string,
): { reel: LightboxPhoto[]; offsets: number[] } {
  const reel: LightboxPhoto[] = [];
  const offsets: number[] = [];
  for (const r of rows) {
    offsets.push(reel.length);
    mediaOf(r).forEach((p, i) => reel.push({ full: p.full, alt: altOf(r, i) }));
  }
  return { reel, offsets };
}
