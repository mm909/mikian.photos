"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CARDS, type ShareCard } from "../share/cards";
import { CardPreview, sampleData, useShareFonts } from "./CardPreview";

/* THE CARDS, as a table (owner, 2026-09-16: "on the dev stats page I want
 * more of a table than a card view — maybe combine this page on the
 * shareables menu" / "a shareables page where these can be turned on/off").
 * One row per card in registry order, an eyebrow row where the family
 * changes, a small painted preview, the label and id, the all-time share
 * count, and the switch.
 *
 * THE SWITCH writes the whole cards.off list — the settings route takes the
 * list, not a delta — and the state comes from the server (siteSettings)
 * on every render; the local copy is only there so the press lands before
 * router.refresh() brings the truth back. A save that fails puts the row
 * back and says so under the table. */

type Group = "Personal" | "Race day" | "Community" | "Board pages";

function groupOf(id: string): Group {
  if (id.startsWith("rowtember-raceday-")) return "Race day";
  if (id.startsWith("rowtember-community-")) return "Community";
  if (id.startsWith("rowtember-board-")) return "Board pages";
  return "Personal";
}

/* The board stickers are named by their places alone ("1–10"), which reads
 * as nothing in a list of cards. */
function labelOf(card: ShareCard): string {
  return card.id.startsWith("rowtember-board-") ? `The board · ${card.label}` : card.label;
}

export function ShareablesAdmin({
  counts,
  cardsOff,
}: {
  counts: Record<string, number>;
  /* The ids switched off, as the server read them. */
  cardsOff: string[];
}) {
  const router = useRouter();
  const { fonts, probes } = useShareFonts();
  const [off, setOff] = useState<string[]>(cardsOff);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setOff(cardsOff);
  }, [cardsOff]);

  const plain = sampleData(false);
  const dark = sampleData(true);

  const toggle = async (id: string, on: boolean) => {
    const prev = off;
    const next = on ? prev.filter((x) => x !== id) : [...prev, id];
    setBusy(id);
    setErr(null);
    setOff(next);
    try {
      const res = await fetch("/api/row100k/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "cards.off", value: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        router.refresh();
      } else {
        setOff(prev);
        setErr(data.error ?? "Couldn't save that — try again.");
      }
    } catch {
      setOff(prev);
      setErr("Couldn't save that — try again.");
    }
    setBusy(null);
  };

  let lastGroup: Group | null = null;

  return (
    <>
      {probes}
      <div style={{ overflowX: "auto" }}>
        <table className="board sh-t">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Card</th>
              <th className="sh-r">Shares</th>
              <th className="sh-r">Switch</th>
            </tr>
          </thead>
          <tbody>
            {CARDS.map((card) => {
              const group = groupOf(card.id);
              const eyebrow = group !== lastGroup;
              lastGroup = group;
              // The elite card only exists under a blackout, so it paints
              // masked; everything else paints the plain sample.
              const masked = card.id === "rowtember-elite";
              const sample = masked ? dark : plain;
              const unlocked = !card.available || card.available(sample);
              const isOff = off.includes(card.id);
              const n = counts[card.id] ?? 0;
              return (
                <Fragment key={card.id}>
                  {eyebrow && (
                    <tr className="sh-grp">
                      <td colSpan={4}>{group}</td>
                    </tr>
                  )}
                  <tr className={isOff ? "sh-off" : undefined}>
                    <td className="sh-pv">
                      <div className="sh-stage">
                        {unlocked ? (
                          <CardPreview card={card} fonts={fonts} masked={masked} />
                        ) : (
                          /* The Today cards close their gate once September
                           * is over (cards.ts monthIsRunning) — nothing to
                           * paint, and the sample cannot reopen them. */
                          <span className="sh-none mono">NOT NOW</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="sh-name">{labelOf(card)}</div>
                      <div className="sh-id">{card.id}</div>
                    </td>
                    <td className={n > 0 ? "num sh-n on" : "num sh-n"}>{n}</td>
                    <td className="num sh-sw">
                      <div className="tabs" role="group" aria-label={`${labelOf(card)} on or off`}>
                        <button
                          type="button"
                          className={isOff ? undefined : "on"}
                          aria-pressed={!isOff}
                          disabled={busy !== null}
                          onClick={() => {
                            if (isOff) void toggle(card.id, true);
                          }}
                        >
                          {busy === card.id && isOff ? "…" : "On"}
                        </button>
                        <button
                          type="button"
                          className={isOff ? "on" : undefined}
                          aria-pressed={isOff}
                          disabled={busy !== null}
                          onClick={() => {
                            if (!isOff) void toggle(card.id, false);
                          }}
                        >
                          {busy === card.id && !isOff ? "…" : "Off"}
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {err && <p className="form-err">{err}</p>}
    </>
  );
}
