"use client";

import { useState } from "react";
import { Headline } from "./Headline";

/**
 * Password gate for a "password" access-mode event. Shown by /e/[slug] when the
 * viewer hasn't unlocked yet. On a correct password the API sets an httpOnly
 * unlock cookie; we refresh so the server re-resolves access and renders the
 * gallery. Mirrors the secure-link flow, but the secret is typed, not in the URL.
 */
export function GalleryPasswordGate({ slug, eventName }: { slug: string; eventName?: string }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/gallery-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: slug, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Incorrect password.");
      }
      // Cookie is set. Do a FULL reload (not router.refresh) — the catalog +
      // capabilities are fetched by RunnerProvider in the root layout, which
      // doesn't remount on a soft refresh, so its pre-unlock 401 would stick and
      // leave the search screen on "Loading…". A reload remounts the provider so
      // /api/photos re-runs with the unlock cookie.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="screen" style={{ padding: "64px 24px 96px" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 14,
          }}
        >
          Password protected
        </div>
        <Headline
          as="h1"
          text={eventName ? `${eventName}` : "Enter the gallery password."}
          accent={eventName ? eventName.split(" ")[0] : "password."}
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "clamp(30px, 4vw, 44px)",
            lineHeight: 1.05,
            letterSpacing: "-.015em",
            color: "var(--ink)",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 16, lineHeight: 1.55 }}>
          This gallery is password-protected. Enter the password you were given to find your photos.
        </p>
        <form
          onSubmit={submit}
          style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Gallery password"
            autoFocus
            autoComplete="off"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 16,
              background: "var(--paper, #fff)",
              color: "var(--ink)",
              textAlign: "center",
            }}
          />
          {error && (
            <div role="alert" style={{ fontSize: 13, color: "var(--accent)" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn btn--primary btn--lg"
            disabled={busy || !password.trim()}
            style={{ justifyContent: "center" }}
          >
            {busy ? "Checking…" : "Enter gallery"}
          </button>
        </form>
      </div>
    </main>
  );
}
