"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SHIRT_FREE_AT, SHIRT_PRICE_USD } from "../shirt";

/* SETTLE THE MONTH — the owner's button (owner, 2026-09-08: "build what I
 * need to bill at the end of the month if it applies"). DRY RUN shows who
 * would be free and who would owe, without touching a row or sending a
 * word. SETTLE does it: marks each shirt free or owed and emails everyone.
 * The route refuses before Sep 30 in production; here in dev, FORCE lets
 * the owner see the whole thing run. Lives on /row100k/shop-admin. */
type Row = { rowerNumber: number; size: string; meters: number; outcome: "free" | "owed"; emailed: boolean };

export function SettlePanel({ inProduction }: { inProduction: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ dryRun: boolean; free: number; owed: number; results: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/row100k/shirt/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, force: !inProduction }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & Partial<NonNullable<typeof out>>;
      if (res.ok && data.ok) {
        setOut({ dryRun: !!data.dryRun, free: data.free ?? 0, owed: data.owed ?? 0, results: data.results ?? [] });
        if (!dryRun) router.refresh();
      } else setError(data.error ?? "Couldn't settle.");
    } catch {
      setError("Couldn't settle.");
    }
    setBusy(false);
  };

  return (
    <div className="sh-settle">
      <div className="sec-head">
        <h2>Settle the month</h2>
        <span className="mono">
          FREE AT {SHIRT_FREE_AT / 1000}K, ${SHIRT_PRICE_USD} OTHERWISE
        </span>
      </div>
      <p className="sh-buy-note">
        DRY RUN LISTS WHO IS FREE AND WHO OWES. SETTLE MARKS THE SHIRTS AND EMAILS EVERYONE, WITH A PAY LINK FOR THOSE WHO OWE.
        {inProduction ? " REFUSES UNTIL THE MONTH HAS ENDED." : " DEV: RUNS NOW."}
      </p>
      <div className="act-row">
        <button type="button" className="outline-btn" disabled={busy} onClick={() => void run(true)}>
          Dry run
        </button>
        <button type="button" className="send" style={{ marginTop: 0, width: "auto", padding: "10px 18px", fontSize: 14 }} disabled={busy} onClick={() => void run(false)}>
          {busy ? "…" : "Settle and email"}
        </button>
      </div>
      {error && <p className="form-err">{error}</p>}
      {out && (
        <>
          <p className="sh-buy-note" style={{ marginTop: 16 }}>
            {out.dryRun ? "DRY RUN — " : "SETTLED — "}
            {out.free} FREE · {out.owed} OWE ${SHIRT_PRICE_USD}
          </p>
          {out.results.length > 0 && (
            <table className="board">
              <thead>
                <tr>
                  <th>Rower</th>
                  <th>Size</th>
                  <th style={{ textAlign: "right" }}>Meters</th>
                  <th>Outcome</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {out.results.map((r) => (
                  <tr key={r.rowerNumber}>
                    <td className="mono">{String(r.rowerNumber).padStart(3, "0")}</td>
                    <td>{r.size}</td>
                    <td className="num">{r.meters.toLocaleString("en-US")} m</td>
                    <td className="mono">{r.outcome.toUpperCase()}</td>
                    <td className="mono">{out.dryRun ? "—" : r.emailed ? "SENT" : "FAILED"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
