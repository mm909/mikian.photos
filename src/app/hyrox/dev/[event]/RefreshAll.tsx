"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* UPDATE FROM HYRESULT, over the owner's list: reads every entry's name
 * on hyresult again (the record, the published wave, the finish —
 * record.ts) in batches, the least recently read first, until none is
 * left, then reloads the list. The board does this on its own a few rows
 * at a time as it is viewed (row.ts refreshStale); this is the whole
 * list at once, for the owner, in one tap. */
export function RefreshAll({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    if (busy) return;
    setBusy(true);
    let looked = 0;
    let failed = 0;
    try {
      for (let i = 0; i < 40; i++) {
        const res = await fetch(`/api/hyrox/${slug}/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; looked?: number; failed?: number; remaining?: number };
        if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't update — try again.");
        looked += data.looked ?? 0;
        failed += data.failed ?? 0;
        const left = data.remaining ?? 0;
        setMsg(`${looked} updated${failed ? `, ${failed} not reached` : ""}${left ? `, ${left} to go…` : ""}`);
        if (!left) break;
      }
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Couldn't update — try again.");
    }
    setBusy(false);
  };

  return (
    <div className="hx-list-tools">
      <button type="button" className="hx-chip" disabled={busy} onClick={() => void run()}>
        {busy ? "Updating…" : "Update from hyresult"}
      </button>
      <em>{msg || "Debuts, PRs, waves and finishes — read again for every name"}</em>
    </div>
  );
}
