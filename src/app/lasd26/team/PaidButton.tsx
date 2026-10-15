"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * MARK PAID / UNMARK on a member row — the owner's hand-ledger for people
 * who paid him cash or Venmo instead of the card button. It calls the
 * settle-up builder's route, POST /api/lasd26/pay/mark {memberId, paid};
 * a 404 means that route is not built yet, and the button says so instead
 * of pretending.
 */
export function PaidButton({ memberId, paid, name }: { memberId: string; paid: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (busy) return;
    if (paid && !window.confirm(`Unmark ${name} as paid?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lasd26/pay/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, paid: !paid }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) router.refresh();
      else setError(data.error || (res.status === 404 ? "No such member any more" : "Did not save"));
    } catch {
      setError("Did not save");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="tm-btn row quiet" onClick={() => void toggle()} disabled={busy}>
        {busy ? "…" : paid ? "Unmark" : "Mark paid"}
      </button>
      {error && <span className="tm-err">{error}</span>}
    </>
  );
}
