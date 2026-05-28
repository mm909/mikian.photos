"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function PhotosAdminClient() {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, found: 0 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tagged" | "untagged" | "hidden">("all");

  // The currently-open photo in the detail modal, or null.
  const [openId, setOpenId] = useState<string | null>(null);

  // Pages mode — replaces the previous cursor-based Load-more so the admin
  // can jump anywhere in the dataset (first / last / arbitrary page).
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
    [pageSize]
  );

  const fetchCatalog = useCallback(() => fetchPageNum(1), [fetchPageNum]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

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

  async function deletePhoto(photoId: string) {
    setDelState((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `delete ${r.status}`);
      }
      // Close the modal first so it doesn't flash empty after the photo
      // disappears from the grid.
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

  async function rerunAll() {
    const ids = filteredPhotos.map((p) => p.id);
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: ids.length, found: 0 });
    let foundTotal = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await fetch(`/api/photographer/photos/${id}/rerun-ocr`, { method: "POST" });
        if (r.ok) {
          const d = (await r.json()) as { total: number };
          foundTotal += d.total;
        }
      } catch {
        /* keep going */
      }
      setBulkProgress({ done: i + 1, total: ids.length, found: foundTotal });
    }
    setBulkRunning(false);
    await fetchCatalog();
  }

  const filteredPhotos = useMemo(() => {
    const s = search.trim().toLowerCase();
    // If the search term is purely digits, use it as an EXACT bib number.
    // Substring matching on bibs ("250" matches "12503") meant the library
    // surfaced photos the runner-facing bib search couldn't find — the
    // /api/photos route does exact equality (bibs: { some: { bib: n } }).
    // Keeping both code paths aligned avoids the discrepancy.
    const numericExact = /^\d+$/.test(s) ? Number(s) : null;
    return photos.filter((p) => {
      if (filter === "tagged" && p.bibs.length === 0) return false;
      if (filter === "untagged" && p.bibs.length > 0) return false;
      if (filter === "hidden" && !p.hidden) return false;
      if (filter !== "hidden" && p.hidden) return false; // hide hidden by default
      if (!s) return true;
      if (numericExact !== null) {
        // Exact bib match — same semantics as the runner /api/photos?bib=
        return p.bibs.some((b) => b.bib === numericExact);
      }
      if (p.id.toLowerCase().includes(s)) return true;
      if (p.photographer.name.toLowerCase().includes(s)) return true;
      return false;
    });
  }, [photos, search, filter]);

  const counts = useMemo(() => {
    const total = photos.length;
    const tagged = photos.filter((p) => p.bibs.length > 0).length;
    const ocrTagged = photos.filter((p) =>
      p.bibs.some((b) => b.source.startsWith("ocr-"))
    ).length;
    const hidden = photos.filter((p) => p.hidden).length;
    return { total, tagged, untagged: total - tagged, ocrTagged, hidden };
  }, [photos]);

  const openPhoto = openId ? photos.find((p) => p.id === openId) ?? null : null;

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              {isAdmin ? "Admin — all photographers" : "Your uploads"}
            </div>
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
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/photographer" className="btn btn--ghost">
              ← Dashboard
            </Link>
            <Link href="/photographer/upload" className="btn btn--primary">
              Upload →
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <Stat label="Total" value={counts.total.toString()} />
          <Stat label="Bib-tagged" value={counts.tagged.toString()} />
          <Stat label="OCR detected" value={counts.ocrTagged.toString()} />
          <Stat label="Untagged" value={counts.untagged.toString()} muted />
          <Stat label="Hidden" value={counts.hidden.toString()} muted />
        </div>

        {/* Filter + actions */}
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
          <div
            role="tablist"
            style={{
              display: "flex",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--cream)",
              padding: 2,
            }}
          >
            {(["all", "tagged", "untagged", "hidden"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                aria-selected={filter === k}
                style={{
                  padding: "6px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  background: filter === k ? "var(--surface)" : "transparent",
                  border: 0,
                  color: filter === k ? "var(--ink)" : "var(--muted)",
                  cursor: "pointer",
                  borderRadius: 4,
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            className="btn btn--ghost"
            onClick={rerunAll}
            disabled={bulkRunning || filteredPhotos.length === 0}
            title="Re-run bib OCR on every photo in the current filter"
          >
            {bulkRunning
              ? `Re-running ${bulkProgress.done}/${bulkProgress.total} (+${bulkProgress.found} bibs)`
              : `Re-run OCR on ${filteredPhotos.length}`}
          </button>
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
          // Arrow-key nav walks the same filtered+sorted list the user is
          // looking at in the grid, so the order matches what they expect.
          photos={filteredPhotos}
          currentId={openPhoto.id}
          onSelect={(id) => setOpenId(id)}
          rerunState={rerun[openPhoto.id] ?? "idle"}
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

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "10px 12px",
        opacity: muted ? 0.7 : 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 22,
          color: "var(--ink)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Kept for any future external usage; re-export the BibTag shape via the
// modal's named export to avoid duplication.
export type { BibTag };
