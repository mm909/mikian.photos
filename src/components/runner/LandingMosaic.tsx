"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JustifiedPhotoGrid, type GridPhoto } from "./JustifiedPhotoGrid";
import { PhotoViewer } from "./PhotoViewer";
import { useFeatureControls } from "./useFeatureControls";
import { useRunner } from "./RunnerProvider";

/** Photos fetched per page — same as the Gallery wall. */
const PAGE_SIZE = 100;

/**
 * The search-landing portfolio mosaic.
 *
 * Owner-featured (pinned) photos lead the wall; the rest of the event then
 * streams in page-by-page as you approach the bottom — the same infinite-scroll
 * as the Gallery tab, just seeded featured-first (no random fill; the paginated
 * catalog fills the rest). Tapping a tile opens the full-screen viewer, which
 * carries the owner's ★ curation toggle.
 */
export function LandingMosaic({
  slug,
  feature,
  targetRowHeight = 210,
}: {
  slug: string;
  feature: ReturnType<typeof useFeatureControls>;
  targetRowHeight?: number;
}) {
  const { featuredPhotos } = useRunner();

  const [pages, setPages] = useState<GridPhoto[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // In-flight latch (ref so the scroll handler sees it synchronously and a
  // burst of events can't double-fetch a page).
  const loadingRef = useRef(false);
  const erroredRef = useRef(false);
  // Server-side offset of the next page — advanced by RAW page length so a
  // dropped duplicate can't re-request the same window forever.
  const offsetRef = useRef(0);
  // Ids already appended (paginated) so pages don't duplicate across fetches.
  const seenRef = useRef<Set<string>>(new Set());

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done || erroredRef.current) return;
    loadingRef.current = true;
    setLoading(true);
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
      const raw = d.photos ?? [];
      offsetRef.current += raw.length;
      const fresh: GridPhoto[] = [];
      for (const p of raw) {
        if (seenRef.current.has(p.id)) continue;
        seenRef.current.add(p.id);
        fresh.push({ id: p.id, src: p.previewUrl ?? `/api/photos/${p.id}/preview` });
      }
      if (raw.length === 0 || (typeof d.total === "number" && offsetRef.current >= d.total)) {
        setDone(true);
      }
      if (fresh.length > 0) setPages((prev) => [...prev, ...fresh]);
    } catch {
      erroredRef.current = true;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [slug, done]);

  // Reset + first page on event change.
  useEffect(() => {
    offsetRef.current = 0;
    erroredRef.current = false;
    seenRef.current = new Set();
    setPages([]);
    setDone(false);
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Pinned featured lead; the paginated catalog fills the rest. Dedupe at RENDER
  // (not load) so a featured photo that also lands in a page — the page fetch
  // doesn't know which ids are pinned — is never shown twice, regardless of
  // whether featuredPhotos resolved before or after the first page.
  const shown = useMemo(() => {
    const pinnedGrid: GridPhoto[] = featuredPhotos
      .filter((f) => f.pinned)
      .map((f) => ({ id: f.id, src: f.previewUrl }));
    const pinnedIds = new Set(pinnedGrid.map((p) => p.id));
    return [...pinnedGrid, ...pages.filter((p) => !pinnedIds.has(p.id))];
  }, [featuredPhotos, pages]);

  // Infinite scroll — direct position check on scroll/resize + a slow interval
  // (the justified grid re-measures as previews load and can pull the sentinel
  // into range without a scroll event). Mirrors EventGalleryClient.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) return;
    const nearBottom = () => {
      const el = sentinelRef.current;
      if (!el) return;
      if (el.getBoundingClientRect().top <= window.innerHeight + 1500) void loadMore();
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
  }, [loadMore, done, shown.length]);

  if (shown.length === 0) return null;

  return (
    <>
      <JustifiedPhotoGrid
        photos={shown}
        onOpen={(i) => setViewerIndex(i)}
        targetRowHeight={targetRowHeight}
      />
      <div ref={sentinelRef} />
      {loading && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <span
            style={{
              display: "inline-block",
              width: 22,
              height: 22,
              border: "3px solid var(--line)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
            }}
          />
        </div>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          photos={shown}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndex={(i) => setViewerIndex(i)}
          feature={feature}
          // Page past the last loaded photo by pulling the next page.
          hasMore={!done}
          onLoadMore={loadMore}
        />
      )}
    </>
  );
}
