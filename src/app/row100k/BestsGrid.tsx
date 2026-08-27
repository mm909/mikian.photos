"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* The bests grid on a rower's profile. Rank chips wear medal colors on the
 * podium, and — for the rower themself or an admin — every filled best is
 * individually shareable: SHARE opens the dialog landed on the "This best"
 * card for that stat. */

export type Best = {
  key: string;
  label: string;
  value: string;
  sub: string;
  place: number | null;
};

export function BestsGrid({
  bests,
  data,
  canShare,
}: {
  bests: Best[];
  data: ShareData;
  canShare: boolean;
}) {
  const [shareBest, setShareBest] = useState<Best | null>(null);

  return (
    <>
      <div className="records vol" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {bests.map((r) => (
          <div className="rec" key={r.key}>
            <div className="t">
              {r.label}
              {r.place ? (
                <span className={`dtag${r.place <= 3 ? ` m${r.place}` : ""}`}>#{r.place}</span>
              ) : null}
            </div>
            <div className="v">{r.value}</div>
            <div className="meta">{r.sub}</div>
            {canShare && r.value !== "—" ? (
              <button
                type="button"
                className="quiet-btn"
                style={{ marginTop: 8 }}
                onClick={() => setShareBest(r)}
              >
                SHARE
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <ShareDialog
        data={{
          ...data,
          best: shareBest
            ? { label: shareBest.label, value: shareBest.value, place: shareBest.place }
            : undefined,
        }}
        open={shareBest !== null}
        onClose={() => setShareBest(null)}
        preferredCardId="rowtember-best"
      />
    </>
  );
}
