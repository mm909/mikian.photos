"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * THE INVITE LINK block on /lasd26/team: the current link in a read-only
 * field, COPY, and NEW LINK (which retires the old one — the only
 * revocation there is, so the button says so before it does it).
 */
export function InviteLink({ url, uses, madeOn }: { url: string | null; uses: number; madeOn: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    if (!url) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard API (older WebView, http on a LAN): select the text so
      // a long-press / ctrl+C does the job.
      input.current?.focus();
      input.current?.select();
      setError("Copy did not work here — the link is selected, copy it by hand.");
    }
  }

  async function rotate() {
    if (busy) return;
    if (url && !window.confirm("Make a new link? The old one stops working the moment you do.")) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch("/api/lasd26/team/invite", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setError(data.error || "Could not make a link — try again.");
      }
    } catch {
      setError("Could not make a link — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="tm-card">
      {url ? (
        <>
          <input ref={input} className="tm-link" type="text" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <p className="tm-note">
            Used <strong>{uses}</strong> time{uses === 1 ? "" : "s"}
            {madeOn ? ` · made ${madeOn}` : ""} · anyone with it can join once they sign in with Google.
          </p>
        </>
      ) : (
        <p className="tm-note">No link yet. Make one and drop it in the group chat.</p>
      )}
      <div className="tm-actions">
        {url && (
          <button type="button" className="tm-btn fill" onClick={() => void copy()}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        )}
        <button type="button" className={url ? "tm-btn quiet" : "tm-btn fill"} onClick={() => void rotate()} disabled={busy}>
          {busy ? "Making…" : url ? "New link" : "Make a link"}
        </button>
      </div>
      {url && <p className="tm-note">New link = the old one stops working. Everyone already on the team stays on it.</p>}
      {error && <p className="tm-err">{error}</p>}
    </div>
  );
}
