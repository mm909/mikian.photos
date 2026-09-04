"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* One share button + its dialog, restricted to a set of community cards —
 * the stats page drops one of these under each shareable chart, the main
 * page one under the board. The personal fields are stand-ins: every card
 * the `only` list allows draws from `community` alone. */

export const COMMUNITY_CARD_IDS = [
  "rowtember-community-month",
  "rowtember-community-total",
  "rowtember-community-curve",
  "rowtember-community-daily",
  "rowtember-community-hours",
];

export type CommunityShare = NonNullable<ShareData["community"]>;

export function StatsShare({
  community,
  prefer,
  only = COMMUNITY_CARD_IDS,
  label = "SHARE A CARD",
}: {
  community: CommunityShare;
  prefer: string;
  /* Card ids the picker may show; defaults to the chart cards. */
  only?: string[];
  label?: string;
}) {
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
        {label}
      </button>
      <ShareDialog
        data={data}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId={prefer}
        only={only}
      />
    </div>
  );
}
