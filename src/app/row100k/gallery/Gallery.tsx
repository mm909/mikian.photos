"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryPhoto = { src: string; alt: string };

/* A frame whose natural aspect is wider than this fights the portrait cell,
 * so it letterboxes (contain on white) instead of cropping (cover). */
const LANDSCAPE_RATIO = 1.15;

/* Horizontal pointer travel (px) that counts as a swipe in the lightbox. */
const SWIPE_PX = 40;

function Tile({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const [letterbox, setLetterbox] = useState(false);

  // Cover by default; flip to contain-on-white once the image reports a
  // strongly landscape natural size. Also checked via ref for cached images
  // whose load event can fire before React attaches the handler.
  const check = useCallback((im: HTMLImageElement | null) => {
    if (im && im.complete && im.naturalHeight > 0 && im.naturalWidth / im.naturalHeight > LANDSCAPE_RATIO) {
      setLetterbox(true);
    }
  }, []);

  return (
    <button
      type="button"
      className={letterbox ? "gal-tile gal-letterbox" : "gal-tile"}
      onClick={onOpen}
      aria-label={`${photo.alt} — open viewer`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        ref={check}
        onLoad={(e) => check(e.currentTarget)}
      />
    </button>
  );
}

export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const [idx, setIdx] = useState<number | null>(null);
  const swipeStart = useRef<number | null>(null);
  const count = photos.length;

  const step = useCallback(
    (delta: number) => {
      setIdx((cur) => (cur == null ? cur : (cur + delta + count) % count));
    },
    [count]
  );

  // Keyboard: arrows advance, Escape closes.
  useEffect(() => {
    if (idx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, step]);

  // Lock body scroll while the viewer is open.
  useEffect(() => {
    if (idx == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [idx == null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload the two neighbors so arrowing feels instant.
  useEffect(() => {
    if (idx == null || count < 2) return;
    for (const d of [-1, 1]) {
      const im = new window.Image();
      im.src = photos[(idx + d + count) % count].src;
    }
  }, [idx, count, photos]);

  // One pointer handler pair on the overlay covers both gestures: a long
  // horizontal drag anywhere is a swipe, a short tap on the backdrop itself
  // (not the photo or a button) closes.
  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start == null) return;
    const delta = e.clientX - start;
    if (Math.abs(delta) > SWIPE_PX) {
      step(delta < 0 ? 1 : -1);
    } else if (e.target === e.currentTarget) {
      setIdx(null);
    }
  };

  return (
    <>
      <p className="gal-count">
        {count} {count === 1 ? "PHOTO" : "PHOTOS"}
      </p>

      <div className="gal-grid">
        {photos.map((p, i) => (
          <Tile key={p.src} photo={p} onOpen={() => setIdx(i)} />
        ))}
      </div>

      {idx != null && (
        <div
          className="gal-lb"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[idx].src} alt={photos[idx].alt} draggable={false} />

          <button
            type="button"
            className="gal-lb-arrow gal-lb-prev"
            onClick={() => step(-1)}
            aria-label="Previous photo"
          >
            &#10094;
          </button>
          <button
            type="button"
            className="gal-lb-arrow gal-lb-next"
            onClick={() => step(1)}
            aria-label="Next photo"
          >
            &#10095;
          </button>
          <button
            type="button"
            className="gal-lb-close"
            onClick={() => setIdx(null)}
            aria-label="Close viewer"
          >
            &#10005;
          </button>

          <span className="gal-lb-counter">
            {idx + 1} / {count}
          </span>
        </div>
      )}
    </>
  );
}
