"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Admin-only (the server renders this solely for challenge admins): remove a
 * rower and their entire log from the board. Two-tap confirm, then back to
 * the board. */
export function RemoveRower({ participantId, name }: { participantId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/row100k/participants/${participantId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.push("/row100k#board");
        router.refresh();
        return;
      }
      setError(data.error ?? "Couldn't remove them — try again.");
    } catch {
      setError("Couldn't remove them — try again.");
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div>
      {confirming ? (
        <p className="mono" style={{ fontSize: 12, letterSpacing: ".06em" }}>
          REMOVE {name.toUpperCase()} AND THEIR WHOLE LOG?{" "}
          <button type="button" className="del-btn" disabled={busy} onClick={() => void remove()}>
            {busy ? "…" : "yes, remove"}
          </button>{" "}
          <button type="button" className="del-btn save" onClick={() => setConfirming(false)}>
            keep them
          </button>
        </p>
      ) : (
        <button type="button" className="quiet-btn" onClick={() => setConfirming(true)}>
          REMOVE THIS ROWER
        </button>
      )}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
