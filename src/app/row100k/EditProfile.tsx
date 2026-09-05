"use client";

import { JoinPanel } from "./JoinPanel";
import type { Division } from "@/lib/row100k";

/* The settings form on /row100k/settings (the server only renders this for
 * the signed-in rower's own row — it moved off the profile page behind the
 * account menu, owner call 2026-09-05). Wrapped in .panel so the underline
 * inputs pick up the poster styling; JoinPanel in edit mode lays the fields
 * out one per row, the same as the join form. A legacy division value
 * (anything but M/F) starts the picker empty rather than lying. */
export function EditProfile(props: { name: string; instagram: string; division: Division | null }) {
  return (
    <div className="panel">
      <JoinPanel
        mode="form"
        joined
        initialName={props.name}
        initialInstagram={props.instagram}
        initialDivision={props.division}
      />
    </div>
  );
}
