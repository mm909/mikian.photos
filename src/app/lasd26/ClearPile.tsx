"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClearPile({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function clear() {
    if (busy) return;
    if (
      !window.confirm(
        `Delete all ${count} application${count === 1 ? "" : "s"}? This can't be undone.`
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/lasd26/apply", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setError((data.error || "Clear failed — try again.").toUpperCase());
      }
    } catch {
      setError("CLEAR FAILED — CHECK YOUR CONNECTION AND TRY AGAIN.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="clear-btn mono" onClick={clear} disabled={busy}>
        {busy ? "CLEARING…" : "CLEAR THE LIST"}
      </button>
      {error && <p className="mono clear-err">{error}</p>}
    </>
  );
}
