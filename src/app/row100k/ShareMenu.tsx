"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { availableCards, type ShareData, type ShareFonts } from "./share/cards";

/* The shareables menu: a card picker, a live preview, and the three ways off
 * the page — share sheet (phones), copy to clipboard (paste straight into a
 * story), download (everything else).
 *
 * Two exports:
 *   ShareDialog — the controlled modal. The profile opens it automatically
 *     right after a row is logged, so parents own the open state.
 *   ShareMenu   — a plain SHARE-A-CARD button wrapping ShareDialog, for
 *     places that just need the entry point.
 *
 * Knows nothing about what any card looks like; that all lives in
 * share/cards.ts. Adding a card doesn't touch this file. */

type Status = { kind: "idle" | "done" | "error"; message?: string };

export function ShareDialog({
  data,
  open,
  onClose,
  preferredCardId,
  only,
}: {
  data: ShareData;
  open: boolean;
  onClose: () => void;
  /* Card to land on when the dialog opens (e.g. "rowtember-row" right after
   * logging). Only applied on the open transition — picking is yours after. */
  preferredCardId?: string;
  /* Restrict the picker to these card ids (e.g. the community cards on the
   * stats page). Order still comes from CARDS. */
  only?: string[];
}) {
  const cards = availableCards(data).filter((c) => !only || only.includes(c.id));
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && preferredCardId) {
      const pool = availableCards(data).filter((c) => !only || only.includes(c.id));
      if (pool.some((c) => c.id === preferredCardId)) {
        setCardId(preferredCardId);
      }
    }
    wasOpen.current = open;
  }, [open, preferredCardId, data, only]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blackProbe = useRef<HTMLSpanElement | null>(null);
  const monoProbe = useRef<HTMLSpanElement | null>(null);

  /* Resolve inside the (possibly restricted) pool; an empty pool — `only`
   * naming cards the data can't unlock — renders nothing rather than crashing. */
  const card = cards.find((c) => c.id === cardId) ?? cards[0];

  const paint = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !card) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The page's webfonts are what make the card look like the page.
    try {
      await document.fonts.ready;
    } catch {
      /* older browsers just paint in the fallback */
    }

    const fonts: ShareFonts = {
      black: blackProbe.current
        ? window.getComputedStyle(blackProbe.current).fontFamily
        : "sans-serif",
      mono: monoProbe.current
        ? window.getComputedStyle(monoProbe.current).fontFamily
        : "monospace",
    };

    canvas.width = card.width;
    canvas.height = card.height;
    ctx.clearRect(0, 0, card.width, card.height);
    card.draw(ctx, data, fonts);
  }, [card, data]);

  useEffect(() => {
    if (!open) return;
    void paint();
  }, [open, paint]);

  useEffect(() => {
    if (!open) return;
    setStatus({ kind: "idle" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Resolved after mount, never during render: the server can't know whether
  // this browser has a share sheet or a writable clipboard, and branching on
  // it inline would render buttons the server HTML doesn't have. Clipboard
  // needs a secure context — on plain http (LAN-IP phone testing) the API
  // doesn't exist at all, so the COPY button hides instead of failing.
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  useEffect(() => {
    setCanShareFiles(typeof navigator.canShare === "function");
    setCanCopy(
      typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function" &&
        window.isSecureContext,
    );
  }, []);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });

  /* Community cards are everyone's — no rower number in the name. */
  const filename = !card
    ? "rowtember.png"
    : card.id.startsWith("rowtember-community")
      ? `${card.id}.png`
      : `rowtember-${data.rowerNumber}-${card.id}.png`;

  async function onCopy() {
    // Safari wants the write to START inside the click gesture, so hand
    // ClipboardItem a promise; Chromiums that predate promise items get the
    // awaited-blob fallback.
    try {
      const pending = toBlob().then((b) => {
        if (!b) throw new Error("no image");
        return b;
      });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pending })]);
      setStatus({ kind: "done", message: "COPIED — PASTE IT INTO YOUR STORY" });
    } catch {
      try {
        const blob = await toBlob();
        if (!blob) throw new Error("no image");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus({ kind: "done", message: "COPIED — PASTE IT INTO YOUR STORY" });
      } catch {
        setStatus({ kind: "error", message: "COULDN'T COPY — DOWNLOAD INSTEAD" });
      }
    }
  }

  async function onDownload() {
    const blob = await toBlob();
    if (!blob) return setStatus({ kind: "error", message: "COULDN'T MAKE THE IMAGE" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: "done", message: "SAVED" });
  }

  async function onShare() {
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("no image");
      const file = new File([blob], filename, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file] });
      setStatus({ kind: "idle" });
    } catch (err) {
      // Dismissing the share sheet rejects with AbortError — that's a choice,
      // not a failure, so say nothing.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus({ kind: "error", message: "SHARING ISN'T AVAILABLE — COPY OR DOWNLOAD" });
    }
  }

  return (
    <>
      {/* Font probes: invisible, but they carry the page's real families. */}
      <span ref={blackProbe} aria-hidden className="share-probe blk" />
      <span ref={monoProbe} aria-hidden className="share-probe mono" />

      {open && card && (
        <div
          className="share-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Share a card"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="share-modal">
            <div className="share-head">
              <span className="mono">SHAREABLES</span>
              <button type="button" className="share-x" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>

            {cards.length > 1 && (
              <div className="share-picker">
                {cards.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`share-pick${c.id === card.id ? " on" : ""}`}
                    aria-pressed={c.id === card.id}
                    onClick={() => setCardId(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <div className={`share-stage${card.light ? " dark" : ""}`}>
              <canvas ref={canvasRef} className="share-canvas" />
            </div>

            <div className="share-actions">
              {canShareFiles && (
                <button type="button" className="share-btn primary" onClick={onShare}>
                  SHARE
                </button>
              )}
              {canCopy && (
                <button type="button" className="share-btn" onClick={onCopy}>
                  COPY IMAGE
                </button>
              )}
              <button type="button" className="share-btn" onClick={onDownload}>
                DOWNLOAD
              </button>
            </div>

            {status.message && (
              <p className={`share-status mono${status.kind === "error" ? " bad" : ""}`}>
                {status.message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* The plain entry point: one button, opens the dialog. */
export function ShareMenu({
  data,
  big,
  only,
}: {
  data: ShareData;
  big?: boolean;
  only?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={big ? "big-act" : "quiet-btn"}
        onClick={() => setOpen(true)}
      >
        SHARE A CARD
      </button>
      <ShareDialog data={data} open={open} onClose={() => setOpen(false)} only={only} />
    </>
  );
}
