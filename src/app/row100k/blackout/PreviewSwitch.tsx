"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlackoutPreview } from "@/lib/row100kViewer";

/* THE TEST BLACKOUT (owner, 2026-09-06): "I need an admin test blackout
 * where only I am seeing it as if it's blackout, and I'm in the Elite
 * fifteen — and then a switch to be able to see it as if it's blackout and
 * I'm NOT in the elite fifteen."
 *
 * Two modes, one cookie, nobody else affected:
 *
 *   IN THE FIFTEEN  — the window is open, the admin exemption is off, and
 *                     the viewer is still themself, so their own numbers
 *                     show and everybody else's are blocks. This is the
 *                     page one of the fifteen gets.
 *   OUTSIDE IT      — the same, minus being themself: every one of the
 *                     fifteen is hidden, the admin's own row included.
 *                     This is the page the rest of the challenge gets.
 *
 * The cookie only ever makes a page STRICTER, and row100kViewer refuses to
 * read it for anyone who is not a challenge admin — but it is still a
 * debugging lever, so it is set from here and nowhere else. It is a session
 * cookie: closing the browser ends the test. */
const MODES: { key: BlackoutPreview; label: string; note: string }[] = [
  { key: "elite", label: "In the fifteen", note: "Your numbers show, everyone else's are blocks." },
  { key: "public", label: "Outside it", note: "Every one of the fifteen is hidden, yours too." },
];

export function PreviewSwitch({ active }: { active: BlackoutPreview | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const set = async (mode: BlackoutPreview | null) => {
    setBusy(true);
    try {
      await fetch("/api/row100k/blackout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      // Every /row100k page reads the cookie on the server, so the whole
      // site has to re-render, not just this one.
      startTransition(() => router.refresh());
    } catch {
      /* the switch is a debugging lever; a failed toggle just does nothing */
    }
    setBusy(false);
  };

  const working = busy || pending;

  return (
    <div className="panel bo-prev">
      <div className="p-head">
        <h3>Test blackout</h3>
        <span className="mono">{active ? "ON — ONLY YOU" : "OFF"}</span>
      </div>
      <p className="bo-prev-note mono">
        SEE THE SITE AS IF A WINDOW WERE OPEN. NOBODY ELSE IS AFFECTED.
      </p>
      <div className="tabs" role="group" aria-label="Test blackout">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            disabled={working}
            aria-pressed={active === m.key}
            className={active === m.key ? "on" : undefined}
            onClick={() => void set(active === m.key ? null : m.key)}
          >
            {m.label}
          </button>
        ))}
        <button type="button" disabled={working || !active} onClick={() => void set(null)}>
          Off
        </button>
      </div>
      <p className="bo-prev-note mono">
        {active ? MODES.find((m) => m.key === active)?.note.toUpperCase() : "PICK ONE TO TURN IT ON."}
      </p>
    </div>
  );
}
