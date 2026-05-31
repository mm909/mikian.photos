"use client";

import { useEffect, useState } from "react";
import { Headline } from "../Headline";
import { currentEvent, photoBg, type Cart, type Photo } from "@/lib/data";

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

          <button
            onClick={onPrev}
            className="icon-btn"
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#fff",
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={onNext}
            className="icon-btn"
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#fff",
            }}
            aria-label="Next"
          >
            ›
          </button>

          {/* Close — only shown on mobile, where the buy-pane header (with its
              own ×) is hidden and the photo sits on top. */}
          <button
            onClick={onClose}
            className="icon-btn lightbox-mobile-close"
            style={{ position: "absolute", top: 14, right: 14, background: "#fff" }}
            aria-label="Close"
          >
            ×
          </button>
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
