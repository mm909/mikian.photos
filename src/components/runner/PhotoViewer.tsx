"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ViewerPhoto = { id: string; src: string };

/** Owner featuring hooked into the viewer — renders a ★ button in the bar and
 *  binds the `f` key to toggle the current photo. `canFeature` is false for
 *  non-owners (button hidden, key ignored). */
export type FeatureControls = {
  canFeature: boolean;
  isFeatured: (photoId: string) => boolean;
  toggle: (photoId: string) => void;
};

type Props = {
  photos: ViewerPhoto[];
  /** Index of the currently shown photo. */
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  /** Right-side action slot in the top bar — e.g. a "Save photo" button on the
   *  order screen. Receives the photo in view. */
  actions?: (photo: ViewerPhoto, index: number) => React.ReactNode;
  /** Owner-only ★ feature toggle (button + `f` key). Omit for buyer views. */
  feature?: FeatureControls;
  /** Paginated source (the event gallery): when true, paging past the last
   *  LOADED photo loads the next page instead of looping to the first. */
  hasMore?: boolean;
  /** Fetch the next page; awaited so paging can advance straight into it. */
  onLoadMore?: () => void | Promise<void>;
};

/**
 * Full-bleed, Google-Photos-style photo viewer.
 *
 * Portaled to <body> (an ancestor's retained transform would otherwise capture
 * position:fixed). Stateless about *which* photo shows — the parent owns
 * `index` — so the same viewer drives the order screen, gallery, and results.
 * Arrow keys / on-screen arrows / swipe page; Esc closes; `f` toggles feature
 * (owner). At the end of a paginated set it pulls the next page rather than
 * looping.
 */
export function PhotoViewer({
  photos,
  index,
  onClose,
  onIndex,
  actions,
  feature,
  hasMore,
  onLoadMore,
}: Props) {
  const total = photos.length;
  const clamped = Math.max(0, Math.min(index, total - 1));
  const photo = photos[clamped];

  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Latest-state ref: the keyboard handler binds once (empty-deps effect) but
  // must always act on the current index / pagination / feature closures.
  const liveRef = useRef({ clamped, total, hasMore, onLoadMore, feature, photo, onIndex, onClose });
  liveRef.current = { clamped, total, hasMore, onLoadMore, feature, photo, onIndex, onClose };

  async function goNext() {
    const { clamped, total, hasMore, onLoadMore, onIndex } = liveRef.current;
    if (clamped >= total - 1) {
      // At the last loaded photo. If the source can page, load the next page
      // and step into it; only loop back to the start when nothing's left.
      if (hasMore && onLoadMore) {
        await onLoadMore();
        onIndex(clamped + 1); // parent grew `photos`; clamps back if it didn't
        return;
      }
      onIndex(0);
    } else {
      onIndex(clamped + 1);
    }
  }
  function goPrev() {
    const { clamped, total, onIndex } = liveRef.current;
    onIndex(clamped <= 0 ? total - 1 : clamped - 1);
  }
  function toggleFeatureCurrent() {
    const { feature, photo } = liveRef.current;
    if (feature?.canFeature && photo) feature.toggle(photo.id);
  }

  // Keyboard: ← → page, Esc close, f feature. Bound once; reads liveRef.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") void goNext();
      else if (e.key === "Escape") liveRef.current.onClose();
      else if (e.key === "f" || e.key === "F") toggleFeatureCurrent();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus management + body-scroll lock while open.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  // Minimal focus trap: keep Tab within the dialog's controls.
  function onKeyDownTrap(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const root = overlayRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, a[href], [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Swipe: a dominantly-horizontal drag past the threshold flips photos; the
  // trailing synthetic tap-zone click is swallowed.
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const swipedRef = useRef(false);
  const SWIPE_PX = 50;
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
    swipedRef.current = false;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      swipedRef.current = true;
      if (dx < 0) void goNext();
      else goPrev();
    }
  }
  function onTapZone(go: () => void) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      go();
    };
  }

  if (!photo) return null;

  const isFeatured = feature?.canFeature ? feature.isFeatured(photo.id) : false;

  return createPortal(
    <div
      ref={overlayRef}
      className="pv-overlay"
      onClick={onClose}
      onKeyDown={onKeyDownTrap}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <div className="pv-bar" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="pv-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div
          className="pv-count"
          role="status"
          aria-live="polite"
          aria-label={`Photo ${clamped + 1} of ${total}`}
        >
          {clamped + 1}
          <span className="pv-count-sep" aria-hidden="true">
            /
          </span>
          {total}
        </div>
        <div className="pv-actions">
          {feature?.canFeature && (
            <button
              type="button"
              className={`pv-feature${isFeatured ? " pv-feature--on" : ""}`}
              onClick={toggleFeatureCurrent}
              aria-pressed={isFeatured}
              title={
                isFeatured
                  ? "Featured on the landing — press f to remove"
                  : "Feature on the landing (press f)"
              }
            >
              <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
                {isFeatured ? "★" : "☆"}
              </span>
              {isFeatured ? "Featured" : "Feature"}
            </button>
          )}
          {actions?.(photo, clamped)}
        </div>
      </div>

      <div className="pv-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.src}
          alt=""
          className="pv-img"
          onClick={(e) => e.stopPropagation()}
        />

        {total > 1 && (
          <>
            <button
              type="button"
              className="pv-tapzone pv-tapzone--left"
              onClick={onTapZone(goPrev)}
              aria-label="Previous photo"
            />
            <button
              type="button"
              className="pv-tapzone pv-tapzone--right"
              onClick={onTapZone(() => void goNext())}
              aria-label="Next photo"
            />
          </>
        )}

        {total > 1 && (
          <>
            <button
              className="pv-arrow pv-arrow--left"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className="pv-arrow pv-arrow--right"
              onClick={(e) => {
                e.stopPropagation();
                void goNext();
              }}
              aria-label="Next"
            >
              ›
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
