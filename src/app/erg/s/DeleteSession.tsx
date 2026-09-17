"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* DELETE A SAVED SESSION, TWICE (owner, 2026-09-17: the analysis screen
 * wants a delete, and a saved row is the only copy there is — the
 * recording in the tab went when the tab did).
 *
 * So it asks twice: the first tap turns the button into the question and
 * arms it for six seconds, the second tap sends the DELETE. Walking away
 * disarms it. The route answers 404 for a row outside the account, which
 * reads here as gone either way.
 *
 * The only client component on the review surfaces. Everything else on
 * them is server rendered, because a finished piece does not change. */
export function DeleteSession({ id, redirectTo, label = "Delete" }: { id: string; redirectTo?: string; label?: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const arm = () => {
    setErr(null);
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 6000);
  };

  const go = async () => {
    if (timer.current) clearTimeout(timer.current);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erg/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setErr(body?.error ?? `The delete failed (${res.status}).`);
        setBusy(false);
        setArmed(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setErr("Could not reach the server.");
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <span className="eg-link-state" style={{ gap: 8 }}>
      <button type="button" className={armed ? "eg-btn rv-danger" : "eg-btn eg-btn-quiet"} onClick={armed ? go : arm} disabled={busy}>
        {busy ? "Deleting…" : armed ? "Tap again to delete" : label}
      </button>
      {err ? <span className="eg-note eg-bad">{err}</span> : null}
    </span>
  );
}
