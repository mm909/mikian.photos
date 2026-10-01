"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PALETTES, type PaletteId } from "@/lib/rowPalette";

/* THE PALETTE (owner, 2026-09-30: try the colours live). One row of words,
 * one per preset in rowPalette.ts, the one the site wears marked; a press
 * writes the "palette" switch through the settings route, the same way the
 * card switches beside it are written, and router.refresh() brings the
 * truth back. A save that fails puts the mark back and says so. */
export function PaletteAdmin({ palette }: { palette: PaletteId }) {
  const router = useRouter();
  const [cur, setCur] = useState<PaletteId>(palette);
  const [busy, setBusy] = useState<PaletteId | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setCur(palette);
  }, [palette]);

  const pick = async (id: PaletteId) => {
    const prev = cur;
    setBusy(id);
    setErr(null);
    setCur(id);
    try {
      const res = await fetch("/api/row100k/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "palette", value: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setCur(prev);
        setErr(data.error ?? "Couldn't save that — try again.");
      }
    } catch {
      setCur(prev);
      setErr("Couldn't save that — try again.");
    }
    setBusy(null);
  };

  return (
    <>
      <div className="sh-pal mono" role="group" aria-label="Palette">
        <span className="sh-pal-k">Palette</span>
        {PALETTES.map((p) => {
          const on = p.id === cur;
          return (
            <button
              key={p.id}
              type="button"
              className={on ? "sh-pal-w on" : "sh-pal-w"}
              aria-pressed={on}
              disabled={busy !== null}
              onClick={() => {
                if (!on) void pick(p.id);
              }}
            >
              {busy === p.id ? "…" : p.name}
            </button>
          );
        })}
      </div>
      {err && <p className="form-err">{err}</p>}
    </>
  );
}
