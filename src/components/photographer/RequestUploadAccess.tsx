"use client";

import { useState } from "react";
import { Headline } from "@/components/runner/Headline";

/**
 * Shown on /e/[slug]/upload to a signed-in user who isn't an approved uploader.
 * They request access; the event owner approves them (in settings / the upload
 * page) before they can upload. Keeps random visitors from uploading.
 */
export function RequestUploadAccess({
  slug,
  eventName,
  pending: initialPending,
}: {
  slug: string;
  eventName: string;
  pending: boolean;
}) {
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/request-access`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || "Could not send your request");
      }
      setPending(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen" style={{ padding: "64px 24px 96px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
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
          {eventName}
        </div>
        <Headline
          as="h1"
          text={pending ? "Request sent." : "Request upload access."}
          accent={pending ? "sent." : "access."}
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
        {pending ? (
          <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 18, lineHeight: 1.55 }}>
            Your request is waiting for the event owner to approve it. You&rsquo;ll be able to
            upload as soon as they do — check back shortly.
          </p>
        ) : (
          <>
            <p style={{ color: "var(--muted)", fontSize: 16, marginTop: 18, lineHeight: 1.55 }}>
              You&rsquo;re signed in, but you don&rsquo;t have upload access to this event yet.
              Request access and the owner will approve you.
            </p>
            {error && (
              <div role="alert" style={{ fontSize: 13, color: "var(--accent)", marginTop: 14 }}>
                {error}
              </div>
            )}
            <button
              className="btn btn--primary btn--lg"
              onClick={() => void request()}
              disabled={busy}
              style={{ marginTop: 24 }}
            >
              {busy ? "Sending…" : "Request access"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
