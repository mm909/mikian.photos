"use client";

import { useState } from "react";
import { teamPath } from "@/lib/tsp/paths";

/**
 * MAKE A TEST TEAM (owner, 2026-11-16: "make a test team w/ 8 runners and
 * target paces"; lib/tsp/demo.ts says what is in it). One tap, then the map
 * of the new team.
 */
export function DemoButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function make() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/tsp/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ demo: true }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; slug?: string; error?: string };
      if (!res.ok || !j.ok || !j.slug) throw new Error(j.error || "Could not make it — try again.");
      window.location.href = teamPath(j.slug, "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not make it — try again.");
      setBusy(false);
    }
  }
  return (
    <div style={{ marginTop: 18 }}>
      <button type="button" className="tm-btn quiet" disabled={busy} onClick={() => void make()}>
        {busy ? "Making it…" : "Make a test team (8 runners, 2 shifts)"}
      </button>
      <p className="tm-note">Eight named runners with target paces, a start time and a full plan, to look around with. Delete nothing real by playing in it.</p>
      {err && (
        <p className="tm-note" role="alert">
          <strong>{err}</strong>
        </p>
      )}
    </div>
  );
}
