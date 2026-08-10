"use client";

import { JoinPanel } from "./JoinPanel";
import type { Division } from "@/lib/row100k";

/* The settings form on a rower's own profile page (the server only renders
 * this when the signed-in viewer IS this rower). Wrapped in .panel so the
 * underline inputs pick up the poster styling. */
export function EditProfile(props: { name: string; instagram: string; division: Division }) {
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
