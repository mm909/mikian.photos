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
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12,
          background: "transparent",
          border: "2px solid var(--ink)",
          color: "var(--ink)",
          fontFamily: "var(--row-mono),monospace",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          padding: "8px 16px",
          cursor: "pointer",
        }}
      >
        Shareables
      </button>
      <ShareDialog data={data} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
