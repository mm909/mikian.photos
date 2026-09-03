"use client";

import { useState } from "react";
import { MyRows, type MyRow } from "./MyRows";
import { ShareDialog } from "./ShareMenu";
import type { ShareData } from "./share/cards";

/* An admin on someone else's profile page: the same log everyone sees, plus
 * the share machinery the rower has on their own page — so a card can be
 * made for any rower. The repost case: someone stories a row without the
 * card, and the repost wants the card with their name and number on it.
 * Rows are editable too — the rows API lets challenge admins fix or delete
 * anyone's rows, so the same controls render here. */
export function AdminShare({ data, rows }: { data: ShareData; rows: MyRow[] }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState<{
    day: string;
    meters: number;
    seconds: number;
    title?: string;
  } | null>(null);

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
          {rows.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET.</p>
          ) : (
            <MyRows
              rows={rows}
              canEdit
              onShare={(r) => {
                setRow({ day: r.day, meters: r.meters, seconds: r.seconds, title: r.title });
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
