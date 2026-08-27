"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  TITLE_MAX,
  fmtSplit,
  nowMs,
  parseDurationText,
} from "@/lib/row100k";

/* Log-a-row form: day, meters, time, an optional title (the server invents
 * "Rowtember #N" when it's blank), and exactly TWO photos — you and the erg
 * screen, both required; this is an honor-system board and the photos are the
 * honor. One upload area takes both (the rower knows what to shoot), and the
 * server rejects anything but a pair. `defaultDay` comes from the server
 * (today clamped into September) so the SSR and hydrated renders agree.
 * `simulate` (dev preview only) skips the client-side phase re-check AND the
 * whole photo pipeline — no signing, no uploads, no required-photo gate — so
 * the open form can be seen before September. `onLogged` fires after a
 * successful save — the profile uses it to pop the share menu. */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/* Decode → draw to a canvas capped at MAX_EDGE on the long side → export
 * jpeg. Re-encoding to jpeg regardless of input sidesteps format headaches
 * (iPhone HEIC arrives as whatever the browser hands the canvas) and keeps
 * uploads small on gym wifi. */
async function downscaleToJpeg(file: File): Promise<Blob> {
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
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(srcUrl);
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

const PHOTO_CAP = 2;

const CANT_READ = "Couldn't read that photo — try a different one.";
const UPLOAD_FAILED = "Upload failed — check your signal and try again.";
// Mirrors the server's copy for a non-pair body, so pre-flight and API agree.
const TWO_REQUIRED = "Two photos required — you and the screen.";

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

/* The time field keeps the phone's digit pad (no colon key on iOS), so colons
 * are inserted for you, anchored on the right like a stopwatch: 2500 reads as
 * 25:00, 10215 as 1:02:15. A value the user punctuated themselves (a pasted
 * "20:41.3") is left exactly as typed. */
function formatTimeDigits(raw: string): string {
  if (/[.]/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

export function LogRow({
  defaultDay,
  defaultTitle,
  phase,
  earlyAdmin,
  simulate,
  onLogged,
}: {
  defaultDay: string;
  /* "Rowtember #4" — prefilled so the field is never blank; the rower can
     overwrite it. Recomputed server-side after each log lands. */
  defaultTitle?: string;
  phase: "before" | "open" | "closed";
  /* Challenge admin before Sep 1 — the server passes phase="open" for test
     rows, and the client-side clock check below must not close it again. */
  earlyAdmin?: boolean;
  simulate?: boolean;
  onLogged?: (entry: { day: string; meters: number; seconds: number }) => void;
}) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  const [metersText, setMetersText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [title, setTitle] = useState(defaultTitle ?? "");
  // When a log lands the server recomputes the default ("Rowtember #5") —
  // adopt it unless the rower typed their own title over the prefill.
  useEffect(() => {
    setTitle((t) => (t === "" || /^Rowtember #\d+$/.test(t) ? (defaultTitle ?? "") : t));
  }, [defaultTitle]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Set when a pick brought more files than there was room for.
  const [pickNote, setPickNote] = useState<string | null>(null);
  const shotSeq = useRef(0);
  // Ids of shots that are still wanted; async completions check membership.
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
  // Server-computed phase goes stale in a long-lived tab; re-derive from the
  // shared constants after mount (SSR and first client render still match).
  const [livePhase, setLivePhase] = useState(phase);
  useEffect(() => {
    if (simulate || earlyAdmin) return;
    const now = nowMs();
    setLivePhase(now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open");
  }, [phase, simulate, earlyAdmin]);

  if (livePhase === "before") {
    return (
      <p className="board-empty">
        LOGGING OPENS SEP 1. YOU&rsquo;RE IN — SHOW UP, ROW, COME BACK.
      </p>
    );
  }
  if (livePhase === "closed") {
    return <p className="board-empty">LOGGING IS CLOSED — SEPTEMBER&rsquo;S IN THE BOOKS.</p>;
  }

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
        blob = await downscaleToJpeg(file);
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
    if (simulate || files.length === 0) return;
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

  const clearShots = () => {
    liveShots.current.clear();
    for (const e of shots) dropPreview(e.preview);
    setShots([]);
    setPhotoError(null);
    setPickNote(null);
  };

  const meters = Math.round(Number(metersText.replace(/[,\s]/g, "")));
  const seconds = parseDurationText(timeText);
  const preview =
    Number.isFinite(meters) && meters >= 200 && seconds
      ? `${fmtSplit(meters, seconds)} /500m average`
      : "";
  const uploading = shots.some((e) => e.status === "uploading");
  // Keys in upload order — this array is the request's `photos` field.
  const readyKeys = shots.flatMap((e) => (e.status === "ready" && e.key ? [e.key] : []));

  const submit = async () => {
    setError(null);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError("How many meters?");
      return;
    }
    if (!seconds) {
      setError("Add your time — like 20:41 or 1:02:15.");
      return;
    }
    if (!simulate) {
      if (uploading) {
        setError("Hold on — a photo is still uploading.");
        return;
      }
      if (readyKeys.length !== PHOTO_CAP) {
        setError(TWO_REQUIRED);
        return;
      }
    }
    setStatus("sending");
    try {
      const trimmedTitle = title.trim();
      const body: Record<string, unknown> = { day, meters, seconds };
      if (trimmedTitle) body.title = trimmedTitle;
      if (!simulate) {
        body.photos = readyKeys;
      }
      const res = await fetch("/api/row100k/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMetersText("");
        setTimeText("");
        setTitle("");
        clearShots();
        setStatus("sent");
        router.refresh();
        onLogged?.({ day, meters, seconds });
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid2">
        <div>
          <label className="fl" htmlFor="log-day">Day</label>
          <input
            id="log-day"
            type="date"
            value={day}
            min={FIRST_DAY}
            max={LAST_DAY}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <div>
          <label className="fl" htmlFor="log-meters">Meters</label>
          <input
            id="log-meters"
            type="text"
            inputMode="numeric"
            placeholder="5000"
            value={metersText}
            onChange={(e) => setMetersText(e.target.value)}
          />
        </div>
        <div>
          <label className="fl" htmlFor="log-time">Time</label>
          <input
            id="log-time"
            type="text"
            inputMode="numeric"
            placeholder="2500 → 25:00"
            value={timeText}
            onChange={(e) => setTimeText(formatTimeDigits(e.target.value))}
          />
        </div>
        <div>
          <label className="fl" htmlFor="log-title">Title</label>
          <input
            id="log-title"
            type="text"
            maxLength={TITLE_MAX}
            placeholder="Title it — “Sunrise 10k”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      {/* One upload area for the pair. The rower knows the shots: you and the
        * screen. Tiles fill left to right in pick order; each done photo gets
        * a finger-sized remove, and removing reopens the add tile. This gets
        * used one-handed between the erg and the water fountain. */}
      <div>
        <label className="fl" htmlFor="log-photos">
          Photos — 2 required
        </label>
        <div style={{ display: "flex", gap: 10 }}>
          {shots.map((s, i) =>
            s.status === "ready" && s.preview ? (
              <div
                key={s.id}
                style={{ position: "relative", flex: 1, minWidth: 0, border: "2px solid var(--ink)" }}
              >
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
              htmlFor="log-photos"
              style={{
                ...tileBase,
                flex: 1,
                minWidth: 0,
                color: "var(--gray)",
                cursor: simulate ? "default" : "pointer",
              }}
            >
              {simulate
                ? "Preview — uploads off"
                : shots.length === 1
                  ? "1 of 2 — add the other"
                  : "+ Add 2 photos — you + the screen"}
            </label>
          )}
        </div>
        <input
          id="log-photos"
          type="file"
          accept="image/*"
          multiple
          disabled={Boolean(simulate) || shots.length >= PHOTO_CAP}
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
      <p className="split-live">{preview}</p>
      <button className="send" type="submit" disabled={status === "sending" || uploading}>
        {status === "sending" ? "…" : uploading ? "Uploading photo…" : "Log it"}
      </button>
      {status === "sent" && <p className="form-ok">LOGGED. THE BOARD KNOWS.</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
