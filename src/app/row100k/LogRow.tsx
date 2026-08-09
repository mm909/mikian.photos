"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  fmtSplit,
  parseDurationText,
} from "@/lib/row100k";

const QUICK = [
  { label: "1K PIECE", meters: 1000 },
  { label: "5K PIECE", meters: 5000 },
  { label: "10K PIECE", meters: 10000 },
];

/* Log-a-row form. `defaultDay` comes from the server (today clamped into
 * September) so the SSR and hydrated renders agree. `simulate` (dev preview
 * only) skips the client-side phase re-check so the open form can be seen
 * before September. */
export function LogRow({
  defaultDay,
  phase,
  simulate,
}: {
  defaultDay: string;
  phase: "before" | "open" | "closed";
  simulate?: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  const [metersText, setMetersText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  // Server-computed phase goes stale in a long-lived tab; re-derive from the
  // shared constants after mount (SSR and first client render still match).
  const [livePhase, setLivePhase] = useState(phase);
  useEffect(() => {
    if (simulate) return;
    const now = Date.now();
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
        body: JSON.stringify({ day, meters, seconds, note: note.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setMetersText("");
        setTimeText("");
        setNote("");
        setStatus("sent");
        router.refresh();
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
        <div>
          <label className="fl" htmlFor="log-note">Note (optional)</label>
          <input
            id="log-note"
            type="text"
            maxLength={200}
            placeholder="steady state"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <div className="quick" aria-label="Quick distances for the record boards">
        {QUICK.map((q) => (
          <button key={q.meters} type="button" onClick={() => setMetersText(String(q.meters))}>
            {q.label}
          </button>
        ))}
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
