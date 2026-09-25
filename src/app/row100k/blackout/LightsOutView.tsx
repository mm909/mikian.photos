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
 * exemption back until the browser closes. The test previews above it
 * (IN LIGHTS OUT / OUTSIDE IT) override both while they are on, and the
 * status line says so.
 *
 * ON THE LIGHTS OUT PAGE since 2026-09-25 (owner: "move the lights-out
 * setting to the lights-out page"): it sat on /row100k/settings under the
 * rower's own fields, which are nobody else's business, while the switch
 * is the admin's — so it lives with the other admin switch now. The
 * paragraph that explained it went the same day (owner: no explanatory
 * copy); the status line says what state it is in. */
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
    <div className="panel bo-view">
      <div className="p-head">
        <h3>Lights out</h3>
        <span className="mono">{status}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
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
