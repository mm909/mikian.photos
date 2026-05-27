"use client";

export type LibraryTilePhoto = {
  id: string;
  previewUrl: string;
  hidden: boolean;
  bibs: { bib: number }[];
};

type Props = {
  p: LibraryTilePhoto;
  /** OCR currently running on this photo? Drives the pulse dot. */
  running?: boolean;
  /** Open the detail modal (the only interaction this tile supports). */
  onOpen: () => void;
};

/**
 * Library / dashboard tile.
 *
 * Click anywhere → open the detail modal. That's it. All the per-photo actions
 * (rerun OCR, hide, delete) used to live in a hover ⋯ menu here; they're now
 * exclusive to the modal so the grid stays calm and you reach for actions only
 * after deciding which photo you want.
 *
 * - Tile is a square; photo fills it with object-fit: cover so the grid stays
 *   dense — letterboxed contain showed too much cream around portrait shots.
 *   The detail modal still uses contain so the full frame is always visible
 *   on click.
 * - Hidden photos render at half-opacity with a Hidden chip.
 * - Pulse dot in the corner while OCR is running in the background.
 */
export function LibraryTile({ p, running = false, onOpen }: Props) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title={p.bibs.length ? `Bibs ${p.bibs.map((b) => b.bib).join(", ")}` : "Open photo"}
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        background: "var(--cream)",
        cursor: "pointer",
        overflow: "hidden",
        borderRadius: 2,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.previewUrl}
        alt=""
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: p.hidden ? 0.45 : 1,
        }}
      />

      {p.hidden && (
        <span
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "2px 6px",
            borderRadius: 3,
            pointerEvents: "none",
          }}
        >
          Hidden
        </span>
      )}

      {running && (
        <span
          aria-label="ocr running"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--accent)",
            boxShadow: "0 0 0 2px rgba(245,242,236,.85)",
            animation: "pulse 1.4s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
