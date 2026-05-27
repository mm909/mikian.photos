"use client";

import { useEffect } from "react";

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
  photo: DetailPhoto;
  rerunState: RerunState;
  deleteState: DeleteState;
  hideState: HideState;
  onClose: () => void;
  onRerun: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleHidden: () => void;
};

/**
 * Library detail view — opens when you click a photo card.
 *
 * Two-pane lightbox:
 *   left:  big preview, cropped only by viewport ("contain" so you see the
 *          whole frame, never cut)
 *   right: bib chips, metadata, R2 storage paths, all actions (rerun OCR,
 *          rerun face stub, download original, hide/unhide, delete)
 *
 * Esc + outside-click close. Actions are owned by the parent so optimistic
 * grid updates (delete-and-vanish) stay in sync with the modal.
 */
export function PhotoDetailModal({
  photo,
  rerunState,
  deleteState,
  hideState,
  onClose,
  onRerun,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
  onToggleHidden,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ocrBibs = photo.bibs.filter((b) => b.source.startsWith("ocr-"));
  const manualBibs = photo.bibs.filter((b) => b.source === "manual" || b.source === "user-tag");

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
          overflow: "hidden",
          maxHeight: "92vh",
        }}
      >
        {/* Photo pane */}
        <div
          className="library-detail-photo"
          style={{
            position: "relative",
            background: "var(--cream)",
            padding: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 360,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.previewUrl}
            alt={photo.bibs.length ? `Bibs ${photo.bibs.map((b) => b.bib).join(", ")}` : "Race photo"}
            style={{
              maxWidth: "100%",
              maxHeight: "82vh",
              objectFit: "contain",
              display: "block",
              borderRadius: 4,
              boxShadow: "var(--shadow)",
            }}
          />
          {photo.hidden && (
            <span
              style={{
                position: "absolute",
                top: 16,
                left: 16,
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
        </div>

        {/* Info + actions pane */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

          {/* Bib chips */}
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

          {/* Metadata */}
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
            <KV label="Mile" value={photo.mile ? `Mile ${photo.mile}` : "—"} />
            <KV label="Uploaded" value={fmtDate(photo.createdAt)} />
            <KV label="Photographer" value={photo.photographer.name} />
            <KV label="Email" value={photo.photographer.email} muted />
            <KV label="Face match" value="not yet built" muted />
          </Section>

          {/* Storage */}
          <Section title="Storage">
            <KV label="Original" value={photo.r2OriginalKey} mono small />
            <KV label="Preview" value={photo.r2PreviewKey} mono small />
          </Section>

          {/* Actions */}
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

          {/* Destructive section */}
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

function Chip({ text, color, title }: { text: string; color: "ink" | "accent"; title?: string }) {
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
