"use client";

import { useState } from "react";
import { fmtMeters } from "@/lib/row100k";
import { Blocks } from "../Blackout";
import { Eyebrow } from "./pieces";
import { MOVED_TOP, movedToday, type LookFriend } from "./view";

/* MOVED TODAY (owner, 2026-09-25: "a summary table of friends who moved
 * today — the top ten who submitted meters and their new totals, with a
 * SEE ALL"): the followed rowers who logged today, most meters first —
 * their new total, today's meters, the title of the row. Ten, then SEE
 * ALL swaps the rest in under them; with 400 friends that is still one
 * table, not one per friend. A masked friend prints blocks for the total
 * and nothing for today. */
export function MovedToday({ friends, todayStr }: { friends: LookFriend[]; todayStr: string }) {
  const [all, setAll] = useState(false);
  const moved = movedToday(friends);
  const shown = all ? moved : moved.slice(0, MOVED_TOP);
  const rest = moved.length - shown.length;
  return (
    <section className="lk-moved">
      <Eyebrow aside={<span>{moved.length} of {friends.length}</span>}>Moved today · {todayStr}</Eyebrow>
      {moved.length === 0 ? (
        <p className="lk-empty mono">Nobody you follow has rowed today yet.</p>
      ) : (
        <table className="board lk-tab lk-mv">
          <thead>
            <tr>
              <th>Rower</th>
              <th className="ttl">Row</th>
              <th className="num">Today</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.participantId}>
                <td>
                  <span className="who">
                    <span className="n">{f.numStr} · </span>
                    <a href={`/row100k/r/${f.rowerNumber}`}>{f.name}</a>
                  </span>
                </td>
                <td className="ttl">{f.todayTitle}</td>
                <td className="num lk-today">
                  {f.masked ? "" : `+${fmtMeters(f.todayMeters)}`}
                  {f.todayRows > 1 ? <span className="x"> · {f.todayRows} rows</span> : null}
                </td>
                <td className="num">
                  {f.masked ? (
                    <>
                      <Blocks digits={f.digits ?? 1} /> m
                    </>
                  ) : (
                    fmtMeters(f.meters)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rest > 0 ? (
        <p className="lk-more mono">
          <button type="button" className="lk-word" onClick={() => setAll(true)}>
            See all
          </button>
          <span className="dim"> · {rest} more</span>
        </p>
      ) : null}
    </section>
  );
}
