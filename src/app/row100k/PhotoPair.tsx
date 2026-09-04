"use client";

import { useEffect, useRef, useState } from "react";

/* The two-photo upload strip, shared by the log form (LogRow) and the row
 * editor (MyRows). One instance owns the whole pick → downscale → sign →
 * PUT pipeline and hands back just what a form needs: the strip to render,
 * whether an upload is in flight, and the R2 keys in pick order. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
/* Grid thumbnails — small enough that a feed page of them is nearly free. */
const THUMB_EDGE = 320;
const THUMB_QUALITY = 0.7;
export const PHOTO_CAP = 2;

const CANT_READ = "Couldn't read that photo — try a different one.";
const UPLOAD_FAILED = "Upload failed — check your signal and try again.";

/* Decode → draw to a canvas capped at maxEdge on the long side → export
 * jpeg. Re-encoding to jpeg regardless of input sidesteps format headaches
 * (iPhone HEIC arrives as whatever the browser hands the canvas) and keeps
 * uploads small on gym wifi. Called twice per photo: once for the main
 * upload, once for its grid thumbnail. */
async function downscaleToJpeg(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const srcUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = srcUrl;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("decode");
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

/* Best-effort thumbnail upload — SHARED by this hook and the gallery
 * uploader (Gallery.tsx imports it). Downscales `source` to a ~320px-long-
 * edge jpeg (~q0.7) and PUTs it next to the main object, at the key the
 * thumbKey() convention in photoUrls.ts derives from `mainKey` (".thumb"
 * spliced in before the extension). The sign request carries
 * { thumbFor: mainKey } so the sign route can mint that exact key; we only
 * PUT when the key the server hands back really is a .thumb. key — a server
 * that ignores thumbFor and mints a fresh main-style key gets NO upload, so
 * nothing stray ever joins a listing. Thumbs are pure display optimization:
 * every failure path returns quietly (the display side falls back to the
 * full image), and callers must NEVER let this reject a row or a gallery
 * publish — it never throws. */
export async function uploadThumbForKey(
  signEndpoint: string,
  mainKey: string,
  source: Blob,
): Promise<void> {
  try {
    const blob = await downscaleToJpeg(source, THUMB_EDGE, THUMB_QUALITY);
    const signRes = await fetch(signEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "image/jpeg",
        contentLength: blob.size,
        thumbFor: mainKey,
      }),
    });
    const sign = (await signRes.json().catch(() => ({}))) as {
      ok?: boolean;
      key?: string;
      url?: string;
    };
    if (
      !signRes.ok ||
      !sign.ok ||
      !sign.key ||
      !sign.url ||
      !/\.thumb\.[a-z0-9]+$/i.test(sign.key)
    ) {
      return; // route doesn't (yet) honor thumbFor — full image stays the display
    }
    await fetch(sign.url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: blob,
    });
  } catch {
    /* swallow — a missing thumb only costs bytes on the reader's side */
  }
}

/* One picked photo, in pick order. `id` is unique per pick and doubles as the
 * stale-async token: an upload only lands while its id is still in the live
 * set (remove and unmount both retire ids), so a PUT resolving late is
 * dropped before it can mint an object URL nobody would revoke. */
type Shot = {
  id: number;
  status: "uploading" | "ready";
  key?: string;
  preview?: string; // object URL for the thumbnail
};

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="var(--water)"
        strokeWidth="3"
        strokeDasharray="42"
        strokeDashoffset="16"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

/* Shared look for the photo tiles — thumbnail-height boxes in one flex row so
 * the pair sits side by side even on a phone. */
const tileBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  minHeight: 120,
  border: "2px dashed var(--line)",
  fontFamily: "var(--row-mono),monospace",
  fontSize: 12,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  textAlign: "center",
  padding: "12px 10px",
} as const;

export type PhotoPair = {
  /* The strip UI — thumbnails, spinner tiles, the add tile, notes/errors. */
  strip: React.ReactNode;
  /* True while any upload is in flight — block submits on it. */
  uploading: boolean;
  /* R2 keys of finished uploads, in pick order. */
  readyKeys: string[];
  /* Drop everything (after a successful submit, or on cancel). */
  clear: () => void;
};

export function usePhotoPair({
  inputId,
  disabled,
  disabledLabel,
  emptyLabel = "+ Add 2 photos — you + the screen",
}: {
  /* Unique per instance — ties the hidden file input to its add-tile label. */
  inputId: string;
  /* Uploads off (the dev preview) — the strip renders inert. */
  disabled?: boolean;
  disabledLabel?: string;
  emptyLabel?: string;
}): PhotoPair {
  const [shots, setShots] = useState<Shot[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const shotSeq = useRef(0);
  const liveShots = useRef<Set<number>>(new Set());
  // Every live object URL, so unmount can revoke whatever is still around.
  const previews = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = previews.current;
    const ids = liveShots.current;
    return () => {
      // Invalidate in-flight uploads first — a PUT resolving after unmount
      // would otherwise mint a fresh object URL nobody ever revokes.
      ids.clear();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const dropPreview = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previews.current.delete(url);
  };

  /* Downscale → sign (with the exact byte count) → PUT → land {key, preview}.
   * Appends an "uploading" shot immediately so pick order is upload order is
   * body order. A failed file drops just its own shot and says why; the other
   * upload, if any, keeps going. */
  const uploadOne = async (file: File) => {
    const id = ++shotSeq.current;
    liveShots.current.add(id);
    setShots((s) => [...s, { id, status: "uploading" }]);
    let failMsg = UPLOAD_FAILED;
    try {
      let blob: Blob;
      try {
        blob = await downscaleToJpeg(file, MAX_EDGE, JPEG_QUALITY);
      } catch {
        throw new Error((failMsg = CANT_READ));
      }
      const signRes = await fetch("/api/row100k/photos/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/jpeg", contentLength: blob.size }),
      });
      const sign = (await signRes.json().catch(() => ({}))) as {
        ok?: boolean;
        key?: string;
        url?: string;
        error?: string;
      };
      if (!signRes.ok || !sign.ok || !sign.key || !sign.url) {
        // Surface the API's own words (401/400/429/503 all send one).
        throw new Error((failMsg = sign.error ?? UPLOAD_FAILED));
      }
      const put = await fetch(sign.url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!put.ok) throw new Error(failMsg);
      // Grid thumbnail rides along after the main photo lands — best-effort
      // by design (uploadThumbForKey never throws), so a dead thumb upload
      // can NEVER fail the row. readyKeys stays MAIN keys only; the display
      // side derives the thumb key by convention and falls back to the full
      // image when no thumb exists.
      await uploadThumbForKey("/api/row100k/photos/sign", sign.key, blob);
      if (!liveShots.current.has(id)) return; // removed/unmounted mid-flight
      const preview = URL.createObjectURL(blob);
      previews.current.add(preview);
      setShots((s) =>
        s.map((e) => (e.id === id ? { id, status: "ready" as const, key: sign.key, preview } : e)),
      );
    } catch {
      if (!liveShots.current.has(id)) return;
      liveShots.current.delete(id);
      // The failed shot leaves the strip and the reason lands right under it.
      setShots((s) => s.filter((e) => e.id !== id));
      setPhotoError(failMsg);
    }
  };

  const handlePick = (files: File[]) => {
    if (disabled || files.length === 0) return;
    setPhotoError(null);
    setPickNote(null);
    const room = PHOTO_CAP - shots.length;
    if (room <= 0) return;
    const take = files.slice(0, room);
    if (files.length > take.length) {
      // More than fits: keep the first ones, in pick order, and say so.
      setPickNote(
        room === PHOTO_CAP
          ? "More than two picked — kept the first two."
          : "Only room for one more — kept the first.",
      );
    }
    for (const f of take) void uploadOne(f);
  };

  const removeShot = (id: number) => {
    const target = shots.find((e) => e.id === id);
    if (!target) return;
    liveShots.current.delete(id);
    dropPreview(target.preview);
    setShots((s) => s.filter((e) => e.id !== id));
    setPhotoError(null);
    setPickNote(null);
  };

  const clear = () => {
    liveShots.current.clear();
    for (const e of shots) dropPreview(e.preview);
    setShots([]);
    setPhotoError(null);
    setPickNote(null);
  };

  const strip = (
    <div>
      <div style={{ display: "flex", gap: 10 }}>
        {shots.map((s, i) =>
          s.status === "ready" && s.preview ? (
            <div
              key={s.id}
              style={{ position: "relative", flex: 1, minWidth: 0, border: "2px solid var(--ink)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.preview}
                alt={`Photo ${i + 1} of 2`}
                style={{ display: "block", width: "100%", height: 120, objectFit: "cover" }}
              />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => removeShot(s.id)}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 44,
                  height: 44,
                  border: "none",
                  background: "rgba(21,23,26,.82)",
                  color: "#fff",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div key={s.id} style={{ ...tileBase, flex: 1, minWidth: 0, color: "var(--water)" }}>
              <Spinner /> Uploading…
            </div>
          ),
        )}
        {shots.length < PHOTO_CAP && (
          <label
            htmlFor={inputId}
            style={{
              ...tileBase,
              flex: 1,
              minWidth: 0,
              color: "var(--gray)",
              cursor: disabled ? "default" : "pointer",
            }}
          >
            {disabled
              ? (disabledLabel ?? emptyLabel)
              : shots.length === 1
                ? "1 of 2 — add the other"
                : emptyLabel}
          </label>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        disabled={Boolean(disabled) || shots.length >= PHOTO_CAP}
        onChange={(e) => {
          // Materialize before resetting — clearing value empties the list.
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = ""; // same files re-pickable after a failure
          handlePick(files);
        }}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      />
      {pickNote && (
        <p
          style={{
            marginTop: 8,
            fontFamily: "var(--row-mono),monospace",
            fontSize: 12,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--gray)",
          }}
        >
          {pickNote}
        </p>
      )}
      {photoError && (
        <p className="form-err" style={{ marginTop: 8 }}>
          {photoError}
        </p>
      )}
    </div>
  );

  return {
    strip,
    uploading: shots.some((e) => e.status === "uploading"),
    readyKeys: shots.flatMap((e) => (e.status === "ready" && e.key ? [e.key] : [])),
    clear,
  };
}
