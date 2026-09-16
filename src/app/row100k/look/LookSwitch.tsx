"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Look } from "@/lib/rowSettings";

/* THE LOOK SWITCHES (owner, 2026-09-16): two panels, one route.
 *
 *   PREVIEW ON THIS BROWSER — PAPER / INK / OFF set or clear the admin's
 *       own LOOK_COOKIE (POST { previewLook }). Nobody else is affected;
 *       the pattern is blackout/PreviewSwitch.tsx, cookie included.
 *   THE SITE FOR EVERYONE  — PAPER / INK write the `look` setting (POST
 *       { key, value }). INK takes two taps: the first arms it (SURE? /
 *       KEEP, the shirt page idiom), the second sends. Going back to paper
 *       is one tap, because paper is the default and undoing is cheap.
 *
 * Both re-render the whole site through router.refresh(): every /row100k
 * page and the root landing read the switch on the server. A write that
 * did not land says so in a .form-err — the route answers 503 with the
 * reason when the RowSetting table is not pushed yet. */

const LOOKS: { key: Look; label: string }[] = [
  { key: "paper", label: "Paper" },
  { key: "ink", label: "Ink" },
];

async function post(body: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/row100k/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !data?.ok) return data?.error ?? `That did not save (${res.status}).`;
    return null;
  } catch {
    return "That did not reach the server — try again.";
  }
}

export function LookSwitch({ preview, site }: { preview: Look | null; site: Look }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [siteErr, setSiteErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Look | null>(null);

  const working = busy || pending;

  const setPreview = async (look: Look | null) => {
    setBusy(true);
    setPreviewErr(null);
    const err = await post({ previewLook: look });
    if (err) setPreviewErr(err);
    else startTransition(() => router.refresh());
    setBusy(false);
  };

  const setSite = async (look: Look) => {
    setBusy(true);
    setSiteErr(null);
    setSaved(null);
    const err = await post({ key: "look", value: look });
    if (err) setSiteErr(err);
    else {
      setSaved(look);
      startTransition(() => router.refresh());
    }
    setArmed(false);
    setBusy(false);
  };

  const pickSite = (look: Look) => {
    if (look === site) {
      setArmed(false);
      return;
    }
    if (look === "ink" && !armed) {
      setArmed(true);
      return;
    }
    void setSite(look);
  };

  return (
    <>
      <div className="panel lk-panel">
        <div className="p-head">
          <h3>Preview on this browser</h3>
          <span className="mono">{preview ? `${preview.toUpperCase()} — ONLY YOU` : "OFF"}</span>
        </div>
        <p className="lk-note mono">SEE THE SITE IN A LOOK ON THIS BROWSER ALONE. NOBODY ELSE IS AFFECTED.</p>
        <div className="tabs" role="group" aria-label="Preview look">
          {LOOKS.map((l) => (
            <button
              key={l.key}
              type="button"
              disabled={working}
              aria-pressed={preview === l.key}
              className={preview === l.key ? "on" : undefined}
              onClick={() => void setPreview(preview === l.key ? null : l.key)}
            >
              {l.label}
            </button>
          ))}
          <button type="button" disabled={working || !preview} onClick={() => void setPreview(null)}>
            Off
          </button>
        </div>
        <p className="lk-note mono">
          {preview
            ? "A SESSION COOKIE — CLOSING THE BROWSER ENDS IT. OFF GOES BACK TO WHAT EVERYONE SEES."
            : "PICK ONE TO TURN IT ON."}
        </p>
        {previewErr && <p className="form-err">{previewErr.toUpperCase()}</p>}
      </div>

      <div className="panel lk-panel">
        <div className="p-head">
          <h3>The site for everyone</h3>
          <span className="mono">NOW: {site.toUpperCase()}</span>
        </div>
        <p className="lk-note mono">THE LOOK EVERY VISITOR GETS, ON THE NEXT PAGE LOAD. NO DEPLOY.</p>
        <div className="tabs" role="group" aria-label="Site look">
          {LOOKS.map((l) => {
            const isInkArmed = l.key === "ink" && armed;
            return (
              <button
                key={l.key}
                type="button"
                disabled={working}
                aria-pressed={site === l.key}
                className={site === l.key ? "on" : undefined}
                onClick={() => pickSite(l.key)}
              >
                {isInkArmed ? "Sure?" : l.label}
              </button>
            );
          })}
          {armed && (
            <button type="button" disabled={working} onClick={() => setArmed(false)}>
              Keep
            </button>
          )}
        </div>
        <p className="lk-note mono">
          {armed
            ? "TAP SURE? AGAIN AND THE WHOLE SITE GOES INK FOR EVERYONE. KEEP LEAVES IT."
            : "INK ASKS TWICE. PAPER IS ONE TAP."}
        </p>
        {siteErr && <p className="form-err">{siteErr.toUpperCase()}</p>}
        {saved && !siteErr && <p className="form-ok">SAVED — THE SITE IS {saved.toUpperCase()} FROM THE NEXT LOAD.</p>}
      </div>
    </>
  );
}
