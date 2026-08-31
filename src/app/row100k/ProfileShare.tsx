"use client";

import { useState } from "react";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* The profile's own shareables entry — a button right in the header, so
 * making a card doesn't require scrolling to the log. Renders for the
 * rower themself and for admins (the cards carry the profile's name and
 * number either way). */
export function ProfileShare({ data }: { data: ShareData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="outline-btn"
        style={{ marginTop: 12 }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Shareables
      </button>
      <ShareDialog data={data} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
