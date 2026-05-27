import { Headline } from "../Headline";
import { currentEvent, photoBg, type Cart, type Photo } from "@/lib/data";

type Props = {
  photo: Photo;
  photos: Photo[];
  cart: Cart;
  totalCount: number;
  bundleInCart: boolean;
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
  onClose,
  onPrev,
  onNext,
  onJump,
  onBundle,
}: Props) {
  const idx = photos.findIndex((p) => p.id === photo.id);
  const more = photos.slice(0, 8);

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
              background: photoBg(photo),
            }}
          >
            <div className="thumb__wm" style={{ fontSize: 14 }}>
              MIKIAN.PHOTOS
            </div>
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
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {idx + 1} / {totalCount}
          </div>
        </div>

        {/* buy pane */}
        <div
          className="lightbox-buy-pane"
          style={{
            padding: 28,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {currentEvent.name.join(" ")}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <Headline
            as="h2"
            text={`Photo at Mile ${photo.mile}`}
            accent={`Mile ${photo.mile}`}
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: "-.012em",
            }}
          />
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--muted)" }}>
            Shot by {photo.photographer} · {photo.time}
          </div>

          {/* price block — bundle only */}
          <div
            style={{
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              padding: "18px 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
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
                  All {totalCount} photos · full resolution · yours to keep
                </div>
              </div>
              <span className="price" style={{ fontSize: 28 }}>
                $30
              </span>
            </div>
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
              Get all {totalCount} photos — $30
            </button>
          )}

          <div>
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
              More photos of you
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {more.map((p) => {
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
                      background: photoBg(p),
                      outline: isCurr ? "2px solid var(--accent)" : "0",
                      outlineOffset: 2,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
