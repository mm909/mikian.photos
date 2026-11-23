"use client";

import { useState } from "react";
import { Lightbox } from "../../../Lightbox";
import type { FeedPhoto } from "../../../feed/view";

/* THE TWO PHOTOS OF ONE ROW, large, side by side: the rower, then the
 * monitor. A press opens them whole in the site's own lightbox, as a thumb
 * on the feed does. Client module for that alone; the addresses are the
 * ones the server already decided this viewer may have. */
export function RowPhotos({ photos, alts }: { photos: FeedPhoto[]; alts: string[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <div className={`rw-pics${photos.length === 1 ? " one" : ""}`}>
      {photos.map((p, i) => (
        <button key={i} type="button" className="fd-pic" onClick={() => setIdx(i)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.full} alt={alts[i] ?? ""} />
        </button>
      ))}
      {idx != null && (
        <Lightbox photos={photos.map((p, i) => ({ full: p.full, alt: alts[i] }))} index={idx} onIndex={setIdx} onClose={() => setIdx(null)} />
      )}
    </div>
  );
}
