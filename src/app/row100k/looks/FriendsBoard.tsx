import { Blocks } from "../Blackout";
import { fmtMeters } from "@/lib/row100k";
import { Eyebrow, MetersOf } from "./pieces";
import { BOARD_CAP, rowsToday, type LookFriend, type LookRow } from "./view";

/* THE FRIENDS BOARD (owner, 2026-09-25: "show the board but only for my
 * friends"): the standings of the followed rowers, in the order the board
 * already put them, with a MOVED TODAY tag and today's meters beside
 * anyone who logged today, then a short list of today's rows under it.
 * Caps at BOARD_CAP and links to the whole board, so 400 friends make a
 * page and not a scroll. A masked friend prints blocks, no place and no
 * today figure — the tag alone says they moved. Plain component (no
 * hooks): the page renders it on the server. */

function FriendMeters({ f }: { f: LookFriend }) {
  return f.masked ? (
    <>
      <Blocks digits={f.digits ?? 1} /> m
    </>
  ) : (
    <>{fmtMeters(f.meters)}</>
  );
}

export function FriendsBoard({
  friends,
  rows,
  boardHref,
  todayStr,
  compact = false,
}: {
  friends: LookFriend[];
  rows: LookRow[];
  boardHref: string;
  todayStr: string;
  /* The right column of look d: no list of today's rows under it. */
  compact?: boolean;
}) {
  const shown = friends.slice(0, BOARD_CAP);
  const rest = friends.length - shown.length;
  const today = rowsToday(rows);
  let place = 0;
  return (
    <section className="lk-board">
      <Eyebrow aside={<a href={boardHref}>Everyone</a>}>Friends · {friends.length}</Eyebrow>
      {shown.length === 0 ? (
        <p className="lk-empty mono">Nobody to follow yet.</p>
      ) : (
        <table className="board lk-tab">
          <tbody>
            {shown.map((f) => {
              if (!f.unranked) place += 1;
              return (
                <tr key={f.participantId} className={f.todayRows > 0 ? "moved" : undefined}>
                  <td className="rk">{f.unranked ? "" : place}</td>
                  <td>
                    <span className="who">
                      <span className="n">{f.numStr} · </span>
                      <a href={`/row100k/r/${f.rowerNumber}`}>{f.name}</a>
                    </span>
                    {f.todayRows > 0 ? (
                      <span className="lk-tag mono">
                        Moved today
                        {/* The column board (compact) has no today column:
                          * the meters ride on the tag instead. */}
                        {compact && !f.masked ? ` · +${fmtMeters(f.todayMeters)}` : ""}
                      </span>
                    ) : null}
                  </td>
                  {!compact ? (
                    <td className="num lk-today">{f.todayRows > 0 && !f.masked ? `+${fmtMeters(f.todayMeters)}` : ""}</td>
                  ) : null}
                  <td className="num">
                    <FriendMeters f={f} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {rest > 0 ? (
        <p className="lk-more mono">
          <a className="lk-word" href={boardHref}>
            See all
          </a>
          <span className="dim"> · {rest} more</span>
        </p>
      ) : null}

      {!compact ? (
        <div className="lk-today-list">
          <Eyebrow>Today · {todayStr}</Eyebrow>
          {today.length === 0 ? (
            <p className="lk-empty mono">Nobody you follow has rowed today yet.</p>
          ) : (
            <ul className="lk-lines mono">
              {today.map((r) => (
                <li key={r.id}>
                  <span className="n">{r.numStr} ·</span> <a href={`/row100k/r/${r.rowerNumber}`}>{r.name}</a>
                  <span className="dot">·</span>
                  <b>
                    <MetersOf row={r} />
                  </b>
                  <span className="dot">·</span>
                  {r.splitStr}
                  {r.title ? (
                    <>
                      <span className="dot">·</span>
                      <span className="t">{r.title}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
