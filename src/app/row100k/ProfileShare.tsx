"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* The profile's own shareables entry — a button right in the header, so
 * making a card doesn't require scrolling to the log. Renders for the
 * rower themself and for admins (the cards carry the profile's name and
 * number either way).
 *
 * `quiet` (the profile since 2026-09-25, owner: "move the SHARE button
 * onto the same line as the DECEMBER 2026 date selection"): the mono word
 * with a dotted rule (.pf-share, looks/profileCss.ts) at the right of the
 * dateline — the admin's SHARE on somebody else's page — instead of the
 * big underlined button. */
export function ProfileShare({ data, quiet }: { data: ShareData; quiet?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={quiet ? "pf-share" : "outline-btn"}
        style={quiet ? undefined : { marginTop: 12 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Share
      </button>
      <ShareDialog data={data} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
