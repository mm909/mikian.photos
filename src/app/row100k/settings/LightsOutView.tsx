"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/* SEE IT AS EVERYONE DOES / SHOW ME EVERYTHING (owner, 2026-09-21: "my view
 * does not show the lights out version. Let me turn on/off the lights out
 * version on my account. Default it to follow how it looks for everyone
 * else but let me flip it off temporarily in the settings, just for my
 * user").
 *
 * Admin only — the panel is not rendered for anyone else and the route
 * refuses anyone else. The default is the rower's view; SHOW ME EVERYTHING
 * sets a session cookie (row100kViewer BO_ADMIN_COOKIE) that puts the admin
 * exemption back until the browser closes. The test previews on the lights
 * out page (IN LIGHTS OUT / OUTSIDE IT) override both while they are on,
 * and the status line says so. */
export function LightsOutView({ all, testing }: { all: boolean; testing: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const set = async (next: boolean) => {
    setBusy(true);
    try {
      await fetch("/api/row100k/blackout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: next }),
      });
      // Every /row100k page reads the cookie on the server.
      startTransition(() => router.refresh());
    } catch {
      /* a failed flip just leaves things as they were */
    }
    setBusy(false);
  };

  const working = busy || pending;
  const status = testing ? "TEST PREVIEW ON — SET ON THE LIGHTS OUT PAGE" : all ? "SHOWING YOU EVERYTHING" : "AS EVERYONE SEES IT";

  return (
    <div className="panel" style={{ marginTop: 26 }}>
      <div className="p-head">
        <h3>Lights out</h3>
        <span className="mono">{status}</span>
      </div>
      <p className="mono" style={{ fontSize: 11, letterSpacing: ".1em", lineHeight: 1.8, color: "var(--ink-3, #666)", margin: "10px 0 16px" }}>
        YOUR ACCOUNT CAN SEE THROUGH LIGHTS OUT. BY DEFAULT IT DOES NOT — YOU GET THE SITE EVERY OTHER ROWER GETS. FLIP
        IT TO SEE EVERY NUMBER; IT LASTS UNTIL YOU CLOSE THE BROWSER. ONLY YOUR VIEW CHANGES.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className={all ? "quiet-btn" : "outline-btn"}
          aria-pressed={!all}
          disabled={working || !all}
          onClick={() => void set(false)}
        >
          As everyone sees it
        </button>
        <button
          type="button"
          className={all ? "outline-btn" : "quiet-btn"}
          aria-pressed={all}
          disabled={working || all}
          onClick={() => void set(true)}
        >
          Show me everything
        </button>
      </div>
    </div>
  );
}
