"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/* The Send buttons on the testers list (api/row100k/android/invite). One
 * tester (`email`) or everyone not yet sent (`unsent`). Asks first: the
 * email goes out at once. */
export function SendLink({ email, unsent, label }: { email?: string; unsent?: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function send() {
    const who = email ? email : `${unsent} tester${unsent === 1 ? "" : "s"}`;
    if (!window.confirm(`Send the Play link to ${who}? Only once they are in the Play Console's ROW testers list.`)) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/row100k/android/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(email ? { email } : { unsent: true }),
      });
      const j = (await res.json().catch(() => null)) as { sent?: string[]; failed?: string[] } | null;
      setNote(j?.failed?.length ? `Not sent: ${j.failed.join(", ")}` : `Sent ${j?.sent?.length ?? 0}`);
      router.refresh();
    } catch {
      setNote("That did not go. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        style={{
          font: "700 12px var(--mono, monospace)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          padding: "6px 10px",
          border: "1.5px solid var(--ink)",
          background: busy ? "var(--paper)" : "var(--ink)",
          color: busy ? "var(--ink)" : "var(--paper)",
          borderRadius: 6,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Sending…" : label}
      </button>
      {note ? <small style={{ color: "var(--gray)" }}>{note}</small> : null}
    </span>
  );
}
