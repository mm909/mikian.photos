"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OcrDebugPanel,
  OcrTesseractView,
  type DebugPayload,
  type OcrState,
} from "./OcrDebugPanel";

export type BibTag = {
  id: string;
  bib: number;
  confidence: number;
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
  previewUrl: string;
  r2OriginalKey: string;
  r2PreviewKey: string;
};

export type RerunState = "idle" | "running" | "ok" | "err";
export type DeleteState = "idle" | "confirm" | "running" | "err";
export type HideState = "idle" | "running" | "err";

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
}: Props) {
  // OCR debug state — per photo. Reset whenever the user navigates.
  const [ocrState, setOcrState] = useState<OcrState>("idle");
  const [ocrDebug, setOcrDebug] = useState<DebugPayload | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  /** When true and ocrDebug is loaded, left pane renders the Tesseract view
   *  instead of the original preview. Auto-flips to true on first OCR success. */
  const [showOcrView, setShowOcrView] = useState(false);

  // Reset OCR state on photo change so we don't show a stale overlay over
  // the wrong image.
  useEffect(() => {
    setOcrState("idle");
    setOcrDebug(null);
    setOcrError(null);
    setShowOcrView(false);
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

  async function runOcrDebug() {
    if (!photo) return;
    setOcrState("running");
    setOcrError(null);
    try {
      const r = await fetch(`/api/photographer/photos/${photo.id}/ocr-debug`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      const d = (await r.json()) as DebugPayload;
      setOcrDebug(d);
      setOcrState("ok");
      // Auto-flip to the Tesseract view once we have one — that's the
      // whole point of running it.
      setShowOcrView(true);
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : String(e));
      setOcrState("err");
    }
  }

  // Scroll the active thumbnail into view when the user navigates with the
  // keyboard. Without this, the strip stays still and the active marker
  // disappears past the viewport edge.
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = thumbRefs.current[currentId];
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentId]);

  if (!photo) return null;

  const ocrViewActive = showOcrView && ocrState === "ok" && ocrDebug !== null;
  const ocrToggleAvailable = ocrState === "ok" && ocrDebug !== null;
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
          height: "92vh",
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
            gap: 14,
            minHeight: 360,
            minWidth: 0,
          }}
        >
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
            {ocrViewActive ? (
              <OcrTesseractView debug={ocrDebug!} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.previewUrl}
                alt={
                  photo.bibs.length
                    ? `Bibs ${photo.bibs.map((b) => b.bib).join(", ")}`
                    : "Race photo"
                }
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

            {/* View toggle — only appears once OCR debug has produced a payload */}
            {ocrToggleAvailable && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  display: "inline-flex",
                  background: "rgba(245,242,236,.92)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: 2,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  backdropFilter: "blur(4px)",
                }}
              >
                <ToggleChip
                  active={!showOcrView}
                  onClick={() => setShowOcrView(false)}
                  label="Original"
                />
                <ToggleChip
                  active={showOcrView}
                  onClick={() => setShowOcrView(true)}
                  label="OCR view"
                />
              </div>
            )}

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
                    title={`manual · ${b.source}`}
                  />
                ))}
                {ocrBibs.map((b) => (
                  <Chip
                    key={b.id}
                    text={`#${b.bib} · ${Math.round(b.confidence * 100)}%`}
                    color="accent"
                    title={`${b.source} · conf ${(b.confidence * 100).toFixed(1)}%`}
                  />
                ))}
              </div>
            )}
          </Section>

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
            <KV label="Face match" value="not yet built" muted />
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
              <button
                className="btn btn--ghost btn--sm"
                disabled
                title="Face detection isn't built yet"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              >
                Re-run face (coming)
              </button>
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

          {/* OCR debug — controls + readouts only. The big overlay lives in
              the left pane and replaces the original preview on success. */}
          <Section title="OCR debug">
            <OcrDebugPanel
              debug={ocrDebug}
              state={ocrState}
              error={ocrError}
              onRun={runOcrDebug}
            />
            <a
              href={`/photographer/ocr-lab?photo=${photo.id}`}
              className="btn btn--ghost btn--sm"
              style={{ marginTop: 8, textAlign: "center", textDecoration: "none" }}
            >
              Open in OCR Lab →
            </a>
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
  counterLabel,
}: {
  photos: DetailPhoto[];
  currentId: string;
  onSelect: (id: string) => void;
  registerRef: (id: string, el: HTMLButtonElement | null) => void;
  counterLabel: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
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

function Chip({
  text,
  color,
  title,
}: {
  text: string;
  color: "ink" | "accent";
  title?: string;
}) {
  const bg = color === "ink" ? "var(--ink)" : "var(--accent)";
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "4px 10px",
        background: bg,
        color: "var(--paper)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".08em",
        borderRadius: 4,
      }}
    >
      {text}
    </span>
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
