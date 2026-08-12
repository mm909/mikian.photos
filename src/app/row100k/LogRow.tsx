"use client";

import { useEffect, useState } from "react";
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

/* Log-a-row form: day, meters, time — nothing else (notes and quick-fill
 * buttons were cut 2026-08-10; the fewer fields between finishing a row and
 * hitting LOG IT, the better). `defaultDay` comes from the server (today
 * clamped into September) so the SSR and hydrated renders agree. `simulate`
 * (dev preview only) skips the client-side phase re-check so the open form
 * can be seen before September. `onLogged` fires after a successful save —
 * the profile uses it to pop the share menu. */
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
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
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
    setStatus("sending");
    try {
      const res = await fetch("/api/row100k/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, meters, seconds }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMetersText("");
        setTimeText("");
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
      <p className="split-live">{preview}</p>
      <button className="send" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "…" : "Log it"}
      </button>
      {status === "sent" && <p className="form-ok">LOGGED. THE BOARD KNOWS.</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
