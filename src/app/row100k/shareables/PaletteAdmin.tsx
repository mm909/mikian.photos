"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PALETTES, type PaletteId } from "@/lib/rowPalette";
import type { Look } from "@/lib/rowSettings";

/* THE LOOK (owner, 2026-10-01: "now that the page is white on black we
 * need the other pages to follow"). Ink is the site now; paper — the cream
 * of September — is one word away, here, written through the same route
 * and the same "look" switch the retired Look page wrote. Two words in the
 * palette row idiom, the one the site wears marked. */
const LOOKS: { id: Look; name: string }[] = [
  { id: "ink", name: "Ink" },
  { id: "paper", name: "Paper" },
];

export function LookAdmin({ look }: { look: Look }) {
  const router = useRouter();
  const [cur, setCur] = useState<Look>(look);
  const [busy, setBusy] = useState<Look | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setCur(look);
  }, [look]);

  const pick = async (id: Look) => {
    const prev = cur;
    setBusy(id);
    setErr(null);
    setCur(id);
    try {
      const res = await fetch("/api/row100k/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "look", value: id }),
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
      <div className="sh-pal mono" role="group" aria-label="Look">
        <span className="sh-pal-k">Look</span>
        {LOOKS.map((l) => {
          const on = l.id === cur;
          return (
            <button
              key={l.id}
              type="button"
              className={on ? "sh-pal-w on" : "sh-pal-w"}
              aria-pressed={on}
              disabled={busy !== null}
              onClick={() => {
                if (!on) void pick(l.id);
              }}
            >
              {busy === l.id ? "…" : l.name}
            </button>
          );
        })}
      </div>
      {err && <p className="form-err">{err}</p>}
    </>
  );
}

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
