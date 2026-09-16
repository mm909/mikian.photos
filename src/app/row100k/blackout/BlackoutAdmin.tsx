"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nowMs } from "@/lib/row100k";
import { fmtPacificStamp, msToPacificLocal, pacificLocalToIso } from "@/lib/blackoutRules";

/* One window as the admin page hands it over — ISO instants plus a state
 * the SERVER worked out against nowMs(), so the list hydrates identically
 * on both sides (a window edge crossing between render and hydrate would
 * otherwise flip a label). */
export type AdminWindow = {
  id: string;
  startsAt: string;
  endsAt: string;
  /* Days of run-up before the window: the elite lose one more digit of
   * their total a day, from the ones up. 0 = none. */
  rampDays: number;
  reason: string;
  state: "active" | "upcoming" | "past";
};

const STATE_WORD: Record<AdminWindow["state"], string> = {
  active: "ACTIVE NOW",
  upcoming: "UPCOMING",
  past: "OVER",
};

/* Admin-only (the page 404s everyone else): set, edit and clear blackout
 * windows. Times are typed and shown as Pacific — the fixed UTC-7 the
 * whole challenge runs on — and stored as UTC instants by the API.
 *
 * One form does both jobs (owner, 2026-09-16: "allow me to edit a black
 * out that is already set"): EDIT on a row loads it into the form, the
 * heading says so, and the save goes out as a PATCH instead of a POST.
 * CANCEL empties the form and it is a new window again. */
export function BlackoutAdmin({ windows }: { windows: AdminWindow[] }) {
  const router = useRouter();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [rampDays, setRampDays] = useState("0");
  /* The window being edited, or null for a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const clearForm = () => {
    setStartsAt("");
    setEndsAt("");
    setReason("");
    setRampDays("0");
    setEditingId(null);
  };

  // The shape of the first soft launch: open now, lift in seven days.
  const oneWeek = () => {
    const now = nowMs();
    setStartsAt(msToPacificLocal(now));
    setEndsAt(msToPacificLocal(now + 7 * 86_400_000));
    setError(null);
  };

  const edit = (w: AdminWindow) => {
    const s = Date.parse(w.startsAt);
    const e = Date.parse(w.endsAt);
    setStartsAt(Number.isFinite(s) ? msToPacificLocal(s) : "");
    setEndsAt(Number.isFinite(e) ? msToPacificLocal(e) : "");
    setReason(w.reason);
    setRampDays(String(w.rampDays));
    setEditingId(w.id);
    setConfirmId(null);
    setError(null);
    setOk(null);
    // The form sits above the table: bring it back into view.
    if (typeof document !== "undefined") {
      document.getElementById("bo-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const cancelEdit = () => {
    clearForm();
    setError(null);
    setOk(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = pacificLocalToIso(startsAt);
    const en = pacificLocalToIso(endsAt);
    if (!s || !en) {
      setError("Both times are needed.");
      return;
    }
    if (Date.parse(en) <= Date.parse(s)) {
      setError("The end has to come after the start.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    const editing = editingId;
    try {
      const res = await fetch("/api/row100k/blackout", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing } : {}),
          startsAt: s,
          endsAt: en,
          reason,
          rampDays: Number(rampDays) || 0,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setOk(
          `${editing ? "WINDOW UPDATED" : "BLACKOUT SET"} — ${fmtPacificStamp(s)} → ${fmtPacificStamp(en)}`,
        );
        clearForm();
        // The list is server-rendered from the table: re-render it.
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't save that — try again.");
      }
    } catch {
      setError("Couldn't save that — try again.");
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setRemoving(id);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/row100k/blackout", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setOk("WINDOW REMOVED");
        // Removing the window on the form makes it a new one again.
        if (editingId === id) clearForm();
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't remove that — try again.");
      }
    } catch {
      setError("Couldn't remove that — try again.");
    }
    setRemoving(null);
    setConfirmId(null);
  };

  const editingRow = editingId ? windows.find((w) => w.id === editingId) : undefined;

  return (
    <>
      <form id="bo-form" className="panel" onSubmit={(e) => void submit(e)}>
        <div className="p-head">
          <h3>{editingId ? "Edit window" : "New window"}</h3>
          <span className="mono">
            {editingRow ? `EDITING — ${STATE_WORD[editingRow.state]} · PACIFIC TIME` : "PACIFIC TIME"}
          </span>
        </div>

        <label className="fl" htmlFor="bo-start">
          Blackout from
        </label>
        <input
          id="bo-start"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          required
        />

        <label className="fl" htmlFor="bo-end">
          To
        </label>
        <input
          id="bo-end"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          required
        />

        <label className="fl" htmlFor="bo-ramp">
          Run-up — how many days it takes before the window, 0 for none
        </label>
        <input
          id="bo-ramp"
          type="number"
          min={0}
          max={14}
          value={rampDays}
          onChange={(e) => setRampDays(e.target.value)}
        />

        <label className="fl" htmlFor="bo-reason">
          Reason — optional, admin eyes only
        </label>
        <input
          id="bo-reason"
          type="text"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Soft launch week"
        />

        <div className="act-row">
          <button type="button" className="outline-btn" onClick={oneWeek}>
            One week from now
          </button>
          {editingId && (
            <button type="button" className="outline-btn" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>

        <button type="submit" className="send" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Set blackout"}
        </button>
        {error && <p className="form-err">{error}</p>}
        {ok && <p className="form-ok">{ok}</p>}
      </form>

      <div className="sec-head" style={{ marginTop: 40 }}>
        <h2>Windows</h2>
        <span className="mono">{windows.length === 1 ? "1 WINDOW" : `${windows.length} WINDOWS`}</span>
      </div>
      {windows.length === 0 ? (
        <p className="board-empty">NO BLACKOUT WINDOWS SET — THE BOARD IS FULLY VISIBLE.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Run-up</th>
                <th>Reason</th>
                <th>State</th>
                <th aria-label="Edit or remove" />
              </tr>
            </thead>
            <tbody>
              {windows.map((w) => (
                <tr key={w.id} className={editingId === w.id ? "fin" : undefined}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtPacificStamp(w.startsAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtPacificStamp(w.endsAt)}</td>
                  <td className="bo-ramp">
                    {w.rampDays > 0 ? `${w.rampDays}D` : <span style={{ color: "var(--gray)" }}>—</span>}
                  </td>
                  <td>{w.reason || <span style={{ color: "var(--gray)" }}>—</span>}</td>
                  <td>
                    <span
                      className={`bo-state ${w.state === "active" ? "on" : w.state === "upcoming" ? "next" : ""}`}
                    >
                      {STATE_WORD[w.state]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {confirmId === w.id ? (
                      <>
                        <button
                          type="button"
                          className="del-btn"
                          disabled={removing === w.id}
                          onClick={() => void remove(w.id)}
                        >
                          {removing === w.id ? "…" : "yes, remove"}
                        </button>{" "}
                        <button type="button" className="del-btn save" onClick={() => setConfirmId(null)}>
                          keep
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="del-btn save"
                          disabled={editingId === w.id}
                          onClick={() => edit(w)}
                        >
                          {editingId === w.id ? "editing" : "edit"}
                        </button>{" "}
                        <button type="button" className="del-btn" onClick={() => setConfirmId(w.id)}>
                          remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
