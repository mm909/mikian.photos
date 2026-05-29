"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Lens,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/Lens";
import { Pager } from "@/components/photographer/Pager";

type BibTag = DetailPhoto["bibs"][number];
type AdminPhoto = DetailPhoto;

/**
 * Photo library — a single-page, no-scroll workbench (modeled on the old
 * Detection Lab). One photo is always "current": a big preview fills the
 * left pane with a thumbnail strip beneath it for picking siblings, and the
 * right rail holds bibs / faces / cluster / metadata / actions / OCR + face
 * debug. The page is viewport-fit; only the right rail scrolls.
 *
 * The heavy lifting lives in PhotoDetailModal (rendered with `inline`), which
 * doubles as the click-to-open modal on the Coverage / Roster screens.
 *
 * URL params (deep-linkable from the dashboard):
 *   eventId  - filter to photos for this event
 *   photo    - deep-open a specific photo as the current one
 *
 * Quick-search box does substring/exact-bib match on the loaded page (typing
 * a bib number is the fastest way to confirm "did OCR see this?"); it narrows
 * the thumbnail strip.
 */
export function PhotosAdminClient() {
  const params = useSearchParams();
  const eventIdParam = params?.get("eventId") ?? null;
  // Deep-open a specific photo's detail modal (e.g. the old OCR/Face Lab
  // bookmarks now redirect here with ?photo=, and the in-modal cluster panel
  // hops between photos via the same mechanism).
  const photoParam = params?.get("photo") ?? null;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [rerunFace, setRerunFace] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});

  const [search, setSearch] = useState("");

  // The currently-previewed photo. Always set to something once the catalog
  // loads (see the maintenance effect below); drives the whole workbench.
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Pages mode — replaces the previous cursor-based Load-more.
  const [page, setPage] = useState(1);
  const [pageSize] = useState(48);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const fetchPageNum = useCallback(
    async (n: number) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(n),
          pageSize: String(pageSize),
        });
        if (eventIdParam) qs.set("eventId", eventIdParam);
        const r = await fetch(`/api/photographer/photos/catalog?${qs}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`catalog ${r.status}`);
        const d = (await r.json()) as {
          photos: AdminPhoto[];
          isAdmin: boolean;
          total: number | null;
          page: number | null;
          pageCount: number | null;
        };
        setPhotos(d.photos);
        setIsAdmin(d.isAdmin);
        if (d.total != null) setTotal(d.total);
        if (d.pageCount != null) setPageCount(d.pageCount);
        if (d.page != null) setPage(d.page);
        if (d.pageCount != null && n > d.pageCount && d.pageCount >= 1) {
          void fetchPageNum(d.pageCount);
        }
      } catch (e) {
        console.error(e);
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, eventIdParam]
  );

  const fetchCatalog = useCallback(() => fetchPageNum(1), [fetchPageNum]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  // Photographer-directory fetch was here for the now-removed admin
  // filter dropdown. With the filter gone we don't need the list at all,
  // so we skip the /api/admin/users call entirely — saves a round trip
  // every time owner lands on the library.

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, { method: "POST" });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      const d = (await r.json()) as { detected: { bib: number; confidence: number }[] };
      setPhotos((curr) =>
        curr.map((p) =>
          p.id === photoId
            ? {
                ...p,
                bibs: [
                  ...p.bibs.filter((b) => !b.source.startsWith("ocr-")),
                  ...d.detected.map((x) => ({
                    id: `tmp-${x.bib}`,
                    bib: x.bib,
                    confidence: x.confidence,
                    source: "ocr-tesseract",
                    createdAt: new Date().toISOString(),
                  })),
                ].sort((a, b) => b.confidence - a.confidence),
              }
            : p
        )
      );
      setRerun((s) => ({ ...s, [photoId]: "ok" }));
      setTimeout(() => setRerun((s) => ({ ...s, [photoId]: "idle" })), 1800);
    } catch (e) {
      console.error(e);
      setRerun((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function rerunFaceIndex(photoId: string) {
    setRerunFace((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-faces`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `rerun-faces ${r.status}`);
      }
      void fetchCatalog();
      setRerunFace((s) => ({ ...s, [photoId]: "ok" }));
      setTimeout(() => setRerunFace((s) => ({ ...s, [photoId]: "idle" })), 1500);
    } catch (e) {
      console.error(e);
      setRerunFace((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function deletePhoto(photoId: string) {
    setDelState((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `delete ${r.status}`);
      }
      // Land on a neighbour so the workbench doesn't blank out — next photo
      // if there is one, else the previous, else nothing.
      const idx = photos.findIndex((p) => p.id === photoId);
      const neighbor = photos[idx + 1] ?? photos[idx - 1] ?? null;
      setCurrentId((curr) => (curr === photoId ? neighbor?.id ?? null : curr));
      setPhotos((curr) => curr.filter((p) => p.id !== photoId));
      setDelState((s) => {
        const next = { ...s };
        delete next[photoId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setDelState((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function toggleHidden(photoId: string) {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    const nextHidden = !photo.hidden;
    setHideStateMap((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: nextHidden }),
      });
      if (!r.ok) throw new Error(`patch ${r.status}`);
      setPhotos((curr) =>
        curr.map((p) => (p.id === photoId ? { ...p, hidden: nextHidden } : p))
      );
      setHideStateMap((s) => {
        const next = { ...s };
        delete next[photoId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setHideStateMap((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  // Open a photo by id. If it's on the loaded page we just open it; otherwise
  // (a cluster hop or a ?photo deep-link to a photo on another page) we fetch
  // its detail and splice it into the loaded set so the modal can render it.
  const jumpToPhoto = useCallback(
    async (id: string) => {
      if (photos.some((p) => p.id === id)) {
        setCurrentId(id);
        return;
      }
      try {
        const r = await fetch(`/api/photographer/photos/${id}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`photo ${r.status}`);
        const d = (await r.json()) as { photo: AdminPhoto };
        setPhotos((curr) => (curr.some((p) => p.id === id) ? curr : [d.photo, ...curr]));
        setCurrentId(id);
      } catch (e) {
        console.error(e);
      }
    },
    [photos]
  );

  // Honour ?photo= once after the first catalog load lands. The ref guard keeps
  // it from re-firing as the user navigates the modal (which doesn't touch the
  // URL param).
  const didDeepOpen = useRef(false);
  useEffect(() => {
    if (didDeepOpen.current || loading || !photoParam) return;
    didDeepOpen.current = true;
    void jumpToPhoto(photoParam);
  }, [loading, photoParam, jumpToPhoto]);

  // In-page search across what's currently loaded. Numeric input is an
  // exact bib match (mirrors /api/photos?bib= semantics); free-text is a
  // substring match on photo id and photographer name.
  const filteredPhotos = useMemo(() => {
    const s = search.trim().toLowerCase();
    const numericExact = /^\d+$/.test(s) ? Number(s) : null;
    return photos.filter((p) => {
      if (p.hidden) return false; // hidden photos drop out of the grid
      if (!s) return true;
      if (numericExact !== null) {
        return p.bibs.some((b) => b.bib === numericExact);
      }
      if (p.id.toLowerCase().includes(s)) return true;
      if (p.photographer.name.toLowerCase().includes(s)) return true;
      return false;
    });
  }, [photos, search]);

  const currentPhoto = currentId
    ? photos.find((p) => p.id === currentId) ?? null
    : null;

  // Keep a valid current photo. Reset to the first visible photo whenever the
  // current one disappears entirely (page change, delete) or was never set.
  // A photo that's merely filtered-out by search — but still loaded — is kept
  // (it stays reachable via the prepend below), so typing a query that
  // excludes the current photo doesn't yank the preview away mid-inspection.
  useEffect(() => {
    if (loading) return;
    if (currentId && photos.some((p) => p.id === currentId)) return;
    setCurrentId(filteredPhotos[0]?.id ?? photos[0]?.id ?? null);
  }, [loading, photos, filteredPhotos, currentId]);

  // The strip browses the filtered set, but the current photo must always be
  // present even when the active search would exclude it (e.g. a cluster hop
  // to a photo that doesn't match the query, or a hidden photo). Prepend it.
  const viewPhotos = useMemo(() => {
    if (currentPhoto && !filteredPhotos.some((p) => p.id === currentPhoto.id)) {
      return [currentPhoto, ...filteredPhotos];
    }
    return filteredPhotos;
  }, [filteredPhotos, currentPhoto]);

  // Build the scope summary line: "Admin · all photographers · 2,345 photos"
  // or "Your uploads · 145 photos" with an event qualifier when set.
  const scopeLine = (() => {
    const parts: string[] = [];
    parts.push(isAdmin ? "Admin · all photographers" : "Your uploads");
    if (eventIdParam) parts.push(`event ${eventIdParam}`);
    parts.push(`${total.toLocaleString()} photo${total === 1 ? "" : "s"}`);
    return parts.join(" · ");
  })();

  return (
    <main
      className="screen"
      style={{
        // Viewport-fit, no-scroll shell (mirrors the old Detection Lab):
        // the page never scrolls — only the detail view's right rail does.
        // A *definite* height (not just max-height) is required so the grid's
        // height:100% resolves and the preview shrinks via object-fit instead
        // of overflowing. .app-root is min-height:100vh, so we subtract the
        // sticky nav (~63px) from the dynamic viewport here.
        padding: "12px 16px 14px",
        height: "calc(100dvh - 64px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          width: "100%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 0,
        }}
      >
        {/* Compact header — title + scope on the left, search + Upload on the
            right. Single row so the preview gets the maximum vertical budget. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 20,
                letterSpacing: "-.012em",
                color: "var(--ink)",
              }}
            >
              Photo{" "}
              <em className="acc-l" style={{ fontStyle: "italic" }}>
                library
              </em>
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {scopeLine}
            </span>
          </div>
          <input
            className="input"
            placeholder="Search bib, photo ID, photographer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, maxWidth: "50vw", padding: "7px 12px", fontSize: 14 }}
          />
        </div>

        {/* Body — the inline detail workbench fills the remaining height. */}
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : !currentPhoto ? (
          <p style={{ color: "var(--muted)" }}>
            {photos.length === 0
              ? "No photos uploaded yet."
              : "No photos match this search."}
          </p>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ flex: 1, minHeight: 0 }}>
              <Lens
                inline
                photos={viewPhotos}
                currentId={currentPhoto.id}
                onSelect={setCurrentId}
                isOwner={isAdmin}
                onJumpToPhoto={(id) => void jumpToPhoto(id)}
                rerunState={rerun[currentPhoto.id] ?? "idle"}
                rerunFaceState={rerunFace[currentPhoto.id] ?? "idle"}
                onRerunFace={() => rerunFaceIndex(currentPhoto.id)}
                deleteState={delState[currentPhoto.id] ?? "idle"}
                hideState={hideStateMap[currentPhoto.id] ?? "idle"}
                onClose={() => {}}
                onRerun={() => rerunOcr(currentPhoto.id)}
                onAskDelete={() =>
                  setDelState((s) => ({
                    ...s,
                    [currentPhoto.id]:
                      s[currentPhoto.id] === "confirm" ? "idle" : "confirm",
                  }))
                }
                onConfirmDelete={() => deletePhoto(currentPhoto.id)}
                onCancelDelete={() =>
                  setDelState((s) => ({ ...s, [currentPhoto.id]: "idle" }))
                }
                onToggleHidden={() => toggleHidden(currentPhoto.id)}
              />
            </div>

            {pageCount > 1 && (
              <Pager
                page={page}
                pageCount={pageCount}
                total={total}
                pageSize={pageSize}
                onGo={fetchPageNum}
                disabled={loading}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// Kept for any future external usage; re-export the BibTag shape via the
// modal's named export to avoid duplication.
export type { BibTag };
