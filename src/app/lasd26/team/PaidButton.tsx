"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberStatus } from "@/lib/lasd26/settle";

/**
 * The owner's hand on a member row — POST /api/lasd26/pay/mark — in
 * whichever direction the row points (owner, 2026-10-16: someone who
 * fronted gas is owed, "prevent me from having to reimburse someone for
 * them to just pay it back"):
 *
 *   owes   → MARK PAID     {paid: true}     cash, Venmo, Zelle
 *   owed   → MARK SETTLED  {settled: true}  the owner has paid them out
 *   paid   → UNMARK        {paid: false}    clears either mark
 *   square → nothing to mark
 */
export function PaidButton({ memberId, status, name, amount }: { memberId: string; status: MemberStatus; name: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "square") return null;

  const body = status === "paid" ? { memberId, paid: false } : status === "owed" ? { memberId, settled: true } : { memberId, paid: true };
  const label = status === "paid" ? "Unmark" : status === "owed" ? "Mark settled" : "Mark paid";
  const confirmText =
    status === "paid" ? `Unmark ${name}? The row goes back to owing / owed.` : status === "owed" ? `Mark ${name} settled — you have sent them ${amount}?` : `Mark ${name} paid ${amount}?`;

  async function toggle() {
    if (busy) return;
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lasd26/pay/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        {busy ? "…" : label}
      </button>
      {error && <span className="tm-err">{error}</span>}
    </>
  );
}
