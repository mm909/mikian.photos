"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  SANITY_FALLBACK,
  START_MS,
  TITLE_MAX,
  clampDay,
  fmtMeters,
  fmtSplit,
  nowMs,
  pacificDay,
  parseDurationText,
  splitSeconds,
  type SanityBand,
} from "@/lib/row100k";
import { PHOTO_CAP, usePhotoPair } from "./PhotoPair";

/* Log-a-row form. Two tiers (owner call, 2026-09-05): METERS and TIME are
 * the numbers — big Archivo Black digits over an underline, the live /500m
 * split under them — and the DAY and TITLE sit beneath a dashed hairline as
 * the inferred, secondary pair. Then exactly TWO photos — you and the erg
 * screen, both required; this is an honor-system board and the photos are
 * the honor. One upload area takes both (the rower knows what to shoot) —
 * the pipeline lives in PhotoPair, shared with the row editor — and the
 * server rejects anything but a pair.
 *
 * The day is a date only, never a time: it defaults to the Pacific day and
 * the picker cannot reach past it (the server draws its future line at the
 * same day); any past September day is fine. `defaultDay` comes from the
 * server so the SSR and hydrated renders agree. The title is prefilled
 * ("Rowtember #N", recomputed after each log) and the rower can overwrite it.
 *
 * There is no minimum — every meter counts — but a row outside the band the
 * field has actually logged (`sanity`, drawn server-side; the sane rowing
 * numbers when absent) gets a second-look strip instead of a send: FIX IT
 * or LOG IT ANYWAY. It never blocks; the server keeps its loose hard band.
 *
 * `simulate` (dev preview only) skips the client-side phase re-check AND the
 * whole photo pipeline — no signing, no uploads, no required-photo gate — so
 * the open form can be seen before September. `onLogged` fires after a
 * successful save — the profile uses it to pop the share menu. The form
 * carries its own `panel flat logf` classes so it looks the same wherever it
 * is mounted, with or without a parent panel. */

// Mirrors the server's copy for a non-pair body, so pre-flight and API agree.
const TWO_REQUIRED = "Two photos required — you and the screen.";
// Mirrors validateEntry's future rule, so the form can say it without a round trip.
const NOT_YET = "You can't log a row you haven't rowed yet.";

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

/* "1:55" from seconds per 500 m — a band edge, so no tenths. */
function fmtSplitEdge(sec: number): string {
  const t = Math.round(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/* What the second-look strip should say, or null when the row sits inside
 * the band. The split is checked first: a wrong split is almost always a
 * typo in one of the two big fields, and that is the thing to fix. */
type SecondLook = { kind: "fast" | "slow"; split: string } | { kind: "long" };

function secondLook(band: SanityBand, meters: number, seconds: number): SecondLook | null {
  const split = splitSeconds(meters, seconds);
  if (split < band.splitLo) return { kind: "fast", split: fmtSplit(meters, seconds) };
  if (split > band.splitHi) return { kind: "slow", split: fmtSplit(meters, seconds) };
  if (meters > band.metersHi) return { kind: "long" };
  return null;
}

export function LogRow({
  defaultDay,
  defaultTitle,
  phase,
  earlyAdmin,
  simulate,
  sanity,
  onLogged,
}: {
  /* Pacific today clamped into September — the picker's default AND its
     latest allowed pick. */
  defaultDay: string;
  /* "Rowtember #4" — prefilled so the field is never blank; the rower can
     overwrite it. Recomputed server-side after each log lands. */
  defaultTitle?: string;
  phase: "before" | "open" | "closed";
  /* Challenge admin before Sep 1 — the server passes phase="open" for test
     rows, and the client-side clock check below must not close it again. */
  earlyAdmin?: boolean;
  simulate?: boolean;
  /* The plausibility band (sanity.ts). Optional: the front page mounts the
     form without one and gets the rowing-club defaults. */
  sanity?: SanityBand;
  onLogged?: (entry: { day: string; meters: number; seconds: number; title?: string }) => void;
}) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  // The latest day the picker offers. Admins testing before Sep 1 need the
  // whole month (the server waives the future rule for them too).
  const [maxDay, setMaxDay] = useState(earlyAdmin ? LAST_DAY : defaultDay);
  // The server's day goes stale in a tab left open past midnight, so both
  // the default and the ceiling are re-derived from the shared clock after
  // mount (SSR and first client render still match) — unless the rower has
  // already picked a day themselves.
  const dayTouched = useRef(false);
  useEffect(() => {
    const today = clampDay(pacificDay(nowMs()));
    setMaxDay(earlyAdmin ? LAST_DAY : today);
    if (!dayTouched.current) setDay(today);
  }, [earlyAdmin]);
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
  const [ask, setAsk] = useState<SecondLook | null>(null);
  const metersRef = useRef<HTMLInputElement>(null);
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
  const hasPair = Number.isFinite(meters) && meters >= 1 && Boolean(seconds);
  const band = sanity ?? SANITY_FALLBACK;

  /* `anyway` is the LOG IT ANYWAY answer: every hard check runs again (a
   * photo could have been pulled while the strip was up), only the second
   * look is skipped. */
  const submit = async (anyway = false) => {
    setError(null);
    setAsk(null);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError("How many meters?");
      return;
    }
    if (!seconds) {
      setError("Add your time — like 20:41 or 1:02:15.");
      return;
    }
    // A typed date can slip past the picker's max; say what the server will.
    if (!earlyAdmin && day > maxDay) {
      setError(NOT_YET);
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
    if (!anyway) {
      const look = secondLook(band, meters, seconds);
      if (look) {
        setAsk(look);
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
        // The just-logged share card wants the title; a blank field means the
        // server stored the prefilled default, which is what defaultTitle is.
        onLogged?.({ day, meters, seconds, title: trimmedTitle || defaultTitle });
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  const fixIt = () => {
    setAsk(null);
    metersRef.current?.focus();
    metersRef.current?.select();
  };

  return (
    <form
      className="panel flat logf"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="logf-big">
        <div>
          <label className="fl" htmlFor="log-meters">Meters</label>
          <input
            ref={metersRef}
            className="logf-num"
            id="log-meters"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="5000"
            value={metersText}
            onChange={(e) => {
              setAsk(null);
              setMetersText(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="fl" htmlFor="log-time">Time</label>
          <input
            className="logf-num"
            id="log-time"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="25:00"
            value={timeText}
            onChange={(e) => {
              setAsk(null);
              setTimeText(formatTimeDigits(e.target.value));
            }}
          />
        </div>
      </div>
      <p className="split-live">
        {hasPair && seconds ? (
          <>
            <b>{fmtSplit(meters, seconds)}</b> /500m average
          </>
        ) : null}
      </p>

      <div className="logf-small">
        <div>
          <label className="fl" htmlFor="log-day">Day</label>
          <input
            id="log-day"
            type="date"
            value={day}
            min={FIRST_DAY}
            max={maxDay}
            onChange={(e) => {
              dayTouched.current = true;
              setDay(e.target.value);
            }}
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

      <div className="logf-photos">
        <label className="fl" htmlFor="log-photos">
          Photos — 2 required
        </label>
        {photos.strip}
      </div>

      {ask && (
        <div className="logf-ask" role="alert">
          <span className="k">Take another look</span>
          <p>
            {ask.kind === "long" ? (
              <>
                That is <b>{fmtMeters(meters)}</b> in one row; nearly every row logged so far
                is under <b>{fmtMeters(band.metersHi)}</b>.
              </>
            ) : (
              <>
                That is a <b>{ask.split}</b> split; most rows sit between{" "}
                <b>{fmtSplitEdge(band.splitLo)}</b> and <b>{fmtSplitEdge(band.splitHi)}</b>.
              </>
            )}
          </p>
          <div className="logf-ask-acts">
            <button type="button" className="outline-btn" onClick={fixIt}>
              Fix it
            </button>
            <button type="button" className="outline-btn" onClick={() => void submit(true)}>
              Log it anyway
            </button>
          </div>
        </div>
      )}

      <button className="send" type="submit" disabled={status === "sending" || photos.uploading}>
        {status === "sending" ? "…" : photos.uploading ? "Uploading photo…" : "Log it"}
      </button>
      {status === "sent" && <p className="form-ok">LOGGED. THE BOARD KNOWS.</p>}
      {error && <p className="form-err">{error}</p>}
    </form>
  );
}
