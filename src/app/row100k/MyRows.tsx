"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  TITLE_MAX,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtSplit,
  parseDurationText,
} from "@/lib/row100k";
import { formatTimeDigits } from "./LogRow";
import { PHOTO_CAP, usePhotoPair } from "./PhotoPair";

export type MyRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  title?: string;
  /* Display URLs for the row's photo pair (rower first), resolved
   * server-side; absent when the photos can't resolve. */
  photoUrls?: string[];
};

/* Thumbnails of a row's photo pair — each opens the full image. Shared by
 * the read rows here and the public log table (rendered server-side there
 * with the same markup). */
export function RowPhotoThumbs({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <span style={{ display: "flex", gap: 4, marginTop: 4 }}>
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt={i === 0 ? "The rower" : "The erg screen"}
            style={{
              display: "block",
              width: 42,
              height: 42,
              objectFit: "cover",
              border: "1px solid var(--line)",
            }}
            loading="lazy"
          />
        </a>
      ))}
    </span>
  );
}

/* The signed-in rower's own log, newest first (admins get the same controls
 * on any rower's page). Each row can be shared as a card, fixed in place —
 * day, meters, time, title, even the photo pair — or deleted with a two-tap
 * confirm. The editor spans two table rows: numbers up top, title and
 * photos in a full-width drawer beneath. */
export function MyRows({
  rows,
  canEdit,
  onShare,
}: {
  rows: MyRow[];
  canEdit: boolean;
  onShare?: (row: MyRow) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ day: "", meters: "", time: "", title: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One replacement strip serves whichever row is being edited — opening an
  // editor clears it, so uploads never leak across rows.
  const replacement = usePhotoPair({
    inputId: "edit-photos",
    emptyLabel: "+ Replace both photos",
  });

  if (rows.length === 0) return null;

  const startEdit = (r: MyRow) => {
    setError(null);
    setConfirming(null);
    setEditing(r.id);
    replacement.clear();
    setDraft({
      day: r.day,
      meters: String(r.meters),
      time: fmtDuration(r.seconds),
      title: r.title ?? "",
    });
  };

  const closeEdit = () => {
    setEditing(null);
    replacement.clear();
  };

  const save = async (id: string) => {
    setError(null);
    const meters = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
    const seconds = parseDurationText(draft.time);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError("How many meters?");
      return;
    }
    if (!seconds) {
      setError("Time looks off — use 20:41 or 1:02:15.");
      return;
    }
    if (replacement.uploading) {
      setError("Hold on — a photo is still uploading.");
      return;
    }
    // Photos are all-or-nothing: leave the strip empty to keep the current
    // pair, or upload a full new pair.
    if (replacement.readyKeys.length !== 0 && replacement.readyKeys.length !== PHOTO_CAP) {
      setError("A replacement needs both photos — you and the screen.");
      return;
    }
    setBusy(id);
    try {
      const body: Record<string, unknown> = { day: draft.day, meters, seconds };
      const trimmedTitle = draft.title.trim();
      if (trimmedTitle) body.title = trimmedTitle;
      if (replacement.readyKeys.length === PHOTO_CAP) body.photos = replacement.readyKeys;
      const res = await fetch(`/api/row100k/rows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        // Only close the editor if it's still on the row we saved — the user
        // may have opened another row's editor while this save was in flight.
        setEditing((prev) => {
          if (prev === id) {
            replacement.clear();
            return null;
          }
          return prev;
        });
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't save that fix — try again.");
      }
    } catch {
      setError("Couldn't save that fix — try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/row100k/rows/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) router.refresh();
      else setError(data.error ?? "Couldn't delete that row — try again.");
    } catch {
      setError("Couldn't delete that row — try again.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <div style={{ marginTop: 30, overflowX: "auto" }}>
      <table className="mine">
        <thead>
          <tr>
            <th>Day</th>
            <th>Meters</th>
            <th>Time</th>
            <th>/500m</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            editing === r.id ? (
              <Fragment key={r.id}>
                <tr>
                  <td>
                    <input
                      type="date"
                      aria-label="Day"
                      value={draft.day}
                      min={FIRST_DAY}
                      max={LAST_DAY}
                      onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Meters"
                      value={draft.meters}
                      onChange={(e) => setDraft((d) => ({ ...d, meters: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Time"
                      value={draft.time}
                      onChange={(e) => setDraft((d) => ({ ...d, time: formatTimeDigits(e.target.value) }))}
                    />
                  </td>
                  <td className="num" style={{ color: "var(--gray)" }}>
                    {(() => {
                      const m = Math.round(Number(draft.meters.replace(/[,\s]/g, "")));
                      const s = parseDurationText(draft.time);
                      return Number.isFinite(m) && m > 0 && s ? fmtSplit(m, s) : "—";
                    })()}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      className="del-btn save"
                      disabled={busy === r.id}
                      onClick={() => void save(r.id)}
                    >
                      {busy === r.id ? "…" : "save"}
                    </button>{" "}
                    <button type="button" className="del-btn" onClick={closeEdit}>
                      cancel
                    </button>
                  </td>
                </tr>
                {/* The drawer: title + photos, full width under the numbers. */}
                <tr>
                  <td colSpan={5} style={{ paddingTop: 0 }}>
                    <input
                      type="text"
                      aria-label="Title"
                      maxLength={TITLE_MAX}
                      placeholder="Title it — “Sunrise 10k”"
                      value={draft.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      style={{ marginBottom: 10 }}
                    />
                    {r.photoUrls && r.photoUrls.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 8,
                          fontFamily: "var(--row-mono),monospace",
                          fontSize: 11,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          color: "var(--gray)",
                        }}
                      >
                        Current <RowPhotoThumbs urls={r.photoUrls} />
                      </div>
                    )}
                    {replacement.strip}
                  </td>
                </tr>
              </Fragment>
            ) : (
              <tr key={r.id}>
                <td className="num">
                  {fmtDay(r.day)}
                  {r.title ? (
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--gray)",
                        whiteSpace: "normal",
                        maxWidth: "18ch",
                      }}
                    >
                      {r.title}
                    </span>
                  ) : null}
                  {r.photoUrls && r.photoUrls.length > 0 ? (
                    <RowPhotoThumbs urls={r.photoUrls} />
                  ) : null}
                </td>
                <td className="num">{fmtMeters(r.meters)}</td>
                <td className="num">{fmtDuration(r.seconds)}</td>
                <td className="num">{fmtSplit(r.meters, r.seconds)}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {confirming === r.id && canEdit ? (
                    <>
                      <button
                        type="button"
                        className="del-btn"
                        disabled={busy === r.id}
                        onClick={() => void remove(r.id)}
                      >
                        {busy === r.id ? "…" : "sure?"}
                      </button>{" "}
                      <button type="button" className="del-btn" onClick={() => setConfirming(null)}>
                        keep
                      </button>
                    </>
                  ) : (
                    <>
                      {onShare && (
                        <>
                          <button type="button" className="del-btn save" onClick={() => onShare(r)}>
                            share
                          </button>{" "}
                        </>
                      )}
                      {canEdit && (
                        <>
                          <button type="button" className="del-btn" onClick={() => startEdit(r)}>
                            edit
                          </button>{" "}
                          <button
                            type="button"
                            className="del-btn"
                            onClick={() => setConfirming(r.id)}
                          >
                            delete
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
