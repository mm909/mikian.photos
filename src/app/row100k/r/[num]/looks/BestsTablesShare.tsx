"use client";

import { useState } from "react";
import { ShareDialog } from "../../../ShareMenu";
import type { ShareData } from "../../../share/cards";
import { BestsTables } from "./BestsTables";
import type { ProfileBest } from "./view";

/* The bests boards with a SHARE on every filled row — the rower's own page
 * and an admin's (the repost case). SHARE opens the dialog landed on the
 * best card for that stat, the same as BestsGrid did on the cards. Only
 * ever mounted when the bests carry real values: a masked profile renders
 * BestsTables on the server instead. */
export function BestsTablesShare({ bests, data }: { bests: ProfileBest[]; data: ShareData }) {
  const [shareBest, setShareBest] = useState<ProfileBest | null>(null);
  return (
    <>
      <BestsTables bests={bests} onShare={setShareBest} />
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
