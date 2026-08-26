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

/* Log-a-row form: day, meters, time, an optional title, and photos — one of
 * you (required, this is an honor-system board and the photo is the honor),
 * one of the erg screen (optional). `defaultDay` comes from the server (today
 * clamped into September) so the SSR and hydrated renders agree. `simulate`
 * (dev preview only) skips the client-side phase re-check AND the whole
 * photo pipeline — no signing, no uploads, no required-photo gate — so the
 * open form can be seen before September. `onLogged` fires after a
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

type SlotId = "you" | "screen";
type SlotState = {
  status: "empty" | "uploading" | "ready";
  key?: string;
  preview?: string; // object URL for the thumbnail
  error?: string;
};
const EMPTY_SLOT: SlotState = { status: "empty" };

const CANT_READ = "Couldn't read that photo — try a different one.";
const UPLOAD_FAILED = "Upload failed — check your signal and try again.";
const YOU_REQUIRED = "Add a photo of yourself with the row — it's required.";

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

export function LogRow({
  defaultDay,
  phase,
  simulate,
  onLogged,
}: {
  defaultDay: string;
  phase: "before" | "open" | "closed";
  simulate?: boolean;
  onLogged?: (entry: { day: string; meters: number; seconds: number }) => void;
}) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  const [metersText, setMetersText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<SlotId, SlotState>>({
    you: EMPTY_SLOT,
    screen: EMPTY_SLOT,
  });
  // Stale-async guard: each pick bumps its slot's token; a finished upload
  // only lands if nothing replaced it in the meantime.
  const tokens = useRef<Record<SlotId, number>>({ you: 0, screen: 0 });
  // Every live object URL, so unmount can revoke whatever is still around.
  const previews = useRef<Set<string>>(new Set());
  useEffect(() => {
    const set = previews.current;
    const t = tokens.current;
    return () => {
      // Invalidate in-flight uploads first — a PUT resolving after unmount
      // would otherwise mint a fresh object URL nobody ever revokes.
      t.you += 1;
      t.screen += 1;
      for (const url of set) URL.revokeObjectURL(url);
      set.clear();
    };
  }, []);
  // Server-computed phase goes stale in a long-lived tab; re-derive from the
  // shared constants after mount (SSR and first client render still match).
  const [livePhase, setLivePhase] = useState(phase);
  useEffect(() => {
    if (simulate) return;
    const now = nowMs();
    setLivePhase(now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open");
  }, [phase, simulate]);

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

  const clearSlot = (slot: SlotId) => {
    tokens.current[slot] += 1;
    setSlots((s) => {
      dropPreview(s[slot].preview);
      return { ...s, [slot]: EMPTY_SLOT };
    });
  };

  const pickPhoto = async (slot: SlotId, file: File | null) => {
    if (!file || simulate) return;
    const token = ++tokens.current[slot];
    setSlots((s) => {
      dropPreview(s[slot].preview);
      return { ...s, [slot]: { status: "uploading" } };
    });
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
      if (tokens.current[slot] !== token) return; // replaced/removed mid-flight
      const preview = URL.createObjectURL(blob);
      previews.current.add(preview);
      setSlots((s) => ({ ...s, [slot]: { status: "ready", key: sign.key, preview } }));
    } catch {
      if (tokens.current[slot] !== token) return;
      // A failed upload clears the slot and says why, right under it.
      setSlots((s) => ({ ...s, [slot]: { status: "empty", error: failMsg } }));
    }
  };

  const meters = Math.round(Number(metersText.replace(/[,\s]/g, "")));
  const seconds = parseDurationText(timeText);
  const preview =
    Number.isFinite(meters) && meters >= 200 && seconds
      ? `${fmtSplit(meters, seconds)} /500m average`
      : "";
  const uploading = slots.you.status === "uploading" || slots.screen.status === "uploading";

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
      if (slots.you.status !== "ready" || !slots.you.key) {
        setError(YOU_REQUIRED);
        return;
      }
    }
    setStatus("sending");
    try {
      const trimmedTitle = title.trim();
      const body: Record<string, unknown> = { day, meters, seconds };
      if (trimmedTitle) body.title = trimmedTitle;
      if (!simulate) {
        body.photos = [slots.you.key, slots.screen.key].filter(Boolean);
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
        clearSlot("you");
        clearSlot("screen");
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

  /* One photo slot: a big tap target (whole box is the label — this gets
   * used one-handed between the erg and the water fountain), a thumbnail
   * with a finger-sized remove button once uploaded. */
  const photoSlot = (slot: SlotId, caption: string, hint: string) => {
    const s = slots[slot];
    const inputId = `log-photo-${slot}`;
    return (
      <div>
        <label className="fl" htmlFor={inputId}>
          {caption}
        </label>
        {s.status === "ready" && s.preview ? (
          <div style={{ position: "relative", border: "2px solid var(--ink)" }}>
            <img
              src={s.preview}
              alt={caption}
              style={{ display: "block", width: "100%", height: 120, objectFit: "cover" }}
            />
            <button
              type="button"
              aria-label={`Remove ${caption} photo`}
              onClick={() => clearSlot(slot)}
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
          <label
            htmlFor={inputId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 88,
              border: "2px dashed var(--line)",
              cursor: simulate || s.status === "uploading" ? "default" : "pointer",
              fontFamily: "var(--row-mono),monospace",
              fontSize: 12,
              letterSpacing: ".1em",
              color: s.status === "uploading" ? "var(--water)" : "var(--gray)",
              textTransform: "uppercase",
              textAlign: "center",
              padding: "12px 10px",
            }}
          >
            {s.status === "uploading" ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : simulate ? (
              "Preview — uploads off"
            ) : (
              hint
            )}
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          disabled={Boolean(simulate) || s.status === "uploading"}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0] ?? null;
            e.currentTarget.value = ""; // same file re-pickable after a failure
            void pickPhoto(slot, file);
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
        {s.error && (
          <p className="form-err" style={{ marginTop: 8 }}>
            {s.error}
          </p>
        )}
      </div>
    );
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
            placeholder="20:41 or 1:02:15"
            value={timeText}
            onChange={(e) => setTimeText(e.target.value)}
          />
        </div>
        <div>
          <label className="fl" htmlFor="log-title">Title</label>
          <input
            id="log-title"
            type="text"
            maxLength={TITLE_MAX}
            placeholder="Title it — “Sunrise 10k” (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div className="grid2">
        {photoSlot("you", "You — required", "+ Photo of you, mid-row")}
        {photoSlot("screen", "The screen — optional", "+ Photo of the monitor")}
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
