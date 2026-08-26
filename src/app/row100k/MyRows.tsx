"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FIRST_DAY,
  LAST_DAY,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtSplit,
  parseDurationText,
} from "@/lib/row100k";

export type MyRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  title?: string;
};

/* The signed-in rower's own log, newest first. Each row can be shared as a
 * card, fixed in place — day, meters, time — or deleted with a two-tap
 * confirm. */
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
  const [draft, setDraft] = useState({ day: "", meters: "", time: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const startEdit = (r: MyRow) => {
    setError(null);
    setConfirming(null);
    setEditing(r.id);
    setDraft({ day: r.day, meters: String(r.meters), time: fmtDuration(r.seconds) });
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
    setBusy(id);
    try {
      const res = await fetch(`/api/row100k/rows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: draft.day, meters, seconds }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        // Only close the editor if it's still on the row we saved — the user
        // may have opened another row's editor while this save was in flight.
        setEditing((prev) => (prev === id ? null : prev));
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
              <tr key={r.id}>
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
                    onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
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
                  <button type="button" className="del-btn" onClick={() => setEditing(null)}>
                    cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td className="num">
                  {fmtDay(r.day)}
                  {r.title ? (
                    // Session title, display-only (the edit flow fixes
                    // numbers, not names).
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
