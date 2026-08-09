"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDay, fmtDuration, fmtMeters, fmtSplit } from "@/lib/row100k";

export type MyRow = {
  id: string;
  day: string;
  meters: number;
  seconds: number;
  note: string;
};

/* The signed-in rower's own log, newest first, with a two-tap delete. */
export function MyRows({ rows, canDelete }: { rows: MyRow[]; canDelete: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) return null;

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
            <th>Note</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="num">{fmtDay(r.day)}</td>
              <td className="num">{fmtMeters(r.meters)}</td>
              <td className="num">{fmtDuration(r.seconds)}</td>
              <td className="num">{fmtSplit(r.meters, r.seconds)}</td>
              <td>{r.note}</td>
              <td style={{ textAlign: "right" }}>
                {!canDelete ? null : confirming === r.id ? (
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
                  <button type="button" className="del-btn" onClick={() => setConfirming(r.id)}>
                    delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
