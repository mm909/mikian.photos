"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FaceScanner — a live-camera "scan your face" modal with a photo-upload
 * fallback. Captures a single frame to a JPEG File and hands it to
 * `onCapture` (the caller decides whether that's a fresh face search or an
 * additive one).
 *
 * Design notes:
 *  - getUserMedia needs a secure context (HTTPS or localhost). Where it's
 *    unavailable or denied we fall straight to the upload path, never a dead
 *    end — face search is always optional in this flow.
 *  - The MediaStream is stopped on every exit path (modal close, unmount,
 *    effect re-run). Leaving a track live keeps the camera indicator lit.
 *  - The preview is mirrored (scaleX(-1)) so it feels like a selfie; the
 *    captured canvas draws the raw (un-mirrored) frame, which is what we want
 *    to send to face recognition.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  /** Receives the captured/selected selfie. Caller runs the search. */
  onCapture: (file: File) => Promise<void>;
  /** True while the caller's search is in flight (← faceScanning). */
  busy?: boolean;
  title?: string;
  subtitle?: string;
};

type CamState = "idle" | "starting" | "live" | "denied" | "unavailable";

export function FaceScanner({
  open,
  onClose,
  onCapture,
  busy = false,
  title = "Scan your face",
  subtitle = "Center your face in the circle. We only use this to find your photos.",
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cam, setCam] = useState<CamState>("idle");
  const [note, setNote] = useState("");

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Start the camera when the modal opens; tear it down on close/unmount.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setNote("");

    const mediaDevices =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!mediaDevices?.getUserMedia) {
      setCam("unavailable");
      setNote("Camera isn't available here — upload a photo instead.");
      return;
    }

    setCam("starting");
    mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCam("live");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCam("denied");
          setNote("Camera access was blocked. You can upload a photo instead.");
        } else if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError" ||
          name === "OverconstrainedError"
        ) {
          setCam("unavailable");
          setNote("No camera found — upload a photo instead.");
        } else {
          setCam("unavailable");
          setNote("Couldn't start the camera — upload a photo instead.");
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  const handleClose = useCallback(() => {
    if (busy) return;
    stopStream();
    onClose();
  }, [busy, stopStream, onClose]);

  // Esc closes (the provider's global keydown only handles the lightbox).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  async function capture() {
    const video = videoRef.current;
    if (!video || cam !== "live" || busy) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
    );
    if (!blob) {
      setNote("Couldn't capture the frame — try again or upload a photo.");
      return;
    }
    // Keep the stream live through the call so a no-match can retry without a
    // permission re-prompt; a successful match unmounts us (cleanup stops it).
    await onCapture(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || busy) return;
    void onCapture(f);
  }

  if (!open) return null;

  const showUpload = cam === "denied" || cam === "unavailable";

  return (
    <div className="overlay" onClick={handleClose}>
      <div
        className="modal"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            className="icon-btn"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 14,
              color: "var(--muted)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {subtitle}
          </p>

          {!showUpload && (
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: 300,
                aspectRatio: "1 / 1",
                margin: "0 auto 18px",
                borderRadius: 999,
                overflow: "hidden",
                background: "var(--cream)",
                border: "1px solid var(--line)",
              }}
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                }}
              />
              {/* Face guide ring */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 18,
                  borderRadius: 999,
                  border: "2px dashed rgba(245,242,236,.7)",
                  pointerEvents: "none",
                }}
              />
              {(cam === "starting" || busy) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    background: "rgba(28,26,23,.55)",
                    color: "var(--paper)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      border: "3px solid rgba(245,242,236,.35)",
                      borderTopColor: "var(--paper)",
                      borderRadius: "50%",
                      animation: "spin .8s linear infinite",
                    }}
                  />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>
                    {busy ? "Scanning…" : "Starting camera…"}
                  </div>
                </div>
              )}
            </div>
          )}

          {note && (
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13,
                color: showUpload ? "var(--muted)" : "var(--accent)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              {note}
            </p>
          )}

          {showUpload ? (
            <button
              className="btn btn--primary btn--block"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Scanning…" : "Upload a photo"}
            </button>
          ) : (
            <>
              <button
                className="btn btn--primary btn--block"
                onClick={capture}
                disabled={cam !== "live" || busy}
              >
                {busy ? "Scanning…" : "Capture"}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={{
                  display: "block",
                  margin: "12px auto 0",
                  background: "transparent",
                  border: 0,
                  color: "var(--muted)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                or upload a photo instead
              </button>
            </>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={onFilePicked}
          />
        </div>
      </div>
    </div>
  );
}
