"use client";

import { useEffect, useRef, useState } from "react";
import type { DeleteState } from "./PhotoDetailModal";

export type LibraryTilePhoto = {
  id: string;
  previewUrl: string;
  hidden: boolean;
  bibs: { bib: number }[];
};

type Props = {
  p: LibraryTilePhoto;
  /** OCR currently running on this photo? */
  running: boolean;
  /** Current delete state — drives the inline confirm + retry UX. */
  deleteState: DeleteState;
  /** Primary interaction — open the detail modal. */
  onOpen: () => void;
  /** Quick-action menu items. */
  onRerun: () => void;
  onToggleHidden: () => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

/**
 * Shared library tile.
 *
 * - Click anywhere on the photo → opens the detail modal (the deep dive).
 * - Hover → small ⋯ button appears in the top-right with quick actions:
 *     Re-run bib OCR · Hide / Unhide · Delete (two-step confirm).
 * - Photo never crops (object-fit: contain) — cream cell letterboxes.
 * - Status pulse dot shows in the corner while OCR is running.
 *
 * State machine is owned by the parent. The tile only signals intent via
 * callbacks so multiple consumers (library page, upload page) can share it
 * without duplicating data ownership.
 */
export function LibraryTile({
  p,
  running,
  deleteState,
  onOpen,
  onRerun,
  onToggleHidden,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: Props) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const showOverflow = hover || menuOpen;
  const inConfirm = deleteState === "confirm" || deleteState === "err";

  function onTileClick() {
    // Don't open the modal if the user clicked inside the menu region
    if (menuOpen) return;
    onOpen();
  }

  return (
    <div
      ref={wrapRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onTileClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTileClick();
        }
      }}
      title={p.bibs.length ? `Bibs ${p.bibs.map((b) => b.bib).join(", ")}` : "Untagged"}
      style={{
        position: "relative",
        aspectRatio: "3 / 2",
        background: "var(--cream)",
        cursor: "pointer",
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          borderRadius: 2,
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
            objectFit: "contain",
            display: "block",
            opacity: p.hidden ? 0.45 : 1,
          }}
        />
      </div>

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
            pointerEvents: "none",
          }}
        >
          Hidden
        </span>
      )}

      {running && (
        <span
          aria-label="ocr running"
          style={{
            position: "absolute",
            top: 8,
            right: showOverflow ? 38 : 8,
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "var(--accent)",
            boxShadow: "0 0 0 2px rgba(245,242,236,.85)",
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      )}

      {showOverflow && (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          title="Quick actions"
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: 5,
            background: "rgba(245,242,236,.92)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1,
            backdropFilter: "blur(4px)",
            zIndex: 3,
          }}
        >
          ⋯
        </button>
      )}

      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 36,
            right: 6,
            minWidth: 180,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "var(--shadow-lg)",
            padding: 4,
            zIndex: 4,
          }}
        >
          {!inConfirm ? (
            <>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRerun();
                }}
                style={menuItemStyle()}
              >
                Re-run bib OCR
              </button>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onToggleHidden();
                }}
                style={menuItemStyle()}
              >
                {p.hidden ? "Unhide" : "Hide"}
              </button>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskDelete();
                }}
                style={{ ...menuItemStyle(), color: "var(--accent)" }}
              >
                Delete
              </button>
            </>
          ) : (
            <div style={{ padding: "6px 8px" }}>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  color: "var(--ink)",
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                {deleteState === "err" ? "Delete failed — retry?" : "Delete this photo?"}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirmDelete();
                    setMenuOpen(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    background: "var(--accent)",
                    color: "var(--paper)",
                    border: 0,
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {deleteState === "err" ? "Retry" : "Delete"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelDelete();
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
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
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1;   transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}

function menuItemStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: 0,
    padding: "7px 10px",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--ink)",
    cursor: "pointer",
    borderRadius: 4,
  };
}
