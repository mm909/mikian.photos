"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OcrDebugPanel,
  OcrTesseractView,
  type DebugPayload,
  type OcrState,
} from "./OcrDebugPanel";
import { OcrSettingsPanel } from "./OcrSettingsPanel";
import { DEFAULT_OCR_SETTINGS, type OcrSettings } from "@/lib/bibOcrTypes";

export type BibTag = {
  id: string;
  bib: number;
  confidence: number;
  source: string;
  createdAt: string;
};

/**
 * Detected face on a photo. Bbox is in NORMALIZED [0,1] coordinates
 * (Rekognition's native format); multiply by the image's natural
 * dimensions to draw on top.
 *
 * `faceClusterId` groups the same runner across multiple photos. Same
 * cluster id = same person (per Rekognition's similarity threshold).
 * Both ID fields are nullable because manual-source rows have no
 * Rekognition identity.
 */
export type PhotoFaceTag = {
  id: string;
  rekognitionFaceId: string | null;
  faceClusterId: string | null;
  confidence: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  source: string;
  createdAt: string;
};

export type DetailPhoto = {
  id: string;
  eventId: string;
  mile: number | null;
  gps: [number, number] | null;
  takenAt: string | null;
  createdAt: string;
  hidden: boolean;
  photographer: { id: string; name: string; email: string };
  bibs: BibTag[];
  /** PhotoFace rows for this photo — may be empty when face detection
   *  hasn't run or detected nothing. */
  faces?: PhotoFaceTag[];
  previewUrl: string;
  r2OriginalKey: string;
  r2PreviewKey: string;
};

export type RerunState = "idle" | "running" | "ok" | "err";
export type DeleteState = "idle" | "confirm" | "running" | "err";
export type HideState = "idle" | "running" | "err";

/** One PhotoFace in the same cluster, used by the "Cluster across event"
 *  panel (folded in from the retired Face Lab). */
type ClusterMember = { photoId: string; faceId: string; confidence: number };

type Props = {
  /** Full photo set the user is browsing through. Drives the thumbnail strip
   *  and arrow-key navigation. Order = visual order in the parent grid. */
  photos: DetailPhoto[];
  /** ID of the currently-displayed photo. Must exist in `photos`. */
  currentId: string;
  /** Parent owns the open-photo state; modal calls this to navigate. */
  onSelect: (id: string) => void;
  onClose: () => void;

  /** Per-photo state lookups + actions. Keyed by photo id on the parent. */
  rerunState: RerunState;
  deleteState: DeleteState;
  hideState: HideState;
  onRerun: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleHidden: () => void;
  /** Optional: callback to untag a specific bib from this photo. When set,
   *  the Bibs section renders each chip as a click-to-remove button (with
   *  confirm). When unset (default), chips are static labels. Coverage
   *  screen passes this; library doesn't. */
  onUntagBib?: (bib: number) => void | Promise<void>;
  /** Face-detection rerun. Same shape as OCR rerun — when set, replaces
   *  the placeholder "Re-run face (coming)" button with a real one and
   *  shows running/ok/err state. Optional so library mode (no rerun) just
   *  hides it. */
  rerunFaceState?: RerunState;
  onRerunFace?: () => void;
  /** Owner unlocks the OCR settings tuning knobs (provider, preprocessing,
   *  bib-filter thresholds) inside the OCR-debug section. Photographers keep
   *  the plain "show intermediates" run with server defaults. Folded in from
   *  the retired owner-only OCR Lab. */
  isOwner?: boolean;
  /** Jump to a photo by id — used by the face-cluster panel to hop to another
   *  photo of the same runner. The parent resolves photos that aren't on the
   *  current grid page. Falls back to in-set `onSelect` when unset. */
  onJumpToPhoto?: (photoId: string) => void;
};

/**
 * Library detail view — opens on photo click.
 *
 * Layout:
 *   left pane:  ONE preview that swaps between the original photo and the
 *               Tesseract-prepared view (with bbox overlays) once OCR debug
 *               has run. Toggle chip in the corner flips between them.
 *               Thumbnail strip sits below for picking a sibling photo.
 *   right pane: bib chips · metadata · storage · actions · OCR debug panel
 *
 * Keyboard:
 *   Esc            → close
 *   ArrowLeft / ←  → previous photo in the set
 *   ArrowRight / → → next photo in the set
 *
 * OCR debug state is owned here (per photo) so we can re-render the left
 * pane as the Tesseract view without keeping two copies of the preprocessed
 * image around. State resets when the user navigates to a different photo.
 */
export function PhotoDetailModal({
  photos,
  currentId,
  onSelect,
  onClose,
  rerunState,
  deleteState,
  hideState,
  onRerun,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  onToggleHidden,
  onUntagBib,
  rerunFaceState,
  onRerunFace,
  isOwner = false,
  onJumpToPhoto,
}: Props) {
  // OCR debug state — per photo. Reset whenever the user navigates.
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrDebug, setOcrDebug] = useState<DebugPayload | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // OCR tuning knobs (owner only). Persist across photo navigation so the
  // owner can sweep a setting across several photos without re-dialing it.
  // In-session cache keyed by (photoId + settings) avoids re-hitting the
  // provider when nothing changed — mirrors the old lab behaviour.
  const [ocrSettings, setOcrSettings] = useState<OcrSettings>(DEFAULT_OCR_SETTINGS);
  const ocrCache = useRef<Map<string, DebugPayload>>(new Map());

  // Face-cluster panel (folded in from the Face Lab). activeFaceId drives the
  // cross-event member grid; both reset on photo change.
  const [activeFaceId, setActiveFaceId] = useState<string | null>(null);
  const [clusterMembers, setClusterMembers] = useState<ClusterMember[] | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);

  /** Which view fills the left pane: the original photo, the OCR-preprocessed
   *  image with bbox overlays, or the original with face-detection bboxes. */
  const [viewMode, setViewMode] = useState<"original" | "ocr" | "face">("original");

  /** Natural dimensions of the preview image — needed to size the face
   *  overlay SVG (Rekognition gives us normalized [0,1] coords; we
   *  multiply by width/height to draw). Set on image load. */
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number } | null>(null);

  // Reset OCR + view + cluster state on photo change so we don't show a stale
  // overlay or a prior photo's cluster picks.
  useEffect(() => {
    setOcrState("idle");
    setOcrDebug(null);
    setOcrError(null);
    setViewMode("original");
    setPreviewDims(null);
    setActiveFaceId(null);
    setClusterMembers(null);
  }, [currentId]);

  const photo = useMemo(
    () => photos.find((p) => p.id === currentId) ?? null,
    [photos, currentId]
  );
  const currentIndex = useMemo(
    () => photos.findIndex((p) => p.id === currentId),
    [photos, currentId]
  );

  const goPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    onSelect(photos[currentIndex - 1].id);
  }, [currentIndex, onSelect, photos]);

  const goNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= photos.length - 1) return;
    onSelect(photos[currentIndex + 1].id);
  }, [currentIndex, onSelect, photos]);

  // Keyboard: Esc + arrow nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Ignore arrow keys when focused inside an editable element so we
      // don't hijack textarea/input navigation.
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
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  function patchOcrSetting<K extends keyof OcrSettings>(key: K, value: OcrSettings[K]) {
    setOcrSettings((s) => ({ ...s, [key]: value }));
  }

  // Owner runs against the tuned settings; photographers run with server
  // defaults (no body). The cache key folds the photo id + the request body
  // so a re-run with identical config returns instantly. A re-run from the
  // ok/err state forces a fresh provider call (the user clicked "re-run" to
  // see a change), bypassing the cache.
  async function runOcrDebug(opts: { force?: boolean } = {}) {
    if (!photo) return;
    const body = isOwner ? JSON.stringify({ settings: ocrSettings }) : null;
    const key = `${photo.id}|${body ?? "default"}`;
    const force = opts.force ?? ocrState === "ok";
    if (!force) {
      const cached = ocrCache.current.get(key);
      if (cached) {
        setOcrDebug(cached);
        setOcrState("ok");
        setViewMode("ocr");
        return;
      }
    }
    setOcrState("running");
    setOcrError(null);
    try {
      const r = await fetch(`/api/photographer/photos/${photo.id}/ocr-debug`, {
        method: "POST",
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body }
          : {}),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      const d = (await r.json()) as DebugPayload;
      ocrCache.current.set(key, d);
      setOcrDebug(d);
      setOcrState("ok");
      // Auto-flip to the Tesseract view once we have one — that's the
      // whole point of running it.
      setViewMode("ocr");
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : String(e));
      setOcrState("err");
    }
  }

  // Load the cross-event cluster for a clicked face — every PhotoFace sharing
  // its faceClusterId, so the owner can see the same runner on other photos
  // and hop between them. No-op for faces with no cluster id (manual rows).
  const loadCluster = useCallback(
    async (face: PhotoFaceTag) => {
      if (!photo || !face.faceClusterId) return;
      setActiveFaceId(face.id);
      setClusterMembers(null);
      setClusterLoading(true);
      try {
        const qs = new URLSearchParams({
          eventId: photo.eventId,
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
    },
    [photo]
  );

  function jumpToPhoto(pid: string) {
    if (onJumpToPhoto) onJumpToPhoto(pid);
    else if (photos.some((p) => p.id === pid)) onSelect(pid);
  }

  // Body scroll lock removed. It was a belt+suspenders defense against
  // the old scrollIntoView jump (now gone), and instead trapped the
  // user at their current scroll position when the modal opened —
  // reading as "page is stuck half way down" in their feedback. With
  // scrollIntoView gone there's nothing trying to scroll the window,
  // so letting the body scroll freely is harmless and feels normal.

  // Keep the active thumb in view. We do this manually on the strip's
  // own scroll container rather than scrollIntoView, which would walk
  // up to scrollable ancestors (including the now-locked body) and
  // could re-trigger the very jump we just fixed.
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  // Skip the very first run so opening the modal doesn't scroll the
  // strip; only react to subsequent currentId changes (arrow nav,
  // thumbnail clicks).
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const el = thumbRefs.current[currentId];
    const strip = thumbStripRef.current;
    if (!el || !strip) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;
    // Only scroll if the thumb is actually outside the strip's viewport.
    if (elLeft < viewLeft) {
      strip.scrollTo({ left: elLeft - 8, behavior: "smooth" });
    } else if (elRight > viewRight) {
      strip.scrollTo({
        left: elRight - strip.clientWidth + 8,
        behavior: "smooth",
      });
    }
  }, [currentId]);

  if (!photo) return null;

  const ocrViewAvailable = ocrState === "ok" && ocrDebug !== null;
  const faces = photo.faces ?? [];
  const faceViewAvailable = faces.length > 0;
  // OCR is allowed to be the active view even while the fetch is in flight —
  // we render a loading placeholder so the click feels responsive instead
  // of the old behavior where the first click silently bounced back to
  // Original until data landed. Face still falls back to Original when the
  // photo has no detected faces (no async fetch to wait on).
  const effectiveViewMode: "original" | "ocr" | "face" = (() => {
    if (viewMode === "ocr") {
      // Show OCR view while running, ok, or err — anything but plain idle.
      // Original wins only when the user genuinely hasn't engaged OCR.
      if (ocrState !== "idle") return "ocr";
      return "original";
    }
    if (viewMode === "face") {
      return faceViewAvailable ? "face" : "original";
    }
    return "original";
  })();

  const ocrBibs = photo.bibs.filter((b) => b.source.startsWith("ocr-"));
  const manualBibs = photo.bibs.filter(
    (b) => b.source === "manual" || b.source === "user-tag"
  );

  return (
    <div className="overlay" onClick={onClose} style={{ background: "rgba(28,26,23,.78)" }}>
      <div
        className="library-detail-grid"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 1240,
          width: "100%",
          background: "var(--paper)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gridTemplateRows: "minmax(0, 1fr)",
          overflow: "hidden",
          // dvh handles mobile chrome better, max-height keeps the modal
          // strictly inside the viewport so the right column's scroll
          // never gets clipped by the bottom of the page.
          height: "92dvh",
          maxHeight: "92dvh",
        }}
      >
        {/* Left pane: image (or Tesseract overlay) + thumbnail strip */}
        <div
          className="library-detail-photo"
          style={{
            position: "relative",
            background: "var(--cream)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 360,
            minWidth: 0,
          }}
        >
          {/* View toggle moved out of the image overlay and into its own
              row above the preview. Easier to scan + doesn't overlap the
              photo at small sizes. */}
          {(ocrViewAvailable || faceViewAvailable) && (
            <div
              role="tablist"
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 2,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
              }}
            >
              <ToggleChip
                active={effectiveViewMode === "original"}
                onClick={() => setViewMode("original")}
                label="Original"
              />
              <ToggleChip
                active={effectiveViewMode === "ocr"}
                onClick={() => {
                  if (!ocrViewAvailable && ocrState !== "running") {
                    void runOcrDebug();
                  }
                  // Flip view immediately — the image area renders a
                  // loading placeholder until ocrDebug lands, then
                  // automatically swaps in the Tesseract overlay.
                  setViewMode("ocr");
                }}
                label={ocrState === "running" ? "OCR…" : "OCR view"}
              />
              {faceViewAvailable && (
                <ToggleChip
                  active={effectiveViewMode === "face"}
                  onClick={() => setViewMode("face")}
                  label="Face view"
                />
              )}
            </div>
          )}

          {/* Image area — fills the remaining height above the strip */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {effectiveViewMode === "ocr" && ocrDebug ? (
              <OcrTesseractView debug={ocrDebug} />
            ) : effectiveViewMode === "ocr" ? (
              // OCR fetch is in flight (or just errored) — render a quiet
              // placeholder so the toggle click feels responsive. As soon
              // as ocrDebug lands, this swaps to the overlay above.
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: 24,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                <span>
                  {ocrState === "err"
                    ? "OCR failed — retry from the panel ↓"
                    : "Preparing OCR view…"}
                </span>
                <span style={{ fontSize: 10 }}>~5–25s</span>
              </div>
            ) : effectiveViewMode === "face" && previewDims ? (
              <FaceOverlayView
                previewUrl={photo.previewUrl}
                width={previewDims.w}
                height={previewDims.h}
                faces={faces}
                activeFaceId={activeFaceId}
                onFaceClick={(f) => void loadCluster(f)}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.previewUrl}
                alt={
                  photo.bibs.length
                    ? `Bibs ${photo.bibs.map((b) => b.bib).join(", ")}`
                    : "Race photo"
                }
                onLoad={(e) => {
                  // Capture natural dimensions so the face overlay can
                  // render in image pixel space. Skip if dims are already
                  // set (avoid a useless re-render).
                  const img = e.currentTarget;
                  if (!previewDims) {
                    setPreviewDims({
                      w: img.naturalWidth,
                      h: img.naturalHeight,
                    });
                  }
                }}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  display: "block",
                  borderRadius: 4,
                  boxShadow: "var(--shadow)",
                }}
              />
            )}

            {photo.hidden && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  padding: "4px 8px",
                  borderRadius: 3,
                }}
              >
                Hidden
              </span>
            )}

            {/* View toggle moved above the image — see toggle bar at the
                top of the .library-detail-photo column. */}

            {/* Prev/Next overlay arrows — visual cue that keyboard nav works.
                Only render when there's something to navigate between. */}
            {photos.length > 1 && (
              <>
                <NavArrow
                  dir="prev"
                  disabled={currentIndex <= 0}
                  onClick={goPrev}
                  aria-label="Previous photo"
                />
                <NavArrow
                  dir="next"
                  disabled={currentIndex < 0 || currentIndex >= photos.length - 1}
                  onClick={goNext}
                  aria-label="Next photo"
                />
              </>
            )}
          </div>

          {/* Thumbnail strip — only useful when there's more than one photo. */}
          {photos.length > 1 && (
            <ThumbStrip
              photos={photos}
              currentId={currentId}
              onSelect={onSelect}
              registerRef={(id, el) => {
                thumbRefs.current[id] = el;
              }}
              registerStripRef={(el) => {
                thumbStripRef.current = el;
              }}
              counterLabel={
                currentIndex >= 0 ? `${currentIndex + 1} / ${photos.length}` : ""
              }
            />
          )}
        </div>

        {/* Right pane: info + actions */}
        <div
          className="library-detail-info"
          style={{
            padding: 24,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Photo · {photo.id.slice(0, 14)}…
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <Section title="Bibs">
            {manualBibs.length === 0 && ocrBibs.length === 0 ? (
              <Muted>No bibs detected.</Muted>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {manualBibs.map((b) => (
                  <Chip
                    key={b.id}
                    text={`#${b.bib}`}
                    color="ink"
                    title={
                      onUntagBib
                        ? `Click to remove bib #${b.bib} from this photo`
                        : `manual · ${b.source}`
                    }
                    onRemove={onUntagBib ? () => onUntagBib(b.bib) : undefined}
                  />
                ))}
                {ocrBibs.map((b) => (
                  <Chip
                    key={b.id}
                    text={`#${b.bib} · ${Math.round(b.confidence * 100)}%`}
                    color="accent"
                    title={
                      onUntagBib
                        ? `Click to remove bib #${b.bib} from this photo`
                        : `${b.source} · conf ${(b.confidence * 100).toFixed(1)}%`
                    }
                    onRemove={onUntagBib ? () => onUntagBib(b.bib) : undefined}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Faces section — mirrors bibs. Cluster id (shortened) +
              confidence on each chip. Chips aren't removable yet; face
              edits go through rerun. */}
          <Section title="Faces">
            {faces.length === 0 ? (
              <Muted>No faces detected.</Muted>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {faces.map((f) => (
                  <FaceThumbChip
                    key={f.id}
                    cropUrl={`/api/photos/${photo.id}/face/${f.id}`}
                    confidence={f.confidence}
                    active={f.id === activeFaceId}
                    title={
                      f.faceClusterId
                        ? `Click to see this runner across the event · ${f.source} · cluster ${f.faceClusterId} · face id ${f.rekognitionFaceId ?? "—"}`
                        : `${f.source} · no cluster · face id ${f.rekognitionFaceId ?? "—"}`
                    }
                    onClick={f.faceClusterId ? () => void loadCluster(f) : undefined}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Cluster across event — appears once a face is picked. Mirrors the
              retired Face Lab's cluster grid: every photo in this event that
              Rekognition believes shows the same runner. Click a thumbnail to
              hop to that photo. */}
          {activeFaceId && (
            <Section title="Cluster across event">
              {clusterLoading ? (
                <Muted>Loading cluster…</Muted>
              ) : !clusterMembers ? null : clusterMembers.length === 0 ? (
                <Muted>No other photos found in this cluster.</Muted>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
                    gap: 6,
                  }}
                >
                  {clusterMembers.map((m) => (
                    <button
                      key={`${m.photoId}-${m.faceId}`}
                      type="button"
                      onClick={() => jumpToPhoto(m.photoId)}
                      title={`Conf ${(m.confidence * 100).toFixed(0)}% — open this photo`}
                      style={{
                        padding: 0,
                        border:
                          m.photoId === photo.id
                            ? "2px solid var(--accent)"
                            : "1px solid var(--line)",
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
                        loading="lazy"
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
            </Section>
          )}

          <Section title="Metadata">
            <KV label="Taken" value={fmtDate(photo.takenAt)} />
            <KV
              label="GPS"
              value={
                photo.gps
                  ? `${photo.gps[0].toFixed(5)}, ${photo.gps[1].toFixed(5)}`
                  : "—"
              }
            />
            <KV label="Uploaded" value={fmtDate(photo.createdAt)} />
            <KV label="Photographer" value={photo.photographer.name} />
            <KV label="Email" value={photo.photographer.email} muted />
          </Section>

          <Section title="Storage">
            <KV label="Original" value={photo.r2OriginalKey} mono small />
            <KV label="Preview" value={photo.r2PreviewKey} mono small />
          </Section>

          <Section title="Actions">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={onRerun}
                disabled={rerunState === "running"}
              >
                {rerunState === "running"
                  ? "Running OCR…"
                  : rerunState === "ok"
                    ? "✓ Re-run OCR"
                    : rerunState === "err"
                      ? "↻ Retry OCR"
                      : "Re-run bib OCR"}
              </button>
              {onRerunFace ? (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={onRerunFace}
                  disabled={rerunFaceState === "running"}
                >
                  {rerunFaceState === "running"
                    ? "Indexing faces…"
                    : rerunFaceState === "ok"
                      ? "✓ Re-run face"
                      : rerunFaceState === "err"
                        ? "↻ Retry face"
                        : "Re-run face detection"}
                </button>
              ) : (
                <button
                  className="btn btn--ghost btn--sm"
                  disabled
                  title="Face re-detection not wired in this view"
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                >
                  Re-run face (not wired)
                </button>
              )}
              <a
                className="btn btn--ghost btn--sm"
                href={`/api/photographer/photos/${photo.id}/download`}
                download={`${photo.id}.jpg`}
                style={{ textDecoration: "none", textAlign: "center" }}
              >
                Download original
              </a>
              <button
                className="btn btn--ghost btn--sm"
                onClick={onToggleHidden}
                disabled={hideState === "running"}
              >
                {hideState === "running"
                  ? "Saving…"
                  : photo.hidden
                    ? "Unhide photo"
                    : "Hide photo"}
              </button>
            </div>
            {hideState === "err" && (
              <Muted style={{ color: "var(--accent)" }}>
                Couldn&rsquo;t update — try again.
              </Muted>
            )}
          </Section>

          {/* OCR debug — controls + readouts. The big overlay lives in the
              left pane and replaces the original preview on success. Owners
              additionally get the full tuning panel (provider, preprocessing,
              bib-filter thresholds), folded in from the retired OCR Lab; runs
              are dispatched against those settings and cached per config. */}
          <Section title="OCR debug">
            {isOwner && (
              <OcrSettingsPanel
                settings={ocrSettings}
                onPatch={patchOcrSetting}
                onReset={() => setOcrSettings(DEFAULT_OCR_SETTINGS)}
              />
            )}
            <OcrDebugPanel
              debug={ocrDebug}
              state={ocrState}
              error={ocrError}
              onRun={() => void runOcrDebug()}
            />
          </Section>

          {/* Face debug — there's no separate intermediate fetch (Rekognition
              gives us bboxes directly on index, not a preprocessed image),
              so the panel summarizes what we have on the photo row + the
              rerun control. The bbox overlay is the "Face view" in the left
              pane (toggle above the image). */}
          <Section title="Face debug">
            <FaceDebugPanel
              faces={faces}
              rerunState={rerunFaceState}
              onRerun={onRerunFace}
            />
          </Section>

          <Section title="Danger zone">
            {deleteState === "confirm" || deleteState === "err" ? (
              <div
                style={{
                  background: "var(--cream)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--ink)",
                    marginBottom: 10,
                    lineHeight: 1.4,
                  }}
                >
                  {deleteState === "err"
                    ? "Delete failed — try again?"
                    : "Permanently delete this photo? Original + preview will be removed from R2. Can't be undone."}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={onConfirmDelete}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      background: "var(--accent)",
                      color: "var(--paper)",
                      border: 0,
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {deleteState === "err" ? "Retry delete" : "Yes, delete"}
                  </button>
                  <button
                    onClick={onCancelDelete}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      fontFamily: "var(--font-sans)",
                      fontSize: 13,
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn btn--ghost btn--sm"
                onClick={onAskDelete}
                disabled={deleteState === "running"}
                style={{ color: "var(--accent)" }}
              >
                {deleteState === "running" ? "Deleting…" : "Delete photo"}
              </button>
            )}
          </Section>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .library-detail-grid { grid-template-columns: 1fr !important; }
          .library-detail-photo { min-height: 300px !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * Modal-left-pane Face view: original preview with face bbox overlays.
 *
 * Rekognition stores bboxes in normalized [0,1] coords. We render as a
 * single SVG with the preview embedded — preserveAspectRatio="xMidYMid
 * meet" handles letterboxing, so the rects always align with the visible
 * image regardless of container size.
 *
 * Cluster id (or face id when no cluster) is shown above each box so you
 * can sanity-check the match against the per-photo Faces chips on the right.
 */
/**
 * Face chip with thumbnail. The thumbnail is the server-cropped face
 * (via /api/photos/[photoId]/face/[faceId]) — much more useful at a
 * glance than a truncated cluster id.
 *
 * Confidence is shown as a small overlay in the corner. Cluster + face
 * id move to the title tooltip so the chip stays compact.
 */
function FaceThumbChip({
  cropUrl,
  confidence,
  title,
  active,
  onClick,
}: {
  cropUrl: string;
  confidence: number;
  title?: string;
  /** Highlights the chip when its cluster is the one currently inspected. */
  active?: boolean;
  /** When set, the chip becomes a button that opens the cross-event cluster. */
  onClick?: () => void;
}) {
  const sharedStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    width: 48,
    height: 48,
    padding: 0,
    borderRadius: 4,
    overflow: "hidden",
    background: "var(--cream)",
    border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
    cursor: onClick ? "pointer" : "default",
  };
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cropUrl}
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
          bottom: 0,
          left: 0,
          right: 0,
          padding: "1px 4px",
          background: "rgba(28,26,23,.78)",
          color: "var(--paper)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".05em",
          textAlign: "center",
        }}
      >
        {Math.round(confidence)}%
      </span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} style={sharedStyle}>
        {inner}
      </button>
    );
  }
  return (
    <span title={title} style={sharedStyle}>
      {inner}
    </span>
  );
}

function FaceOverlayView({
  previewUrl,
  width,
  height,
  faces,
  activeFaceId,
  onFaceClick,
}: {
  previewUrl: string;
  width: number;
  height: number;
  faces: PhotoFaceTag[];
  activeFaceId?: string | null;
  onFaceClick?: (face: PhotoFaceTag) => void;
}) {
  // Aspect-locked wrapper mirrors the Original-view sizing: maxWidth +
  // maxHeight of 100%, aspectRatio fixed to the natural image dimensions.
  // Without this, an SVG with `width: 100%` + `viewBox` claimed the full
  // pane width regardless of natural aspect, blowing past the modal's
  // visual budget on landscape photos.
  return (
    <div
      style={{
        position: "relative",
        maxWidth: "100%",
        maxHeight: "100%",
        aspectRatio: `${width} / ${height}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Width/height auto so the aspect ratio + max constraints
        // determine the box; SVG fills it.
        width: "auto",
        height: "auto",
      }}
    >
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        borderRadius: 4,
        boxShadow: "var(--shadow)",
      }}
    >
      <image href={previewUrl} width={width} height={height} />
      {faces.map((f) => {
        const x = f.x0 * width;
        const y = f.y0 * height;
        const w = (f.x1 - f.x0) * width;
        const h = (f.y1 - f.y0) * height;
        const isActive = f.id === activeFaceId;
        const clickable = !!onFaceClick && !!f.faceClusterId;
        const stroke = isActive ? "var(--accent)" : "#3fd17d";
        const idShort = (f.faceClusterId ?? f.rekognitionFaceId ?? f.id).slice(0, 8);
        return (
          <g
            key={f.id}
            onClick={clickable ? () => onFaceClick!(f) : undefined}
            style={{ cursor: clickable ? "pointer" : "default" }}
          >
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={clickable ? "transparent" : "none"}
              stroke={stroke}
              strokeWidth={Math.max(w, h) * (isActive ? 0.02 : 0.012)}
              style={{ pointerEvents: clickable ? "all" : "none" }}
            />
            <text
              x={x}
              y={Math.max(y - 8, 18)}
              fill={stroke}
              fontSize={Math.max(h * 0.13, 16)}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              style={{ pointerEvents: "none" }}
            >
              {idShort}·{Math.round(f.confidence)}%
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/**
 * Right-pane face debug — analogue of OcrDebugPanel but the data lives
 * directly on the photo row (no separate intermediates endpoint needed).
 * Shows summary counts + per-face confidence/cluster, plus a rerun button
 * when the parent wired one up.
 */
function FaceDebugPanel({
  faces,
  rerunState,
  onRerun,
}: {
  faces: PhotoFaceTag[];
  rerunState: RerunState | undefined;
  onRerun: (() => void) | undefined;
}) {
  const totalFaces = faces.length;
  const clusters = new Set(
    faces.map((f) => f.faceClusterId).filter((c): c is string => !!c)
  ).size;
  const avgConf =
    totalFaces > 0 ? faces.reduce((s, f) => s + f.confidence, 0) / totalFaces : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {totalFaces === 0 ? (
        <Muted>
          No faces on this photo. Click re-run to index against Rekognition.
        </Muted>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: 6,
            }}
          >
            <MiniStat label="Faces" value={String(totalFaces)} />
            <MiniStat label="Clusters" value={String(clusters)} />
            <MiniStat label="Avg conf" value={`${avgConf.toFixed(0)}%`} />
          </div>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: 10,
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {faces.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 8,
                  fontSize: 11,
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                  {(f.faceClusterId ?? f.rekognitionFaceId ?? f.id).slice(0, 10)}
                </span>
                <span style={{ color: "var(--muted)" }}>{f.source}</span>
                <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {f.confidence.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {onRerun && (
        <button
          className="btn btn--ghost btn--sm"
          onClick={onRerun}
          disabled={rerunState === "running"}
          style={{ width: "100%" }}
        >
          {rerunState === "running"
            ? "Indexing faces… (~5–15s)"
            : rerunState === "err"
              ? "↻ Retry face indexing"
              : totalFaces === 0
                ? "Run face detection"
                : "↻ Re-run face detection"}
        </button>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 5,
        padding: "6px 8px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 17,
          fontWeight: 500,
          color: "var(--ink)",
          marginTop: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "4px 10px",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--ink)" : "var(--muted)",
        border: 0,
        borderRadius: 4,
        cursor: active ? "default" : "pointer",
        fontFamily: "inherit",
        fontSize: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function NavArrow({
  dir,
  disabled,
  onClick,
  "aria-label": ariaLabel,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        [dir === "prev" ? "left" : "right"]: 8,
        width: 36,
        height: 36,
        borderRadius: 999,
        background: "rgba(245,242,236,.85)",
        border: "1px solid var(--line)",
        color: disabled ? "var(--line)" : "var(--ink)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        lineHeight: 1,
        backdropFilter: "blur(4px)",
        boxShadow: "var(--shadow)",
      }}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );
}

function ThumbStrip({
  photos,
  currentId,
  onSelect,
  registerRef,
  registerStripRef,
  counterLabel,
}: {
  photos: DetailPhoto[];
  currentId: string;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
  /** Hands the strip's scroll container back up so the parent can
   *  scroll it on arrow nav without touching the window. */
  registerStripRef: (el: HTMLDivElement | null) => void;
  counterLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        ref={registerStripRef}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {photos.map((p) => {
          const active = p.id === currentId;
          return (
            <button
              key={p.id}
              ref={(el) => registerRef(p.id, el)}
              onClick={() => onSelect(p.id)}
              aria-label={`Open photo ${p.id.slice(0, 8)}`}
              aria-current={active ? "true" : undefined}
              style={{
                flex: "0 0 auto",
                width: 64,
                height: 44,
                padding: 0,
                background: "var(--surface)",
                border: active ? "2px solid var(--ink)" : "1px solid var(--line)",
                borderRadius: 4,
                cursor: active ? "default" : "pointer",
                overflow: "hidden",
                opacity: p.hidden ? 0.45 : 1,
                outline: "none",
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
                }}
              />
            </button>
          );
        })}
      </div>
      {counterLabel && (
        <span
          style={{
            flex: "0 0 auto",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {counterLabel}
        </span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  muted,
  mono,
  small,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        gap: 10,
        alignItems: "baseline",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: muted ? "var(--line)" : "var(--muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: small ? 11 : 13,
          color: muted ? "var(--muted)" : "var(--ink)",
          wordBreak: mono ? "break-all" : "normal",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Bib chip. When `onRemove` is set, the whole chip becomes a button — click
 * confirms then removes the tagging. The trailing × glyph signals it.
 * When unset, it renders as a static span (the library uses this mode).
 */
function Chip({
  text,
  color,
  title,
  onRemove,
}: {
  text: string;
  color: "ink" | "accent";
  title?: string;
  onRemove?: () => void | Promise<void>;
}) {
  const bg = color === "ink" ? "var(--ink)" : "var(--accent)";
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    background: bg,
    color: "var(--paper)",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: ".08em",
    borderRadius: 4,
  };

  if (!onRemove) {
    return (
      <span title={title} style={baseStyle}>
        {text}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        // Confirm so a mis-click in the modal doesn't silently nuke the
        // tagging. Server still validates, but the prompt prevents most
        // accidents and signals destructiveness.
        if (window.confirm(title || "Remove this tagging?")) void onRemove();
      }}
      style={{
        ...baseStyle,
        border: 0,
        cursor: "pointer",
      }}
    >
      <span>{text}</span>
      <span
        aria-hidden
        style={{
          fontSize: 14,
          lineHeight: 1,
          opacity: 0.75,
          marginLeft: 2,
        }}
      >
        ×
      </span>
    </button>
  );
}

function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        color: "var(--muted)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
