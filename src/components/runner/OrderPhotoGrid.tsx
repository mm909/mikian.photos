"use client";

import { useState } from "react";

type Props = {
  photos: { id: string }[];
  /** JWT minted at order capture — required to authorize hi-res download. */
  downloadToken: string;
};

/**
 * Order-page photo grid.
 *
 * - Each tile is a clickable preview (loaded via /api/photos/[id]/preview —
 *   no token required, previews are public).
 * - Clicking the photo (or the explicit Download button) hits
 *   /api/photos/[id]/download?token=… which 302s to a presigned R2 URL of
 *   the hi-res original.
 * - "Download all" walks the list and triggers each download sequentially.
 *   Browsers will usually surface a permission prompt for batch downloads —
 *   we accept that and keep the flow simple.
 */
export function OrderPhotoGrid({ photos, downloadToken }: Props) {
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  function downloadHref(id: string): string {
    return `/api/photos/${id}/download?token=${encodeURIComponent(downloadToken)}`;
  }

  async function downloadOne(id: string) {
    setDownloading((s) => new Set(s).add(id));
    try {
      // Anchor click → browser handles the redirect + download dialog.
      const a = document.createElement("a");
      a.href = downloadHref(id);
      a.rel = "noopener";
      a.download = `${id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      // Small delay so the spinner is visible — actual transfer is async.
      setTimeout(() => {
        setDownloading((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 800);
    }
  }

  async function downloadAll() {
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: photos.length });
    for (let i = 0; i < photos.length; i++) {
      await downloadOne(photos[i].id);
      // Tiny stagger so the browser doesn't smush the prompts together.
      await new Promise((r) => setTimeout(r, 400));
      setBulkProgress({ done: i + 1, total: photos.length });
    }
    setBulkBusy(false);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <button
          className="btn btn--primary btn--sm"
          onClick={downloadAll}
          disabled={bulkBusy || photos.length === 0}
        >
          {bulkBusy
            ? `Downloading ${bulkProgress.done}/${bulkProgress.total}…`
            : `Download all ${photos.length}`}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {photos.map((p) => {
          const isDown = downloading.has(p.id);
          return (
            <div
              key={p.id}
              style={{
                position: "relative",
                aspectRatio: "3 / 2",
                background: "var(--cream)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <a
                href={downloadHref(p.id)}
                onClick={(e) => {
                  // Let the browser handle the link, but optimistically mark
                  // the tile as "downloading" so the user sees feedback.
                  setDownloading((s) => new Set(s).add(p.id));
                  setTimeout(() => {
                    setDownloading((s) => {
                      const next = new Set(s);
                      next.delete(p.id);
                      return next;
                    });
                  }, 800);
                  // Prevent stop the default — we want the browser to follow.
                  void e;
                }}
                download={`${p.id}.jpg`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  textDecoration: "none",
                }}
                title="Click to download full resolution"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}/preview`}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(28,26,23,.55) 0%, rgba(28,26,23,0) 50%)",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 8,
                    right: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--paper)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span>Hi-res</span>
                  <span>{isDown ? "Downloading…" : "Download ↓"}</span>
                </span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
