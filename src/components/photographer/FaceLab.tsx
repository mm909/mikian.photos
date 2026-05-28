"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/** PhotoFace row shape as the lab cares about it. */
type LabFace = {
  id: string;
  rekognitionFaceId: string | null;
  faceClusterId: string | null;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  source: string;
};

type RecentPhoto = {
  id: string;
  eventId: string;
  takenAt: string | null;
  facesIndexedAt: string | null;
  faces: LabFace[];
  previewUrl: string;
};

type ClusterMember = {
  photoId: string;
  faceId: string;
  confidence: number;
};

type ReindexState = "idle" | "running" | "ok" | "err";

/**
 * Face inspection lab. Sibling to OCR Lab.
 *
 *   - Left pane: photo viewer with face bboxes drawn on top
 *   - Right pane: metadata sidebar — per-face FaceId / cluster / confidence,
 *     plus a "Show cluster across event" action that lists every photo
 *     containing the same face.
 *   - Footer: thumbnail strip + arrow-key nav between photos.
 *
 * The lab never mutates data on load — toggles + previews come from the
 * existing PhotoFace rows. Force re-index calls /rerun-faces, which DOES
 * mutate (drops + re-creates rows + Rekognition entries). Refetches the
 * photo's faces inline so the overlay updates without a full reload.
 */
export function FaceLab({
  recent,
  initialPhotoId,
}: {
  recent: RecentPhoto[];
  initialPhotoId?: string;
}) {
  const [photos, setPhotos] = useState<RecentPhoto[]>(recent);
  const [photoId, setPhotoId] = useState<string | null>(
    initialPhotoId ?? recent[0]?.id ?? null
  );
  /** When set, the right pane shows the cluster members for this face. */
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
  const [clusterMembers, setClusterMembers] = useState<ClusterMember[] | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [reindex, setReindex] = useState<ReindexState>("idle");
  const [reindexError, setReindexError] = useState<string | null>(null);

  const selected = useMemo(
    () => photos.find((p) => p.id === photoId) ?? null,
    [photos, photoId]
  );

  // Drop the cluster pane when the user navigates to a different photo —
  // it's almost always wrong context for the new photo.
  useEffect(() => {
    setActiveFaceId(null);
    setClusterMembers(null);
  }, [photoId]);

  // Arrow-key navigation through the thumbnail strip. Same trick the OCR
  // Lab uses; skips when focus is in an editable element so we don't
  // hijack input typing.
  const currentIndex = useMemo(
    () => photos.findIndex((p) => p.id === photoId),
    [photos, photoId]
  );
  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setPhotoId(photos[currentIndex - 1].id);
  }, [currentIndex, photos]);
  const goNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= photos.length - 1) return;
    setPhotoId(photos[currentIndex + 1].id);
  }, [currentIndex, photos]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  /**
   * Force a fresh face indexing pass. Drops existing PhotoFace rows + their
   * Rekognition entries, then runs IndexFaces again. We refetch this
   * photo's row directly so the lab's view updates without a hard reload.
   */
  async function forceReindex() {
    if (!selected) return;
    setReindex("running");
    setReindexError(null);
    try {
      const r = await fetch(`/api/photographer/photos/${selected.id}/rerun-faces`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      // Pull the photo's row + faces back so we can repaint the overlay.
      const detail = await fetch(`/api/photographer/photos/${selected.id}`, {
        cache: "no-store",
      });
      if (detail.ok) {
        const d = (await detail.json()) as {
          photo?: {
            faces?: {
              id: string;
              rekognitionFaceId: string | null;
              faceClusterId: string | null;
              confidence: number;
              x0: number;
              y0: number;
              x1: number;
              y1: number;
              source: string;
            }[];
          };
        };
        const newFaces: LabFace[] =
          d.photo?.faces?.map((f) => ({
            id: f.id,
            rekognitionFaceId: f.rekognitionFaceId,
            faceClusterId: f.faceClusterId,
            confidence: f.confidence,
            bbox: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 },
            source: f.source,
          })) ?? [];
        setPhotos((curr) =>
          curr.map((p) =>
            p.id === selected.id
              ? { ...p, faces: newFaces, facesIndexedAt: new Date().toISOString() }
              : p
          )
        );
      }
      setReindex("ok");
      setTimeout(() => setReindex("idle"), 1500);
    } catch (e) {
      setReindexError(e instanceof Error ? e.message : String(e));
      setReindex("err");
    }
  }

  /**
   * Show every photo in this event that shares the same faceClusterId as
   * the clicked face. One Prisma round-trip via the existing face-lab
   * endpoint; the response carries enough to render a small grid.
   */
  async function loadCluster(face: LabFace) {
    if (!selected || !face.faceClusterId) return;
    setActiveFaceId(face.id);
    setClusterMembers(null);
    setClusterLoading(true);
    try {
      const qs = new URLSearchParams({
        eventId: selected.eventId,
        cluster: face.faceClusterId,
      });
      const r = await fetch(`/api/photographer/face-lab/cluster?${qs}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const d = (await r.json()) as { members: ClusterMember[] };
      setClusterMembers(d.members);
    } catch (e) {
      console.warn("cluster fetch failed:", e);
      setClusterMembers([]);
    } finally {
      setClusterLoading(false);
    }
  }

  return (
    <main
      className="screen face-lab-main"
      style={{
        padding: "12px 16px 16px",
        maxHeight: "calc(100dvh - var(--nav-h, 80px))",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Face Lab · Rekognition
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 22,
              color: "var(--ink)",
              lineHeight: 1.1,
            }}
          >
            {selected ? truncateMid(selected.id, 24) : "Pick a photo…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selected && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".1em",
                color: "var(--muted)",
              }}
            >
              {selected.facesIndexedAt
                ? `indexed ${fmtRelative(selected.facesIndexedAt)}`
                : "never indexed"}
              {" · "}
              {selected.faces.length} face{selected.faces.length === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={forceReindex}
            disabled={!selected || reindex === "running"}
            className="btn btn--primary btn--sm"
          >
            {reindex === "running"
              ? "Re-indexing…"
              : reindex === "ok"
                ? "✓ Re-indexed"
                : reindex === "err"
                  ? "Failed — retry"
                  : "↻ Force re-index"}
          </button>
        </div>
      </div>

      {reindexError && reindex === "err" && (
        <div
          style={{
            background: "var(--cream)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            padding: "8px 12px",
            borderRadius: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          {reindexError}
        </div>
      )}

      {/* Two-column body — photo viewer + sidebar */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 360px",
          gap: 12,
        }}
      >
        <PhotoWithFaces
          photo={selected}
          activeFaceId={activeFaceId}
          onFaceClick={(f) => loadCluster(f)}
        />

        <Sidebar
          photo={selected}
          activeFaceId={activeFaceId}
          clusterMembers={clusterMembers}
          clusterLoading={clusterLoading}
          onPickFace={(f) => loadCluster(f)}
          onJumpToPhoto={(pid) => setPhotoId(pid)}
        />
      </div>

      {/* Thumbnail strip — same pattern as OCR Lab */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {photos.map((p) => {
          const isActive = p.id === photoId;
          return (
            <button
              key={p.id}
              onClick={() => setPhotoId(p.id)}
              style={{
                position: "relative",
                width: 100,
                height: 70,
                minWidth: 100,
                padding: 0,
                border: isActive ? "2px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: 4,
                overflow: "hidden",
                cursor: "pointer",
                background: "var(--cream)",
                outline: "none",
              }}
              title={`${p.faces.length} face${p.faces.length === 1 ? "" : "s"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {p.faces.length > 0 && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    background: "rgba(28,26,23,0.78)",
                    color: "var(--paper)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 3,
                    letterSpacing: ".06em",
                  }}
                >
                  {p.faces.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}

/** Photo viewer with overlaid face bboxes. Clicking a box opens the
 *  cluster panel in the sidebar. */
function PhotoWithFaces({
  photo,
  activeFaceId,
  onFaceClick,
}: {
  photo: RecentPhoto | null;
  activeFaceId: string | null;
  onFaceClick: (face: LabFace) => void;
}) {
  if (!photo) {
    return (
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          color: "var(--muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        no photo selected
      </div>
    );
  }
  return (
    <div
      style={{
        position: "relative",
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt=""
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
      {/* Boxes use percent units so they scale with the image regardless of
          its rendered size. Each box is a clickable button. */}
      {photo.faces.map((f) => {
        const isActive = f.id === activeFaceId;
        const left = `${f.bbox.x0 * 100}%`;
        const top = `${f.bbox.y0 * 100}%`;
        const width = `${(f.bbox.x1 - f.bbox.x0) * 100}%`;
        const height = `${(f.bbox.y1 - f.bbox.y0) * 100}%`;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFaceClick(f)}
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              border: isActive ? "3px solid var(--accent)" : "2px solid #5dbf85",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              boxShadow: isActive ? "0 0 0 1px var(--accent) inset" : "none",
              borderRadius: 2,
            }}
            title={`Conf ${(f.confidence * 100).toFixed(0)}% · cluster ${truncateMid(
              f.faceClusterId ?? "—",
              12
            )}`}
          />
        );
      })}
    </div>
  );
}

/** Metadata sidebar — per-face details, plus the cluster members panel
 *  when a face is selected. */
function Sidebar({
  photo,
  activeFaceId,
  clusterMembers,
  clusterLoading,
  onPickFace,
  onJumpToPhoto,
}: {
  photo: RecentPhoto | null;
  activeFaceId: string | null;
  clusterMembers: ClusterMember[] | null;
  clusterLoading: boolean;
  onPickFace: (face: LabFace) => void;
  onJumpToPhoto: (photoId: string) => void;
}) {
  return (
    <aside
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 14,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 8,
          }}
        >
          Detected faces
        </div>
        {!photo || photo.faces.length === 0 ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {photo
              ? "No faces yet — try Force re-index."
              : "Select a photo to see its faces."}
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {photo.faces.map((f) => {
              const selected = f.id === activeFaceId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onPickFace(f)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: selected ? "var(--cream)" : "transparent",
                      border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: ".04em",
                      color: "var(--ink)",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <span>
                      faceId{" "}
                      <strong style={{ fontWeight: 600 }}>
                        {truncateMid(f.rekognitionFaceId ?? "—", 14)}
                      </strong>
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      cluster {truncateMid(f.faceClusterId ?? "—", 14)}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      conf {(f.confidence * 100).toFixed(1)}% · {f.source}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {activeFaceId && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            Cluster across event
          </div>
          {clusterLoading ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading cluster…</div>
          ) : !clusterMembers ? null : clusterMembers.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              No other photos found in this cluster.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
                gap: 6,
              }}
            >
              {clusterMembers.map((m) => (
                <button
                  key={`${m.photoId}-${m.faceId}`}
                  type="button"
                  onClick={() => onJumpToPhoto(m.photoId)}
                  title={`Conf ${(m.confidence * 100).toFixed(0)}%`}
                  style={{
                    padding: 0,
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    background: "var(--cream)",
                    cursor: "pointer",
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${m.photoId}/face/${m.faceId}`}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

/** Truncate "abcdefghij" → "abcd…ghij" for compact id rendering. */
function truncateMid(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

/** "3d ago" / "just now" for the indexed-at chip. */
function fmtRelative(iso: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch {
    return iso;
  }
}
