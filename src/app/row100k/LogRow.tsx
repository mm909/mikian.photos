"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  fmtSplit,
  nowMs,
  parseDurationText,
} from "@/lib/row100k";

/* Shrink a photo in the browser before upload: phones shoot 3–10MB HEIC/JPEG
 * and Vercel's route-body ceiling is 4.5MB, so the canvas re-encode both
 * protects the limit and speeds up the post. Anything undecodable passes
 * through untouched and the server takes its own swing at it. */
async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 2_500_000 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/* Log-a-row form: day, meters, time and THE PHOTO — every row ships with one
 * (erg screen, the water, anything; honor system with receipts). `defaultDay`
 * comes from the server (today clamped into September) so the SSR and
 * hydrated renders agree. `simulate` (dev preview only) skips the client-side
 * phase re-check so the open form can be seen before September. `onLogged`
 * fires after a successful save — the profile uses it to pop the share menu. */
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = (file: File | null) => {
    setPhotoFile(file);
    setPhotoPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  };
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

  const meters = Math.round(Number(metersText.replace(/[,\s]/g, "")));
  const seconds = parseDurationText(timeText);
  const preview =
    Number.isFinite(meters) && meters >= 200 && seconds
      ? `${fmtSplit(meters, seconds)} /500m average`
      : "";

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
    if (!photoFile) {
      setError("Add a photo of the row — erg screen, the water, anything.");
      return;
    }
    setStatus("sending");
    try {
      const form = new FormData();
      form.set("day", day);
      form.set("meters", String(meters));
      form.set("seconds", String(seconds));
      form.set("photo", await shrinkPhoto(photoFile), "row.jpg");
      const res = await fetch("/api/row100k/rows", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMetersText("");
        setTimeText("");
        pickPhoto(null);
        if (photoInput.current) photoInput.current.value = "";
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
            placeholder="20:41 or 1:02:15"
            value={timeText}
            onChange={(e) => setTimeText(e.target.value)}
          />
        </div>
      </div>

      <label className="fl" htmlFor="log-photo">Photo — every row has receipts</label>
      <div className="photo-pick">
        <input
          ref={photoInput}
          id="log-photo"
          type="file"
          accept="image/*"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />
        <label htmlFor="log-photo" className={`photo-btn${photoFile ? " has" : ""}`}>
          {photoFile ? "SWAP THE PHOTO" : "ADD A PHOTO"}
        </label>
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreview} alt="Your row photo, ready to post" className="photo-thumb" />
        )}
      </div>
      <p className="split-live">{preview}</p>
      <button className="send" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "…" : "Log it"}
      </button>
      {status === "sent" && <p className="form-ok">LOGGED. THE BOARD KNOWS.</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
