"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";

type Fixed = { rowerNumber: number; name: string; meters: number; from: string; to: string };

/* Admin one-shot on the signups page: moves rows filed on "tomorrow" by the
 * launch-night UTC-default bug back to the day they were really submitted,
 * then reports exactly what moved. Safe to press again — a clean pass just
 * says nothing needed fixing. */
export function FixDays() {
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [fixed, setFixed] = useState<Fixed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = async () => {
    setStatus("working");
    setError(null);
    try {
      const res = await fetch("/api/row100k/admin/fix-days", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fixed?: Fixed[] };
      if (res.ok && data.ok) {
        setFixed(data.fixed ?? []);
        setStatus("done");
        router.refresh();
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  return (
    <div style={{ marginTop: 18 }}>
      <button type="button" className="quiet-btn" disabled={status === "working"} onClick={() => void run()}>
        {status === "working" ? "FIXING…" : "FIX FUTURE-DATED ROWS (LAUNCH-NIGHT BUG)"}
      </button>
      {status === "done" && fixed && (
        <p className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--gray)", marginTop: 8, lineHeight: 1.8 }}>
          {fixed.length === 0
            ? "NOTHING TO FIX — EVERY ROW IS ON ITS REAL DAY."
            : fixed.map((f, i) => (
                <span key={i} style={{ display: "block" }}>
                  {fmtRowerNumber(f.rowerNumber)} {f.name.toUpperCase()} · {f.meters.toLocaleString("en-US")} M · {f.from} → {f.to}
                </span>
              ))}
        </p>
      )}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
