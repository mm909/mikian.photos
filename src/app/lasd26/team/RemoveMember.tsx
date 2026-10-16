"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * REMOVE on a member row (owner, 2026-10-16: "let me remove users" — he was
 * on the roster twice). A confirm, then DELETE /api/lasd26/team/members/<id>.
 * The person's costs stay on the sheet; they just lose their name as PAID BY
 * and added-by, which the confirm says. Only the owner sees the button; the
 * route checks again.
 */
export function RemoveMember({ memberId, name, self }: { memberId: string; name: string; self: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    const warn = self
      ? `Remove yourself (${name}) from the team? Your costs stay but lose your name; you can join again with the link.`
      : `Remove ${name} from the team? Their costs stay on the sheet but lose their name as paid-by. They can join again with the link.`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/lasd26/team/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) router.refresh();
      else setError(data.error || "Did not remove");
    } catch {
      setError("Did not remove");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="tm-btn row quiet tm-remove" onClick={() => void remove()} disabled={busy}>
        {busy ? "…" : "Remove"}
      </button>
      {error && <span className="tm-err">{error}</span>}
    </>
  );
}
