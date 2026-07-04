"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToClipboard } from "./posterShare";
import { download } from "./shareCard";

/**
 * ShareModal — EVERY share flows through this preview; nothing downloads
 * blind. Give it a `render` closure that produces the canvas (sync or async,
 * null = unavailable); it previews via toDataURL and offers Copy-to-clipboard
 * (with a download fallback when the browser can't) and Download PNG.
 *
 * Re-renders whenever the `render` identity changes — so option chips passed
 * as `children` should flip parent state that hands down a NEW memoized
 * closure. `transparentable` puts the preview over a dark checkerboard so
 * alpha reads as alpha.
 *
 * Dark overlay, z-index 700; closes on backdrop click or Esc.
 */

const BG = "#14120f";
const CREAM = "#f5f2ec";
const MUTED = "#9a9186";
const AMBER = "#f0b060";
const HAIR = "rgba(245,242,236,0.12)";

const CHECKER: React.CSSProperties = {
  backgroundColor: "#26221d",
  backgroundImage:
    "linear-gradient(45deg, rgba(245,242,236,0.05) 25%, transparent 25%, transparent 75%, rgba(245,242,236,0.05) 75%), linear-gradient(45deg, rgba(245,242,236,0.05) 25%, transparent 25%, transparent 75%, rgba(245,242,236,0.05) 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 10px 10px",
};

export type ShareModalProps = {
  /** Mono eyebrow above the preview, e.g. "Leg 12 · story overlay". */
  title: string;
  filename: string;
  /** Produces the canvas to preview/copy/download. May be async; resolve or
   *  return null for "unavailable". Memoize in the parent. */
  render: () => HTMLCanvasElement | Promise<HTMLCanvasElement | null> | null;
  /** True when the CURRENT render has alpha → checkerboard behind it. */
  transparentable?: boolean;
  /** Copy shown when render() yields null (or the canvas is unusable). */
  unavailableMessage?: string;
  onClose: () => void;
  /** Option chips (transparent/dark, sorts, …) rendered under the preview. */
  children?: React.ReactNode;
};

export function ShareModal({
  title,
  filename,
  render,
  transparentable = false,
  unavailableMessage = "Preview unavailable.",
  onClose,
  children,
}: ShareModalProps) {
  const [status, setStatus] = useState<"rendering" | "ready" | "unavailable">("rendering");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "fallback">("idle");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Render (async-safe) whenever the closure changes; stale results from a
  // superseded closure are dropped via the cancelled flag.
  useEffect(() => {
    let cancelled = false;
    setStatus("rendering");
    (async () => {
      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await render();
      } catch {
        canvas = null;
      }
      if (cancelled) return;
      let url: string | null = null;
      if (canvas) {
        try {
          url = canvas.toDataURL("image/png");
        } catch {
          url = null; // tainted canvas — treat as unavailable
        }
      }
      if (cancelled) return;
      if (!canvas || !url) {
        canvasRef.current = null;
        setPreviewUrl(null);
        setStatus("unavailable");
        return;
      }
      canvasRef.current = canvas;
      setPreviewUrl(url);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [render]);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    []
  );

  const flashCopyState = useCallback((next: "copied" | "fallback") => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    setCopyState(next);
    copyTimerRef.current = window.setTimeout(() => setCopyState("idle"), 2000);
  }, []);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ok = await canvasToClipboard(canvas);
    if (!ok) download(canvas, filename); // clipboard unsupported → save it instead
    flashCopyState(ok ? "copied" : "fallback");
  }, [filename, flashCopyState]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) download(canvas, filename);
  }, [filename]);

  const ready = status === "ready";

  const copyLabel =
    copyState === "copied"
      ? "Copied ✓"
      : copyState === "fallback"
        ? "Copy unsupported — downloaded instead"
        : "Copy to clipboard";

  const actionBtn = (primary: boolean, enabled: boolean): React.CSSProperties => ({
    padding: "10px 22px",
    borderRadius: 999,
    border: `1px solid ${primary ? AMBER : HAIR}`,
    background: primary ? "rgba(240,176,96,0.10)" : "transparent",
    color: CREAM,
    fontFamily: "var(--font-mono)",
    fontSize: 11.5,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.45,
    transition: "opacity .15s ease, border-color .15s ease",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(10,9,7,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BG,
          border: `1px solid ${HAIR}`,
          borderRadius: 16,
          padding: "20px 22px 24px",
          maxWidth: "min(520px, 94vw)",
          width: "100%",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header: title + close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              color: MUTED,
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>

        {/* Preview */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 180,
          }}
        >
          {status === "rendering" && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: MUTED,
                letterSpacing: ".08em",
              }}
            >
              Rendering…
            </div>
          )}
          {status === "unavailable" && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: MUTED,
                letterSpacing: ".04em",
                textAlign: "center",
                padding: "0 12px",
              }}
            >
              {unavailableMessage}
            </div>
          )}
          {ready && previewUrl && (
            <div
              style={{
                border: `1px solid ${HAIR}`,
                borderRadius: 10,
                overflow: "hidden",
                padding: transparentable ? 8 : 0,
                ...(transparentable ? CHECKER : { background: BG }),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview of the share image"
                style={{
                  display: "block",
                  maxWidth: "min(420px, 78vw)",
                  maxHeight: "60vh",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  borderRadius: transparentable ? 6 : 0,
                }}
              />
            </div>
          )}
        </div>

        {/* Option chips from the parent */}
        {children && (
          <div
            style={{
              display: "flex",
              gap: "10px 12px",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 16,
            }}
          >
            {children}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 18,
          }}
        >
          <button type="button" onClick={handleCopy} disabled={!ready} style={actionBtn(true, ready)}>
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready}
            style={actionBtn(false, ready)}
          >
            ⇣ Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
