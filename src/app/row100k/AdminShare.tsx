"use client";

import { useState } from "react";
import { MyRows, type MyRow } from "./MyRows";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* An admin on someone else's profile page: the visitor's log table, plus the
 * same share machinery the rower has on their own page — so a card can be
 * made for any rower. The repost case: someone stories a row without the
 * card, and the repost wants the card with their name and number on it.
 * Sharing only — no edit or delete here; changing rows stays in Moderation. */
export function AdminShare({ data, rows }: { data: ShareData; rows: MyRow[] }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<{ day: string; meters: number; seconds: number } | null>(null);

  return (
    <>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The log</h2>
            <button
              type="button"
              className="quiet-btn"
              onClick={() => {
                setRow(null);
                setOpen(true);
              }}
            >
              SHARE THEIR CARD
            </button>
          </div>
          <p
            className="mono"
            style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--gray)", marginBottom: 10 }}
          >
            ADMIN ONLY — CARDS RENDER WITH THEIR NAME AND NUMBER
          </p>
          {rows.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET.</p>
          ) : (
            <MyRows
              rows={rows}
              canEdit={false}
              onShare={(r) => {
                setRow({ day: r.day, meters: r.meters, seconds: r.seconds });
                setOpen(true);
              }}
            />
          )}
        </div>
      </section>

      <ShareDialog
        data={{ ...data, row }}
        open={open}
        onClose={() => setOpen(false)}
        preferredCardId={row ? "rowtember-row" : undefined}
      />
    </>
  );
}
