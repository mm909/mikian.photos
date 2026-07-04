"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headline } from "./Headline";
import { JustifiedPhotoGrid, type GridPhoto } from "./JustifiedPhotoGrid";
import { PhotoViewer } from "./PhotoViewer";
import { useFeatureControls } from "./useFeatureControls";
import { useRunner } from "./RunnerProvider";

/** Photos fetched per page. Small enough that the first paint is quick, big
 *  enough that a fast scroller doesn't hit the sentinel every half-screen. */
const PAGE_SIZE = 100;

/**
 * The event Gallery tab — a browse-only wall of every photo in the event, as a
 * justified grid with the full-screen viewer. No buy CTA here (buying happens
 * via bib/face search on the main event page); this is purely for looking.
 *
 * Loaded lazily: the first page renders immediately and more pages pull in as
 * you approach the bottom, so a thousand-photo event doesn't fetch a thousand
 * previews up front. The full-screen viewer pages past the last loaded photo
 * by fetching the next page (rather than looping). The owner sees the ★ toggle
 * in the viewer to curate the landing hero.
 */
export function EventGalleryClient({ slug }: { slug: string }) {
  const { event } = useRunner();
  const feature = useFeatureControls();

  const [photos, setPhotos] = useState<GridPhoto[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // In-flight latch (ref, not state — the observer callback must see it
  // synchronously so a burst of intersections can't double-fetch a page).
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  // Server-side offset of the next page. Advanced by RAW page length (not the
  // deduped count) so a dropped duplicate can't make us re-request the same
  // window forever.
  const offsetRef = useRef(0);

  // Latches after a fetch failure so the near-bottom auto-loader stops hammering
  // a persistently-failing endpoint (expired access cookie → 401, or a 500).
  // Cleared only by an explicit user "retry" tap.
  const erroredRef = useRef(false);

  const loadMore = useCallback(async (isRetry = false) => {
    if (loadingRef.current || done) return;
    if (erroredRef.current && !isRetry) return;
    loadingRef.current = true;
    erroredRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/photos", window.location.origin);
      url.searchParams.set("eventId", slug);
      url.searchParams.set("offset", String(offsetRef.current));
      url.searchParams.set("limit", String(PAGE_SIZE));
      // Carry a secure-link token (?k=) on first load, before the cookie is
      // persisted — same access gate as the event page.
      const k = new URLSearchParams(window.location.search).get("k");
      if (k) url.searchParams.set("k", k);
      const res = await fetch(url.pathname + "?" + url.searchParams.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as {
        photos: { id: string; previewUrl?: string }[];
        total?: number;
      };
      const page: GridPhoto[] = (d.photos ?? []).map((p) => ({
        id: p.id,
        src: p.previewUrl ?? `/api/photos/${p.id}/preview`,
      }));
      if (typeof d.total === "number") setTotal(d.total);
      // Advance by the RAW page length (not the deduped count) so a dropped
      // duplicate can't re-request the same window forever. Kept OUTSIDE the
      // setPhotos updater: updaters must be pure (StrictMode double-invokes
      // them, which would double-advance the offset and skip a page).
      offsetRef.current += page.length;
      if (
        page.length === 0 ||
        (typeof d.total === "number" && offsetRef.current >= d.total)
      ) {
        setDone(true);
      }
      setPhotos((prev) => {
        // Dedupe across pages — a photo uploaded mid-scroll can shift offsets.
        const seen = new Set(prev.map((p) => p.id));
        const fresh = page.filter((p) => !seen.has(p.id));
        return fresh.length === 0 ? prev : [...prev, ...fresh];
      });
    } catch (e) {
      erroredRef.current = true;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [slug, done]);

  // First page on mount (and on event change).
  useEffect(() => {
    offsetRef.current = 0;
    erroredRef.current = false;
    setPhotos([]);
    setTotal(null);
    setDone(false);
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Infinite scroll: pull the next page when the sentinel (bottom of the
  // grid) comes within ~two viewports. A direct position check — not an
  // IntersectionObserver, whose initial callback never fires in some
  // environments (same class of quirk as the ResizeObserver note in
  // JustifiedPhotoGrid) and which only re-fires on threshold crossings,
  // silently stalling when a short page never leaves the margin. Checked on
  // scroll/resize AND on a slow interval: the justified grid re-measures
  // photo ratios as previews load and can compress thousands of pixels
  // without any scroll event, silently pulling the sentinel into range. The
  // loadingRef latch makes redundant triggers free.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) return;
    const nearBottom = () => {
      const el = sentinelRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top <= window.innerHeight + 1500) {
        void loadMore();
      }
    };
    nearBottom();
    const interval = window.setInterval(nearBottom, 600);
    window.addEventListener("scroll", nearBottom, { passive: true });
    window.addEventListener("resize", nearBottom);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", nearBottom);
      window.removeEventListener("resize", nearBottom);
    };
  }, [loadMore, done, photos.length]);

  const shownTotal = total ?? photos.length;

  return (
    <main className="screen" style={{ padding: "36px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header — count only; this is a browse wall, buying is via search. */}
        <div>
          {event?.name && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              {event.name} · Gallery
            </div>
          )}
          <Headline
            as="h1"
            text={`All ${shownTotal.toLocaleString()} photos.`}
            accent="photos."
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(28px, 3.6vw, 42px)",
              lineHeight: 1.05,
              letterSpacing: "-.015em",
              color: "var(--ink)",
            }}
          />
        </div>

        <div style={{ marginTop: 20 }}>
          <JustifiedPhotoGrid photos={photos} onOpen={(i) => setViewerIndex(i)} />
        </div>

        {/* Sentinel + status row. The sentinel sits under the grid so the
            observer fires as the last rows approach the viewport. */}
        <div ref={sentinelRef} />
        <div
          style={{
            padding: "28px 0 8px",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {error ? (
            <button className="btn btn--ghost btn--sm" onClick={() => void loadMore(true)}>
              Couldn&rsquo;t load more — retry
            </button>
          ) : loading ? (
            <span
              style={{
                display: "inline-block",
                width: 22,
                height: 22,
                border: "3px solid var(--line)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "spin .8s linear infinite",
                verticalAlign: "middle",
              }}
            />
          ) : done && photos.length > 0 ? (
            `That's all ${shownTotal.toLocaleString()} photos`
          ) : null}
        </div>
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndex={(i) => setViewerIndex(i)}
          feature={feature}
          // Page past the last loaded photo by fetching the next page.
          hasMore={!done}
          onLoadMore={loadMore}
        />
      )}
    </main>
  );
}
