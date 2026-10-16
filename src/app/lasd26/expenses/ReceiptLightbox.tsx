"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

/**
 * The receipt viewer (owner, 2026-10-16: "right now when I click on the
 * receipt it opens in another page, it should open in a preview like
 * other images during Rowtember"). The Rowtember lightbox's shape
 * (src/app/row100k/Lightbox.tsx), cut down to one line's image receipts:
 *
 *   const [at, setAt] = useState<number | null>(null);
 *   {at !== null && <ReceiptLightbox title=… receipts={images} index={at} onIndex={setAt} onClose={() => setAt(null)} />}
 *
 * Render it ONLY while open; the parent owns the index. The overlay is
 * ink at 96 %, the full receipt sits in the middle through the existing
 * GET route (an <img src="/api/lasd26/expenses/receipt/<id>"> follows the
 * 302 to the presigned R2 link — nothing new on the server), with LOADING
 * under it until it lands. ‹ › step through the line's image receipts
 * (wrapped; hidden when there is one), as do the arrow keys and a 40 px
 * horizontal swipe; Escape, the ×, and a tap on the dark ground close it.
 * The body's scroll is locked while it is up and focus goes to the ×,
 * then back to the thumbnail that opened it on close. Tab stays inside.
 * PDFs never come here — the card keeps those as a chip that opens in a
 * new tab.
 *
 * Styles: .xp-lbx* in expensesCss.ts (under .lasd26, through LasdPage's
 * extraCss), so this file is markup and behaviour only.
 */

export type LightboxReceipt = { id: string; src: string; alt: string };

/** Horizontal pointer travel (px) that counts as a swipe rather than a tap. */
const SWIPE_PX = 40;

export function ReceiptLightbox({
  title,
  receipts,
  index,
  onIndex,
  onClose,
}: {
  /** The line's title, for the caption and the dialog's name. */
  title: string;
  receipts: LightboxReceipt[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = receipts.length;
  const root = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Which src has landed / failed: keyed by src rather than a flag, so a
  // step to the next receipt never shows the old one's "loaded".
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex],
  );

  // Keyboard: Escape closes, the arrows step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  // Mounted only while open: lock the page's scroll, remember what had
  // focus (the thumbnail button), move focus in, and put both back on
  // close.
  useEffect(() => {
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus();
    };
  }, []);

  // Preload the two neighbours so a step feels instant (each is a 302 to R2).
  useEffect(() => {
    if (count < 2) return;
    for (const d of [-1, 1]) {
      const im = new window.Image();
      im.src = receipts[(index + d + count) % count].src;
    }
  }, [index, count, receipts]);

  // Tab stays inside the dialog: wrap between the first and last control.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !root.current) return;
    const items = Array.from(root.current.querySelectorAll<HTMLElement>("button, a[href]")).filter((el) => !el.hidden);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // One pointer pair on the overlay covers both gestures: a mostly
  // horizontal drag of 40 px anywhere is a swipe; a short tap on the dark
  // ground itself (not the receipt, not a button) closes. A tap on the
  // receipt does nothing — it is there to be read, pinched on a phone.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      step(dx < 0 ? 1 : -1);
    } else if (e.target === e.currentTarget) {
      onClose();
    }
  };
  const onPointerCancel = () => {
    start.current = null;
  };

  const cur = receipts[index];
  if (!cur) return null;
  const loaded = loadedSrc === cur.src;
  const failed = failedSrc === cur.src;

  return (
    <div
      ref={root}
      className="xp-lbx"
      role="dialog"
      aria-modal="true"
      aria-label={`Receipts for ${title}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {!loaded && (
        <span className="xp-lbx-wait" aria-live="polite">
          {failed ? "COULD NOT LOAD THIS RECEIPT" : "LOADING…"}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- the route 302s to a presigned R2 link; next/image cannot follow it */}
      <img
        key={cur.id}
        src={cur.src}
        alt={cur.alt}
        draggable={false}
        className={loaded ? "in" : undefined}
        onLoad={() => setLoadedSrc(cur.src)}
        onError={() => setFailedSrc(cur.src)}
      />

      {count > 1 && (
        <button type="button" className="xp-lbx-btn xp-lbx-prev" onClick={() => step(-1)} aria-label="Previous receipt">
          &#8249;
        </button>
      )}
      {count > 1 && (
        <button type="button" className="xp-lbx-btn xp-lbx-next" onClick={() => step(1)} aria-label="Next receipt">
          &#8250;
        </button>
      )}
      <button ref={closeBtn} type="button" className="xp-lbx-btn xp-lbx-close" onClick={onClose} aria-label="Close the receipt">
        &#10005;
      </button>

      <div className="xp-lbx-cap">
        <span>
          {title} · {index + 1} / {count}
        </span>
        {/* The original in its own tab, for saving it — the only way out to another page now. */}
        <a href={cur.src} target="_blank" rel="noopener noreferrer">
          Open ↗
        </a>
      </div>
    </div>
  );
}
