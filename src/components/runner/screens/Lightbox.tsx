"use client";

import { useEffect, useState } from "react";
import { Headline } from "../Headline";
import { Pager } from "@/components/photographer/Pager";
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

/** Thumbnails per page in the right-rail gallery grid. */
const PAGE_SIZE = 12;

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
  const idx = photos.findIndex((p) => p.id === photo.id);

  // Paged thumbnail grid over the FULL result set. The page follows the
  // selected photo (arrow keys / prev-next), but the runner can also page
  // manually to browse ahead.
  const pageCount = Math.max(1, Math.ceil(photos.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [idx]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pagePhotos = photos.slice(pageStart, pageStart + PAGE_SIZE);

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
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              aspectRatio: "2/3",
              borderRadius: 6,
              overflow: "hidden",
              boxShadow: "var(--shadow-lg)",
              background: photo.previewUrl ? "var(--cream)" : photoBg(photo),
            }}
          >
            {photo.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.previewUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}
          </div>

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
        </div>

        {/* buy pane — scrollable gallery up top, sticky price + CTA at the
            bottom (below the images). */}
        <div
          className="lightbox-buy-pane"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* header */}
          <div
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

          {/* scrollable gallery grid over all photos */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 28px 8px", minHeight: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              All {totalCount} photos
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {pagePhotos.map((p) => {
                const isCurr = p.id === photo.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => onJump(p)}
                    style={{
                      position: "relative",
                      aspectRatio: "2/3",
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
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {pageCount > 1 && (
              <div style={{ marginTop: 14 }}>
                <Pager
                  page={page}
                  pageCount={pageCount}
                  total={photos.length}
                  pageSize={PAGE_SIZE}
                  onGo={setPage}
                />
              </div>
            )}
          </div>

          {/* sticky footer — price block + CTA, below the images */}
          <div
            style={{
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
                className="btn btn--green btn--block btn--lg"
                onClick={() => onBundle(true)}
              >
                ✓ Added — Checkout →
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
