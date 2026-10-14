"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* REMOVE, on the owner's list (owner, 2026-10-14: "allow me (only me) to
 * remove any entries"). One confirm, then DELETE; the route lets the
 * admin take any entry off the board. */
export function RemoveEntry({ slug, id, label }: { slug: string; id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remove = async () => {
    if (busy) return;
    if (!window.confirm(`Take ${label} off the board?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/hyrox/${slug}/entry`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setErr("Couldn't remove that — try again.");
      setBusy(false);
    }
  };

  return (
    <span className="hx-card-remove">
      <button type="button" onClick={() => void remove()} disabled={busy}>
        {busy ? "Removing…" : "Remove"}
      </button>
      {err ? <em>{err}</em> : null}
    </span>
  );
}
