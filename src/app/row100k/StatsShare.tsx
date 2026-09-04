"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* One SHARE A CARD button + its dialog, restricted to the community cards —
 * the stats page drops one of these under each shareable chart. The personal
 * fields are stand-ins: every card the `only` list allows draws from
 * `community` alone. */

export const COMMUNITY_CARD_IDS = [
  "rowtember-community-month",
  "rowtember-community-total",
  "rowtember-community-curve",
  "rowtember-community-daily",
  "rowtember-community-hours",
];

export type CommunityShare = NonNullable<ShareData["community"]>;

export function StatsShare({ community, prefer }: { community: CommunityShare; prefer: string }) {
  const [open, setOpen] = useState(false);

  const data: ShareData = {
    displayName: "EVERYONE",
    rowerNumber: 0,
    instagram: "",
    meters: community.meters,
    sessions: community.sessions,
    byDay: community.byDay,
    community,
  };

  return (
    <div className="ms-actions">
      <button type="button" className="quiet-btn" onClick={() => setOpen(true)}>
        SHARE A CARD
      </button>
      <ShareDialog
        data={data}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId={prefer}
        only={COMMUNITY_CARD_IDS}
      />
    </div>
  );
}
