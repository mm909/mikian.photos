"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export type GridPhoto = { id: string; src: string };

type Props = {
  photos: GridPhoto[];
  /** Opens the viewer at this photo's index. */
  onOpen: (index: number) => void;
  /** Target row height in px (desktop). Scaled down on narrow viewports. */
  targetRowHeight?: number;
  gap?: number;
};

/** Aspect ratio (w/h) to assume before an image has loaded and reported its
 *  natural size. 3:2 is the common race-camera frame, so first paint is close
 *  and the re-justify on load barely shifts. */
const DEFAULT_RATIO = 1.5;

/**
 * Google-Photos-style justified grid.
 *
 * Lays photos out in full-width rows of uniform height, each photo at its true
 * aspect ratio (so nothing is cropped or letterboxed — landscape race shots
 * finally fill the frame). We don't store image dimensions, so each tile
 * measures its own natural aspect ratio on load and the layout re-justifies;
 * for an order of a few dozen photos this settles instantly.
 *
 * Reused across the order screen and (later) the browse gallery — clicking a
 * tile calls `onOpen(index)` and the parent drives the full-screen viewer.
 */
export function JustifiedPhotoGrid({ photos, onOpen, targetRowHeight = 240, gap = 6 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // Measured natural aspect ratios, keyed by photo id. Missing → DEFAULT_RATIO.
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Measure synchronously up front. Some browsers (and headless/preview
    // environments) never fire ResizeObserver's initial callback, so we can't
    // rely on it for first paint — read the width directly on mount, then let
    // the observer + a window-resize fallback handle later changes.
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Self-healing measure: if the width we hold is 0 (the mount-time read can
  // race layout in some environments, and neither ResizeObserver nor a window
  // resize is guaranteed to fire afterwards), re-read after every render until
  // a real width lands. Without this the grid can stay permanently empty.
  useLayoutEffect(() => {
    if (width > 0) return;
    const el = wrapRef.current;
    if (el && el.clientWidth > 0) setWidth(el.clientWidth);
  });

  // Single place to record a measured ratio (dedupe tiny diffs to avoid churn).
  const applyRatio = useCallback((id: string, natW: number, natH: number) => {
    if (!natW || !natH) return;
    const ar = natW / natH;
    setRatios((prev) =>
      Math.abs((prev[id] ?? 0) - ar) < 0.001 ? prev : { ...prev, [id]: ar }
    );
  }, []);

  // Measure every photo's natural aspect ratio up front with detached image
  // loaders, decoupled from the rendered <img> tags. This fixes two things the
  // rendered-<img> onLoad alone cannot:
  //   1. Cached images. If a preview is already decoded when React attaches the
  //      <img> (img.complete at mount), its load event already fired and onLoad
  //      never runs — the tile would be stuck at DEFAULT_RATIO. A detached
  //      Image() reports synchronously via .complete on a cache hit.
  //   2. Below-the-fold tiles. The rendered <img> is loading="lazy", so its
  //      ratio wouldn't be known until scrolled into view, forcing every row to
  //      re-justify (and jump) on scroll. Detached loaders learn all ratios
  //      before the user scrolls, so the layout is stable.
  // Keyed on the id list so it runs once per photo set, not on every re-justify.
  const idsKey = photos.map((p) => p.id).join(",");
  useEffect(() => {
    let cancelled = false;
    const loaders = photos.map((p) => {
      const img = new Image();
      const done = () => {
        if (!cancelled) applyRatio(p.id, img.naturalWidth, img.naturalHeight);
      };
      img.onload = done;
      img.src = p.src;
      if (img.complete) done(); // already cached/decoded
      return img;
    });
    return () => {
      cancelled = true;
      loaders.forEach((img) => (img.onload = null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, applyRatio]);

  // Shorter rows on phones so tiles stay tappable and a row isn't one giant photo.
  const rowHeight = width > 0 && width < 640 ? Math.round(targetRowHeight * 0.62) : targetRowHeight;

  // Group photos into justified rows. Greedily fill a row until scaling it to
  // the target height would overflow the container width, then commit it. Each
  // committed row is scaled so its photos exactly span the width; the final
  // (partial) row is left at target height, aligned left — the Google Photos feel.
  const rows = useMemo(() => {
    if (width <= 0) return [] as { photo: GridPhoto; ratio: number }[][];
    const out: { photo: GridPhoto; ratio: number }[][] = [];
    let row: { photo: GridPhoto; ratio: number }[] = [];
    let ratioSum = 0;
    for (const photo of photos) {
      const ratio = ratios[photo.id] ?? DEFAULT_RATIO;
      row.push({ photo, ratio });
      ratioSum += ratio;
      const rowWidth = ratioSum * rowHeight + gap * (row.length - 1);
      if (rowWidth >= width) {
        out.push(row);
        row = [];
        ratioSum = 0;
      }
    }
    if (row.length) out.push(row);
    return out;
  }, [photos, ratios, width, rowHeight, gap]);

  let cursor = 0; // running photo index across rows, for onOpen + viewer paging

  return (
    <div ref={wrapRef}>
      {rows.map((row, ri) => {
        const ratioSum = row.reduce((s, it) => s + it.ratio, 0);
        // Scale a full row to span the width exactly; leave the last partial row
        // at the target height (don't blow it up to full width).
        const isLast = ri === rows.length - 1;
        const available = width - gap * (row.length - 1);
        const h = isLast && ratioSum * rowHeight + gap * (row.length - 1) < width
          ? rowHeight
          : available / ratioSum;
        return (
          <div key={ri} style={{ display: "flex", gap, marginBottom: gap }}>
            {row.map(({ photo, ratio }) => {
              const idx = cursor++;
              return (
                <button
                  key={photo.id}
                  type="button"
                  className="gp-tile"
                  onClick={() => onOpen(idx)}
                  style={{ width: ratio * h, height: h }}
                  aria-label="View photo full screen"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt=""
                    loading="lazy"
                    className="gp-tile-img"
                    onLoad={(e) =>
                      applyRatio(photo.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                    }
                  />
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
