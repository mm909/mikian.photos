"use client";

import { useCallback, useEffect, useRef } from "react";

/* ============================================================================
 * Shared Rowtember lightbox — the full-screen photo viewer extracted from the
 * gallery so the feed and the rower profile can reuse it verbatim.
 *
 * CONTROLLED API (adopters: render it ONLY while open, parent owns the index):
 *
 *   const [idx, setIdx] = useState<number | null>(null);
 *   ...
 *   {idx != null && (
 *     <Lightbox
 *       photos={media}                 // { full: string; alt?: string }[]
 *       index={idx}                    // which photo is showing
 *       onIndex={setIdx}               // called with the next index (wrapped)
 *       onClose={() => setIdx(null)}   // Escape / close button / backdrop tap
 *     />
 *   )}
 *
 * The component handles everything else itself: ArrowLeft/ArrowRight/Escape,
 * wrap-around stepping, 40px pointer swipe, tap-left/right-half navigation
 * (with the swipe-vs-click double-step guard), backdrop-tap close, chevrons
 * (hidden on touch), bottom counter, neighbor preload, and a body scroll lock
 * for as long as it is mounted.
 *
 * SELF-STYLED: it renders its own style tag with a .row100k-scoped css string
 * (.lbx- prefix), so a consuming page needs NO css wiring beyond being inside
 * a .row100k wrapper. Per the theme.ts hydration rule the css string contains
 * no double quotes, no angle brackets, no apostrophes.
 * ========================================================================== */

export type LightboxPhoto = { full: string; alt?: string };

/* Horizontal pointer travel (px) that counts as a swipe. */
const SWIPE_PX = 40;

const lightboxCss = `
.row100k .lbx{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;touch-action:pan-y}
.row100k .lbx img{max-width:92vw;max-height:88vh;width:auto;height:auto;object-fit:contain;display:block;user-select:none}
.row100k .lbx-arrow{position:absolute;top:50%;transform:translateY(-50%);appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:24px 18px;margin:0;color:#fff;font-family:var(--row-archivo),sans-serif;font-size:44px;line-height:1;cursor:pointer;opacity:.85}
.row100k .lbx-arrow:hover{opacity:1}
.row100k .lbx-prev{left:8px}
.row100k .lbx-next{right:8px}
.row100k .lbx-close{position:absolute;top:12px;right:16px;appearance:none;-webkit-appearance:none;background:none;border:0;border-radius:0;padding:12px;margin:0;color:#fff;font-family:var(--row-archivo),sans-serif;font-size:26px;line-height:1;cursor:pointer;opacity:.85}
.row100k .lbx-close:hover{opacity:1}
.row100k .lbx-counter{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:#8a8a85}
.row100k .lbx-arrow:focus,.row100k .lbx-close:focus{outline:none}
.row100k .lbx-arrow:focus-visible,.row100k .lbx-close:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (max-width:599px){.row100k .lbx-arrow{font-size:32px;padding:20px 10px}}
@media (hover:none) and (pointer:coarse){.row100k .lbx-arrow{display:none}}
`;

export function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = photos.length;
  const swipeStart = useRef<number | null>(null);
  const lastWasSwipe = useRef(false);

  const step = useCallback(
    (delta: number) => {
      if (count < 1) return;
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex],
  );

  // Keyboard: arrows advance, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  // Lock body scroll while mounted (the component only mounts while open).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Preload the two neighbors so arrowing feels instant.
  useEffect(() => {
    if (count < 2) return;
    for (const d of [-1, 1]) {
      const im = new window.Image();
      im.src = photos[(index + d + count) % count].full;
    }
  }, [index, count, photos]);

  // One pointer handler pair on the overlay covers both gestures: a long
  // horizontal drag anywhere is a swipe, a short tap on the backdrop itself
  // (not the photo or a button) closes. The photo itself never closes — a
  // tap on it navigates (see the img onClick below), so we remember whether
  // the gesture that just ended was a swipe to keep the trailing click event
  // from stepping a second time.
  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start == null) return;
    const delta = e.clientX - start;
    lastWasSwipe.current = Math.abs(delta) > SWIPE_PX;
    if (lastWasSwipe.current) {
      step(delta < 0 ? 1 : -1);
    } else if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Tap left half of the photo = previous, right half = next. Works with a
  // mouse too; on touch it replaces the chevrons, which CSS hides on
  // coarse-pointer devices.
  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (lastWasSwipe.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    step(e.clientX < rect.left + rect.width / 2 ? -1 : 1);
  };

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className="lbx"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <style>{lightboxCss}</style>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.full}
        alt={photo.alt ?? `Photo ${index + 1} of ${count}`}
        draggable={false}
        onClick={onImageClick}
      />

      <button
        type="button"
        className="lbx-arrow lbx-prev"
        onClick={() => step(-1)}
        aria-label="Previous photo"
      >
        &#10094;
      </button>
      <button
        type="button"
        className="lbx-arrow lbx-next"
        onClick={() => step(1)}
        aria-label="Next photo"
      >
        &#10095;
      </button>
      <button
        type="button"
        className="lbx-close"
        onClick={onClose}
        aria-label="Close viewer"
      >
        &#10005;
      </button>

      <span className="lbx-counter">
        {index + 1} / {count}
      </span>
    </div>
  );
}
