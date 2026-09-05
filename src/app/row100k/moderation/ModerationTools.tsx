"use client";

import { fmtRowerNumber } from "@/lib/row100k";
import { MyRows, type MyRow } from "../MyRows";
import { RemoveRower } from "../RemoveRower";

/* The admin's tools for ONE picked rower, on /row100k/moderation — never on
 * the rower's profile (owner call, 2026-09-05: "I don't want to see
 * moderation while I'm scrolling their page"). The same editable ledger the
 * rower has on their own page (the rows API lets challenge admins fix or
 * delete anyone's rows), and the remove-rower control under a rule of its
 * own so it is never one stray tap from the edit menu. Card-making stays on
 * the profile (ProfileShare) — this page is for fixing things. */

/* Just enough to head the tools and link out — the roster table below the
 * tools already carries meters, sessions and board for every rower, so the
 * picked rower gets no second set of tiles up here. */
export type ModeratedRower = {
  id: string;
  rowerNumber: number;
  name: string;
};

export function ModerationTools({ rower, rows }: { rower: ModeratedRower; rows: MyRow[] }) {
  return (
    <>
      <div className="sec-head">
        <h2>{rower.name}</h2>
        <span className="mono">
          ROWER {fmtRowerNumber(rower.rowerNumber)} ·{" "}
          <a href={`/row100k/r/${rower.rowerNumber}`}>PROFILE →</a>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="board-empty">NOTHING LOGGED YET.</p>
      ) : (
        <MyRows rows={rows} canEdit />
      )}

      <div className="mod-danger">
        <span className="k">Remove</span>
        <p className="mod-lede">Takes {rower.name} and their whole log off the board.</p>
        <RemoveRower participantId={rower.id} name={rower.name} />
      </div>
    </>
  );
}
