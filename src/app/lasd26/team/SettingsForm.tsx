"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SETTINGS on /lasd26/team: how many ways the total splits (the cost
 * sheet's "Team size 18" — a setting, not the member count, so the share
 * does not wobble while people join) and whether settle up is open to
 * everyone (until then only the owner sees the pay button). One SAVE.
 */
export function SettingsForm({ splitCount, settleOpen, memberCount }: { splitCount: number; settleOpen: boolean; memberCount: number }) {
  const router = useRouter();
  const [split, setSplit] = useState(String(splitCount));
  const [open, setOpen] = useState(settleOpen);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const n = Number.parseInt(split, 10);
  const splitOk = Number.isInteger(n) && n >= 1 && n <= 200;
  const dirty = (splitOk && n !== splitCount) || open !== settleOpen;

  async function save() {
    if (busy || !splitOk) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/lasd26/team/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splitCount: n, settleOpen: open }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(data.error || "Did not save — try again.");
      }
    } catch {
      setError("Did not save — check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="tm-card">
      <div className="tm-set">
        <div>
          <label className="k" htmlFor="s-split">
            Split the total
          </label>
          <div className="tm-inline">
            <input
              id="s-split"
              className="tm-num"
              type="number"
              inputMode="numeric"
              min={1}
              max={200}
              step={1}
              value={split}
              disabled={busy}
              onChange={(e) => {
                setSplit(e.target.value);
                setSaved(false);
              }}
            />
            <span className="mono">
              {memberCount} joined · splitting {splitOk ? n : "?"} way{splitOk && n === 1 ? "" : "s"}
            </span>
          </div>
          {!splitOk && <p className="tm-err">A whole number from 1 to 200.</p>}
        </div>
        <div>
          <label className="tm-toggle">
            <input
              type="checkbox"
              checked={open}
              disabled={busy}
              onChange={(e) => {
                setOpen(e.target.checked);
                setSaved(false);
              }}
            />
            <span className="sw" aria-hidden />
            <span className="t">
              Settle up open to everyone
              <small>{open ? "Everyone sees the pay button." : "Off: only you see the pay button."}</small>
            </span>
          </label>
        </div>
      </div>
      <div className="tm-actions">
        <button type="button" className="tm-btn fill" onClick={() => void save()} disabled={busy || !dirty || !splitOk}>
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && <span className="tm-note tm-ok">SAVED</span>}
      </div>
      {error && <p className="tm-err">{error}</p>}
    </div>
  );
}
