"use client";

import { useState } from "react";
import { daysElapsed } from "@/lib/row100k";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* One share button + its dialog, restricted to a set of community cards —
 * the stats page drops one of these under each shareable chart, the main
 * page one under the board. The personal fields are stand-ins: every card
 * the `only` list allows draws from `community` alone. The day count the
 * calendar and curve cards stop at is filled in here, once, so no caller
 * has to remember it; a caller that already knows (a server page reading
 * the same clock) may pass `days` and it is kept. */

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

  const days = community.days ?? daysElapsed();
  const data: ShareData = {
    displayName: "EVERYONE",
    rowerNumber: 0,
    instagram: "",
    meters: community.meters,
    sessions: community.sessions,
    byDay: community.byDay,
    days,
    community: { ...community, days },
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
