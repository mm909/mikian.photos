"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";

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

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/photographer/photos/catalog", { cache: "no-store" });
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      const d = (await r.json()) as { photos: AdminPhoto[]; isAdmin: boolean };
      setPhotos(d.photos);
      setIsAdmin(d.isAdmin);
    } catch (e) {
      console.error(e);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
    return photos.filter((p) => {
      if (filter === "tagged" && p.bibs.length === 0) return false;
      if (filter === "untagged" && p.bibs.length > 0) return false;
      if (filter === "hidden" && !p.hidden) return false;
      if (filter !== "hidden" && p.hidden) return false; // hide hidden by default
      if (!s) return true;
      if (p.id.toLowerCase().includes(s)) return true;
      if (p.bibs.some((b) => String(b.bib).includes(s))) return true;
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {filteredPhotos.map((p) => (
              <PhotoTile
                key={p.id}
                p={p}
                running={rerun[p.id] === "running"}
                onClick={() => setOpenId(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {openPhoto && (
        <PhotoDetailModal
          photo={openPhoto}
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

/**
 * Library card — uncropped photo on a cream cell, no chrome.
 * All interaction goes through the click-to-open detail modal.
 */
function PhotoTile({
  p,
  running,
  onClick,
}: {
  p: AdminPhoto;
  running: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={p.bibs.length ? `Bibs ${p.bibs.map((b) => b.bib).join(", ")}` : "Untagged"}
      style={{
        position: "relative",
        aspectRatio: "3 / 2",
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
        padding: 0,
        cursor: "pointer",
        transition: "transform var(--dur-hover) var(--ease), box-shadow var(--dur-hover) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
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
          // contain → full photo visible, never cropped
          objectFit: "contain",
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
          }}
        >
          Hidden
        </span>
      )}

      {/* Tiny status pulse when this photo is mid-OCR. Stays out of the way. */}
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
          }}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </button>
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
