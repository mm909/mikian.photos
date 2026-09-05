"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* The bests grid on a rower's profile. Each card is a link to that record's
 * full leaderboard (filtered to the rower's division, so the board matches
 * the rank chip). Rank chips wear medal colors on the podium, and — for the
 * rower themself or an admin — every filled best is individually shareable:
 * SHARE opens the dialog landed on the "This best" card for that stat. */

export type Best = {
  key: string;
  label: string;
  value: string;
  sub: string;
  place: number | null;
  /* Leaderboard for this stat, e.g. "/row100k/records/5000?d=m". */
  href: string;
  /* Blackout (blackoutRules.ts): the page blanked `value` and this is its
   * silhouette — "##:##.#" for a pace best — for the blocks the profile
   * renders in its place, and for the best card should one ever be made. */
  shape?: string;
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
          /* Stretched-link card: the anchor covers the whole box (a button
             can't legally nest inside an <a>), and SHARE floats above it. */
          <div className="rec linked" key={r.key} style={{ position: "relative" }}>
            <a
              href={r.href}
              aria-label={`${r.label} — the leaderboard`}
              style={{ position: "absolute", inset: 0 }}
            />
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
                style={{ marginTop: 8, position: "relative" }}
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
            ? {
                label: shareBest.label,
                value: shareBest.value,
                place: shareBest.place,
                shape: shareBest.shape,
              }
            : undefined,
        }}
        open={shareBest !== null}
        onClose={() => setShareBest(null)}
        preferredCardId="rowtember-best"
      />
    </>
  );
}
