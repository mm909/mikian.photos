"use client";

import { useEffect, useState } from "react";
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
import { PHOTO_CAP, usePhotoPair } from "./PhotoPair";

/* Log-a-row form: day, meters, time, an optional title (the server invents
 * "Rowtember #N" when it's blank), and exactly TWO photos — you and the erg
 * screen, both required; this is an honor-system board and the photos are the
 * honor. One upload area takes both (the rower knows what to shoot) — the
 * pipeline lives in PhotoPair, shared with the row editor — and the server
 * rejects anything but a pair. `defaultDay` comes from the server (today
 * clamped into September) so the SSR and hydrated renders agree. `simulate`
 * (dev preview only) skips the client-side phase re-check AND the whole photo
 * pipeline — no signing, no uploads, no required-photo gate — so the open
 * form can be seen before September. `onLogged` fires after a successful
 * save — the profile uses it to pop the share menu. */

// Mirrors the server's copy for a non-pair body, so pre-flight and API agree.
const TWO_REQUIRED = "Two photos required — you and the screen.";

/* The time field keeps the phone's digit pad (no colon key on iOS), so colons
 * are inserted for you, anchored on the right like a stopwatch: 2500 reads as
 * 25:00, 10215 as 1:02:15. A value the user punctuated themselves (a pasted
 * "20:41.3") is left exactly as typed. */
export function formatTimeDigits(raw: string): string {
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
  const photos = usePhotoPair({
    inputId: "log-photos",
    disabled: simulate,
    disabledLabel: "Preview — uploads off",
  });
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
    if (!simulate) {
      if (photos.uploading) {
        setError("Hold on — a photo is still uploading.");
        return;
      }
      if (photos.readyKeys.length !== PHOTO_CAP) {
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
        body.photos = photos.readyKeys;
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
        photos.clear();
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
      <div>
        <label className="fl" htmlFor="log-photos">
          Photos — 2 required
        </label>
        {photos.strip}
      </div>
      <p className="split-live">{preview}</p>
      <button className="send" type="submit" disabled={status === "sending" || photos.uploading}>
        {status === "sending" ? "…" : photos.uploading ? "Uploading photo…" : "Log it"}
      </button>
      {status === "sent" && <p className="form-ok">LOGGED. THE BOARD KNOWS.</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
