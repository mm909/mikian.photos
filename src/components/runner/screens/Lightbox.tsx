"use client";

import { useEffect, useRef, useState } from "react";
import { Headline } from "../Headline";
import { currentEvent, photoBg, type Cart, type Photo } from "@/lib/data";

/** Instagram-style windowed position dots.
 *  Returns up to MAX visible indices centered on `current` (clamped into range),
 *  each tagged with a size that tapers toward any edge that has MORE photos
 *  beyond it: outermost = "sm", next in = "md", everything else "lg". An edge
 *  that's already at the very start/end stays full-size ("lg"). */
function dotWindow(total: number, current: number) {
  const MAX = 7;
  if (total <= 0) return [] as { index: number; size: "sm" | "md" | "lg" }[];
  const size = Math.min(MAX, total);
  const half = Math.floor(MAX / 2); // 3
  // Clamp the window so it never runs past either end of the list.
  const start = Math.max(0, Math.min(current - half, total - size));
  const end = start + size - 1;
  const hasMoreBefore = start > 0;
  const hasMoreAfter = end < total - 1;
  const dots: { index: number; size: "sm" | "md" | "lg" }[] = [];
  for (let i = start; i <= end; i++) {
    const fromStart = i - start;
    const fromEnd = end - i;
    let s: "sm" | "md" | "lg" = "lg";
    if (hasMoreBefore) {
      if (fromStart === 0) s = "sm";
      else if (fromStart === 1) s = "md";
    }
    if (hasMoreAfter) {
      if (fromEnd === 0) s = "sm";
      else if (fromEnd === 1) s = "md";
    }
    dots.push({ index: i, size: s });
  }
  return dots;
}

type Props = {
  photo: Photo;
  photos: Photo[];
  cart: Cart;
  totalCount: number;
  bundleInCart: boolean;
  /** Owner-set bundle price (dollars) for the event. */
  price: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onJump: (p: Photo) => void;
  // legacy single-photo API kept for compatibility, no-op in bundle-only mode
  onAdd: (p: Photo, alreadyIn: boolean) => void;
  onBundle: (alreadyIn: boolean) => void;
};

export function Lightbox({
  photo,
  photos,
  totalCount,
  bundleInCart,
  price,
  onClose,
  onPrev,
  onNext,
  onJump,
  onBundle,
}: Props) {
  // Paged thumbnail gallery — show PAGE at a time instead of a long scroll.
  // The page follows the current photo (so arrow-key nav shifts the page), and
  // the ‹ › buttons below browse pages directly.
  const PAGE = 8;
  const idx = photos.findIndex((p) => p.id === photo.id);
  const pages = Math.max(1, Math.ceil(photos.length / PAGE));
  const [galleryPage, setGalleryPage] = useState(0);
  useEffect(() => {
    if (idx >= 0) setGalleryPage(Math.floor(idx / PAGE));
  }, [idx]);
  const galStart = galleryPage * PAGE;
  const pagePhotos = photos.slice(galStart, galStart + PAGE);

  // Mobile browse affordances ------------------------------------------------
  // One-time "Swipe or tap to browse" hint that auto-fades shortly after the
  // lightbox first opens. (Only ever shown once per mount; harmless on desktop.)
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // Swipe: track the touch start so a horizontal drag past the threshold flips
  // photos, while guarding the tap zones from double-firing after a swipe.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  // Set true when the last gesture was a real swipe, so the synthetic click the
  // browser fires afterwards on a tap zone gets swallowed (no double advance).
  // Reset on the next touchstart rather than in touchend, since the click fires
  // AFTER touchend and needs to still see this flag.
  const swipedRef = useRef(false);
  const SWIPE_PX = 50;
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Only treat as a swipe when the gesture is dominantly horizontal and past
    // the threshold. Mark it so the trailing synthetic tap-zone click is ignored.
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      if (dx < 0) onNext();
      else onPrev();
    }
  }
  // If a tap zone's click lands right after a real swipe, swallow it.
  function onTapZone(go: () => void) {
    return () => {
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      go();
    };
  }

  const dots = dotWindow(photos.length, idx < 0 ? 0 : idx);

  return (
    <div className="overlay" onClick={onClose} style={{ background: "rgba(28,26,23,.78)" }}>
      <div
        className="lightbox-grid"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 1140,
          width: "100%",
          background: "var(--paper)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          overflow: "hidden",
          maxHeight: "92vh",
        }}
      >
        {/* photo pane */}
        <div
          className="lightbox-photo-pane"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: "relative",
            background: "var(--cream)",
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 460,
          }}
        >
          {/* Mobile-only top control row — sits cleanly ABOVE the image so the
              close × never overlaps the photo subject. A thin scrim keeps it
              legible over light photos. Hidden on desktop (the buy-pane header
              owns the × there). */}
          <div className="lightbox-topbar" aria-hidden={false}>
            <button
              onClick={onClose}
              className="icon-btn lightbox-mobile-close"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {photo.previewUrl ? (
            // Contain (not cover) + natural aspect so the full photo shows —
            // race shots are mostly landscape and were getting cropped.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.previewUrl}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "min(74vh, 660px)",
                objectFit: "contain",
                borderRadius: 6,
                boxShadow: "var(--shadow-lg)",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                maxWidth: 480,
                aspectRatio: "2/3",
                borderRadius: 6,
                background: photoBg(photo),
                boxShadow: "var(--shadow-lg)",
              }}
            />
          )}

          {/* Mobile: big invisible left/right tap zones so you can flick through
              photos by tapping the sides — not just the small arrows. They're
              transparent (don't cover the photo). The guard swallows the click
              when it lands right after a swipe so you never advance twice. */}
          <button
            type="button"
            onClick={onTapZone(onPrev)}
            className="lightbox-tapzone lightbox-tapzone--left"
            aria-label="Previous photo"
          />
          <button
            type="button"
            onClick={onTapZone(onNext)}
            className="lightbox-tapzone lightbox-tapzone--right"
            aria-label="Next photo"
          />

          {/* Desktop arrows — hidden on mobile (use tap/swipe there instead). */}
          <button
            onClick={onPrev}
            className="icon-btn lightbox-arrow"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#fff",
              zIndex: 3,
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={onNext}
            className="icon-btn lightbox-arrow"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#fff",
              zIndex: 3,
            }}
            aria-label="Next"
          >
            ›
          </button>

          {/* Instagram-style position dots — a windowed set (max 7) that tapers
              toward whichever side has more photos. Tap a dot to jump. Shows on
              all sizes; on desktop the arrows stay the primary control. */}
          {photos.length > 1 && (
            <div className="lightbox-dots" role="tablist" aria-label="Photo position">
              {dots.map((d) => {
                const isActive = d.index === idx;
                return (
                  <button
                    key={d.index}
                    type="button"
                    onClick={() => onJump(photos[d.index])}
                    className={`lightbox-dot lightbox-dot--${d.size}${
                      isActive ? " lightbox-dot--active" : ""
                    }`}
                    aria-label={`Photo ${d.index + 1}`}
                    aria-current={isActive ? "true" : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* One-time, auto-fading hint that the photo is tap/swipe-able.
              Mobile-only (see CSS); soft + on-brand. */}
          <div className={`lightbox-hint${showHint ? " lightbox-hint--show" : ""}`} aria-hidden="true">
            Swipe or tap to browse
          </div>
        </div>

        {/* buy pane — scrollable gallery up top, sticky price + CTA at the
            bottom (below the images). */}
        <div
          className="lightbox-buy-pane"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            // Stretch to the full height of the photo column so the gallery
            // scrolls in the middle and the price + checkout CTA stay pinned
            // to the bottom of the panel.
          }}
        >
          {/* header */}
          <div
            className="lightbox-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px 28px 0",
            }}
          >
            <Headline
              as="h2"
              text={currentEvent.name.join(" ")}
              accent={currentEvent.name[0]}
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 26,
                lineHeight: 1.1,
                letterSpacing: "-.012em",
              }}
            />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          {/* "All N photos" — stays put above the scroll area. */}
          <div
            className="lightbox-gallery"
            style={{
              padding: "16px 28px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            All {totalCount} photos
          </div>

          {/* Paged gallery — show PAGE thumbnails at a time (no long scroll).
              Each tile uses object-fit:contain so the whole frame shows exactly
              as shot — never cropped. (Top padding keeps the selected tile's
              outline from being clipped by the scroll area.) Scrolls between the
              header and the pinned checkout footer below. */}
          <div
            className="lightbox-gallery"
            style={{
              padding: "4px 28px 12px",
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {pagePhotos.map((p) => {
                const isCurr = p.id === photo.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onJump(p)}
                    style={{
                      position: "relative",
                      aspectRatio: "2 / 3",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: p.previewUrl ? "var(--cream)" : photoBg(p),
                      outline: isCurr ? "2px solid var(--accent)" : "0",
                      outlineOffset: 2,
                      overflow: "hidden",
                    }}
                  >
                    {p.previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.previewUrl}
                        alt=""
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {pages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <button
                  className="icon-btn"
                  onClick={() => setGalleryPage((g) => Math.max(0, g - 1))}
                  disabled={galleryPage <= 0}
                  aria-label="Previous photos"
                  style={{ background: "#fff" }}
                >
                  ‹
                </button>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".1em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {galStart + 1}–{Math.min(galStart + PAGE, photos.length)} of {photos.length}
                </span>
                <button
                  className="icon-btn"
                  onClick={() => setGalleryPage((g) => Math.min(pages - 1, g + 1))}
                  disabled={galleryPage >= pages - 1}
                  aria-label="More photos"
                  style={{ background: "#fff" }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* footer — price block + CTA, pinned to the bottom below the images */}
          <div
            style={{
              marginTop: "auto",
              borderTop: "1px solid var(--line)",
              padding: "18px 28px 24px",
              background: "var(--paper)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 15, color: "var(--ink)" }}>
                  Every photo from your race
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    color: "var(--muted)",
                    marginTop: 2,
                  }}
                >
                  All {totalCount} photos
                </div>
              </div>
              <span className="price" style={{ fontSize: 28 }}>
                ${price}
              </span>
            </div>

            {bundleInCart ? (
              <button
                className="btn btn--primary btn--block btn--lg"
                onClick={() => onBundle(true)}
              >
                Checkout →
              </button>
            ) : (
              <button
                className="btn btn--primary btn--block btn--lg"
                onClick={() => onBundle(false)}
              >
                Get all {totalCount} photos — ${price}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
