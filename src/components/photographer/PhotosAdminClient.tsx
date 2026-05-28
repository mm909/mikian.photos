"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Headline } from "@/components/runner/Headline";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";
import { LibraryTile } from "@/components/photographer/LibraryTile";
import { Pager } from "@/components/photographer/Pager";

type BibTag = DetailPhoto["bibs"][number];
type AdminPhoto = DetailPhoto;

/** Compact directory entry for the photographer-filter dropdown. */
type PhotographerOption = { id: string; name: string; email: string };

/**
 * Photo library — single-pane browse-and-manage surface.
 *
 * Reshaped (May 2026) to drop the stat pills, the all/tagged/untagged/hidden
 * tab strip, the bulk Re-run-OCR button, and the back-to-dashboard chip.
 * The dashboard now groups uploads by event, and clicking a row deep-links
 * here with `?eventId=<id>` (and optionally `?photographerId=<id>` so an
 * owner can scope to one photographer's work).
 *
 * URL params (deep-linkable from the dashboard):
 *   eventId          - filter to photos for this event
 *   photographerId   - admin only: filter to this photographer's photos
 *
 * Quick-search box still does substring/exact-bib match on the loaded
 * page (kept because typing a bib number is the fastest way to confirm
 * "did OCR see this?").
 */
export function PhotosAdminClient() {
  const params = useSearchParams();
  const eventIdParam = params?.get("eventId") ?? null;
  const photographerIdParam = params?.get("photographerId") ?? null;

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [rerunFace, setRerunFace] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});

  const [search, setSearch] = useState("");
  /** Admin-only photographer filter; null = "all photographers". */
  const [photographerId, setPhotographerId] = useState<string | null>(photographerIdParam);

  const [openId, setOpenId] = useState<string | null>(null);

  // Pages mode — replaces the previous cursor-based Load-more.
  const [page, setPage] = useState(1);
  const [pageSize] = useState(48);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  // Directory of photographers for the admin filter dropdown. Loaded once
  // when we learn the caller is admin.
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([]);

  const fetchPageNum = useCallback(
    async (n: number) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(n),
          pageSize: String(pageSize),
        });
        if (eventIdParam) qs.set("eventId", eventIdParam);
        if (photographerId) qs.set("photographerId", photographerId);
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
    [pageSize, eventIdParam, photographerId]
  );

  const fetchCatalog = useCallback(() => fetchPageNum(1), [fetchPageNum]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  // Once we know the caller is admin, fetch the photographer directory for
  // the filter dropdown. Owner-only endpoint — non-admins won't see the
  // option anyway.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`users ${r.status}`))))
      .then(
        (d: {
          users: {
            id: string;
            name: string;
            email: string;
            photoCount: number;
          }[];
        }) => {
          if (cancelled) return;
          // Only show photographers who actually have photos — keeps the
          // dropdown short and useful.
          setPhotographers(
            d.users
              .filter((u) => u.photoCount > 0)
              .map((u) => ({ id: u.id, name: u.name, email: u.email }))
          );
        }
      )
      .catch((e) => console.warn("photographers fetch failed:", e));
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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
      setOpenId((curr) => (curr === photoId ? null : curr));
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

  const openPhoto = openId ? photos.find((p) => p.id === openId) ?? null : null;

  // Build the scope summary line: "Admin · all photographers · 2,345 photos"
  // or "Your uploads · 145 photos" with extra qualifiers when filters are on.
  const photographerNameById = useMemo(
    () => new Map(photographers.map((p) => [p.id, p.name])),
    [photographers]
  );
  const scopeLine = (() => {
    const parts: string[] = [];
    if (isAdmin) {
      if (photographerId) {
        parts.push(`Admin · ${photographerNameById.get(photographerId) ?? "photographer"}`);
      } else {
        parts.push("Admin · all photographers");
      }
    } else {
      parts.push("Your uploads");
    }
    if (eventIdParam) parts.push(`event ${eventIdParam}`);
    parts.push(`${total.toLocaleString()} photo${total === 1 ? "" : "s"}`);
    return parts.join(" · ");
  })();

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header — vert-aligned title + CTA. The title block carries the
            scope summary right below the headline so the user always knows
            what they're looking at without a separate pill row. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <Headline
              as="h1"
              text="Photo library."
              accent="library."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 36,
                letterSpacing: "-.015em",
              }}
            />
            <div
              style={{
                marginTop: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              {scopeLine}
            </div>
          </div>
          <Link href="/photographer/upload" className="btn btn--primary">
            Upload →
          </Link>
        </div>

        {/* Filter row — search + (admin-only) photographer dropdown.
            Drops the previous all/tagged/untagged/hidden tab strip and
            the bulk Re-run OCR button. */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="Search bib, photo ID, photographer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: 14 }}
          />
          {isAdmin && (
            <select
              value={photographerId ?? ""}
              onChange={(e) => setPhotographerId(e.target.value || null)}
              className="input"
              style={{
                padding: "8px 12px",
                fontSize: 13,
                minWidth: 220,
                fontFamily: "var(--font-sans)",
              }}
              title="Filter by photographer"
            >
              <option value="">All photographers</option>
              {photographers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.email})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Grid — photo only, full frame, click to open detail modal */}
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : filteredPhotos.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No photos match this filter.</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 4,
              }}
            >
              {filteredPhotos.map((p) => (
                <LibraryTile
                  key={p.id}
                  p={p}
                  running={rerun[p.id] === "running"}
                  onOpen={() => setOpenId(p.id)}
                />
              ))}
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
          </>
        )}
      </div>

      {openPhoto && (
        <PhotoDetailModal
          photos={filteredPhotos}
          currentId={openPhoto.id}
          onSelect={(id) => setOpenId(id)}
          rerunState={rerun[openPhoto.id] ?? "idle"}
          rerunFaceState={rerunFace[openPhoto.id] ?? "idle"}
          onRerunFace={() => rerunFaceIndex(openPhoto.id)}
          deleteState={delState[openPhoto.id] ?? "idle"}
          hideState={hideStateMap[openPhoto.id] ?? "idle"}
          onClose={() => setOpenId(null)}
          onRerun={() => rerunOcr(openPhoto.id)}
          onAskDelete={() =>
            setDelState((s) => ({
              ...s,
              [openPhoto.id]: s[openPhoto.id] === "confirm" ? "idle" : "confirm",
            }))
          }
          onConfirmDelete={() => deletePhoto(openPhoto.id)}
          onCancelDelete={() => setDelState((s) => ({ ...s, [openPhoto.id]: "idle" }))}
          onToggleHidden={() => toggleHidden(openPhoto.id)}
        />
      )}
    </main>
  );
}

// Kept for any future external usage; re-export the BibTag shape via the
// modal's named export to avoid duplication.
export type { BibTag };
