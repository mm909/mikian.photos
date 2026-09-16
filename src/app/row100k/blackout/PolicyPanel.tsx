"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { policyLabel, type BlackoutPolicy } from "@/lib/blackoutRules";

/* WHO GETS HIDDEN (owner, 2026-09-16: "give me settings for if it should
 * be top m/f or just overall and how many rowers get blacked out"). The
 * policy is one RowSetting row, read by boardData/boardView on every
 * request through siteSettings() and written here through
 * /api/row100k/settings. It is not tied to a window: whatever window is
 * open, or opens next, hides the rowers this says. */

type Scope = BlackoutPolicy["scope"];

const SCOPES: { key: Scope; label: string; note: string }[] = [
  { key: "division", label: "Top of each board", note: "THE FIRST N MEN AND THE FIRST N WOMEN, BY METERS." },
  { key: "overall", label: "Top overall", note: "THE FIRST N ROWERS ON THE BOARD, EITHER DIVISION." },
];

/* The same cap as rowSettings.BLACKOUT_COUNT_MAX. Not imported: that
 * module carries the db and this one runs in the browser. */
const COUNT_MAX = 100;

export function PolicyPanel({ policy }: { policy: BlackoutPolicy }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(policy.scope);
  const [count, setCount] = useState(String(policy.count));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= COUNT_MAX;
  const dirty = scope !== policy.scope || n !== policy.count;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError(`How many is a whole number from 1 to ${COUNT_MAX}.`);
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/row100k/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "blackout.policy", value: { scope, count: n } }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setOk(`SAVED — ${policyLabel({ scope, count: n })}`);
        // The saved policy is read on the server: re-render the page.
        router.refresh();
      } else {
        // A 503 is the settings route saying the RowSetting table is not
        // in the database yet; its message says so and is printed as is.
        setError(
          data.error ??
            (res.status === 503
              ? "Couldn't save that — has the RowSetting table been pushed?"
              : "Couldn't save that — try again."),
        );
      }
    } catch {
      setError("Couldn't save that — try again.");
    }
    setBusy(false);
  };

  return (
    <form className="panel bo-policy" onSubmit={(e) => void save(e)}>
      <div className="p-head">
        <h3>Who gets hidden</h3>
        <span className="mono">{policyLabel(policy)}</span>
      </div>
      <p className="bo-prev-note mono">
        APPLIES TO WHATEVER WINDOW IS OPEN, ON THE NEXT PAGE LOAD.
      </p>

      <div className="tabs" role="group" aria-label="Who gets hidden">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={busy}
            aria-pressed={scope === s.key}
            className={scope === s.key ? "on" : undefined}
            onClick={() => {
              setScope(s.key);
              setError(null);
              setOk(null);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="bo-prev-note mono">{SCOPES.find((s) => s.key === scope)?.note}</p>

      <label className="fl" htmlFor="bo-count">
        How many — {scope === "overall" ? "rowers in all" : "of each board"}, 1 to {COUNT_MAX}
      </label>
      <input
        id="bo-count"
        type="number"
        min={1}
        max={COUNT_MAX}
        step={1}
        value={count}
        onChange={(e) => {
          setCount(e.target.value);
          setError(null);
          setOk(null);
        }}
        required
      />

      <button type="submit" className="send" disabled={busy || !dirty || !valid}>
        {busy ? "Saving…" : dirty ? `Save — ${policyLabel({ scope, count: valid ? n : policy.count })}` : "Saved"}
      </button>
      {error && <p className="form-err">{error}</p>}
      {ok && <p className="form-ok">{ok}</p>}
    </form>
  );
}
