"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  GOAL_METERS,
  TIERS,
  fmtMeters,
  fmtRowerNumber,
  tierFor,
  visibleTiers,
  type Boards as BoardData,
  type Tier,
  type TotalRow,
} from "@/lib/row100k";
import { ELITE_LABEL, ELITE_TAG, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import { BlockText, Blocks } from "./Blackout";

export type Tab = "ALL" | "M" | "F";

export const TAB_LABEL: Record<Tab, string> = { ALL: "Everyone", M: "Men's", F: "Women's" };
export const TAB_WORD: Record<Tab, string> = { ALL: "everyone", M: "men", F: "women" };

/* What the page tells the board about the blackout — plain JSON straight
 * from boardView. Just whether one is on and when it lifts; the window
 * itself is admin business. */
export type BlackoutProp = { active: boolean; endsAt?: string };

/* The two slices the board reads: the standings and the community strip.
 * Deliberately NOT the whole Boards object — this is a client component,
 * so anything handed in lands in the page source, and maskBoards only
 * masks `total`: the record boards (fastest, longest, bigDay) still carry
 * every elite rower's real seconds and meters. Narrowing the prop makes
 * the compiler stop the next caller from shipping them for nothing
 * (review, 2026-09-05). */
export type BoardsProp = Pick<BoardData, "total" | "community">;

/* A hidden tier title is always this many blocks: the real length would
 * give away how long the name is (review, 2026-09-05). */
const HIDDEN_TITLE_BLOCKS = 8;

/* Names link to the rower's profile page (their IG link lives there).
 * Takes anything row-shaped — total, record and weekly rows all qualify.
 * `badge` goes between the number and the name — "001 · [10K] Name" — so
 * the tag is in front of the NAME, not the cell (owner call, 2026-09-05).
 * `link` off renders the name as plain text: a blacked-out row must not be
 * one click from a profile page that still prints the real total. Turn it
 * back on once /row100k/r/[num] masks the same way the board does. */
export function Who({
  row,
  badge,
  link = true,
}: {
  row: { name: string; rowerNumber: number };
  badge?: ReactNode;
  link?: boolean;
}) {
  return (
    <span className="who">
      <span style={{ color: "var(--gray)", fontFamily: "var(--row-mono), monospace", fontWeight: 400 }}>
        {fmtRowerNumber(row.rowerNumber)} ·{" "}
      </span>
      {badge}
      {link ? <a href={`/row100k/r/${row.rowerNumber}`}>{row.name}</a> : row.name}
    </span>
  );
}

function Movement({ delta }: { delta: number }) {
  if (!delta) return null;
  return delta > 0 ? (
    <span className="mv up" title={`Up ${delta} since the last logged day`}>
      ▲{delta}
    </span>
  ) : (
    <span className="mv dn" title={`Down ${-delta} since the last logged day`}>
      ▼{-delta}
    </span>
  );
}

/* Which section a row files under. Under 10k is nobody's section (warming
 * up) — except a blacked-out row, whose floor is 0 below 10k: it is on the
 * board by definition (it IS one of the fifteen), so it keeps a seat in the
 * lowest tier rather than vanishing into the warming-up count. */
function sectionOf(r: TotalRow): Tier["key"] | null {
  return tierFor(r.meters)?.key ?? (r.masked ? TIERS[0].key : null);
}

/* THE BOARD on the main page: the community strip and the standings — total
 * meters, sectioned into tiers (visibleTiers: every tier reached plus the
 * next locked one, highest first). Section headers say the tier's title
 * ("Rowtember Athlete", "The 100K Club"…) — rarity stays a color key only,
 * the words never render (owner call, cycle 2). The ladder is the whole
 * field's, not the tab's: a tier anybody has reached is unlocked on every
 * tab (a division that has nobody there says so), so the challenge's own
 * 100K never re-locks on the Women's tab. Only the rung ABOVE the goal keeps
 * its name and threshold behind blocks: nobody should know what comes after
 * 100k until somebody reaches it (owner call, 2026-09-05). Under 10k you
 * are warming up, not on the board — one line counts them. Rank numbers
 * stay global across sections.
 *
 * Blackout: the rows arrive already masked from boardView (blackoutRules),
 * so the top fifteen show digit blocks and an ELITE 15 tag — this
 * component never sees their real numbers. Everything deeper (records, the
 * weeks, the calendar, the curve) lives on /row100k/stats. */
export function Boards({
  boards,
  started,
  blackout = { active: false },
}: {
  boards: BoardsProp;
  started: boolean;
  blackout?: BlackoutProp;
}) {
  const [tab, setTab] = useState<Tab>("ALL");
  // Movement is re-derived WITHIN the current tab: the previous order of a
  // filtered board is its rows sorted by their previous EVERYONE rank, so a
  // man logging can't read as every woman dropping a place. On ALL this
  // reproduces the server's delta exactly.
  const filtered = boards.total.filter((r) => tab === "ALL" || r.division === tab);
  const prevPos = new Map(
    filtered
      .slice()
      .sort((a, b) => a.prevRank - b.prevRank)
      .map((r, i) => [r.participantId, i]),
  );
  const total = filtered.map((r, i) => ({
    ...r,
    delta: (prevPos.get(r.participantId) ?? i) - i,
  }));

  // The ladder is decided by the best rower on the WHOLE board. Masked rows
  // carry their tier floor, so the reach is the same as the truth's.
  const maxMeters = boards.total.reduce((m, r) => Math.max(m, r.meters), 0);
  const sections = [...visibleTiers(maxMeters)].reverse(); // highest first
  // Warming up = under 10k. Joined-but-not-logged rowers count toward the
  // number, not the meters; nobody here is listed by name until 10k.
  const warming = total.filter((r) => sectionOf(r) === null);
  const warmingMeters = warming.reduce((s, r) => s + r.meters, 0);
  const rankOf = new Map(total.map((r, i) => [r.participantId, i + 1]));

  // The rows themselves carry the mask, so a blacked-out board reads as one
  // even if a caller forgot the flag. Checked on the whole board, not the
  // tab: a Women's tab with no woman in the fifteen is still blacked out.
  // An admin (nothing masked while a window is open) gets told the truth
  // about what they are looking at rather than a line about hidden rows.
  const anyMasked = boards.total.some((r) => r.masked);
  const blackedOut = blackout.active || anyMasked;
  const until = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";

  // The strip follows the tab (owner call, 2026-09-05): on the men's or
  // women's board it is that board's meters, rowers, sessions and finishers.
  // Real sums from the server, never a total over masked rows.
  const comm = tab === "ALL" ? boards.community : boards.community.divisions[tab];

  return (
    <div>
      <div className="comm">
        <div className="c">
          <div className="n">{comm.meters.toLocaleString("en-US")}</div>
          <div className="l">meters combined</div>
        </div>
        <div className="c">
          <div className="n">{comm.people}</div>
          <div className="l">rowers in</div>
        </div>
        <div className="c">
          <div className="n">{comm.sessions}</div>
          <div className="l">sessions</div>
        </div>
        <div className="c">
          <div className="n">{comm.finished}</div>
          <div className="l">finished 100k</div>
        </div>
      </div>

      <div className="tabs">
        {(["ALL", "M", "F"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "on" : undefined}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {blackedOut && (
        <p className="bo-note">
          {anyMasked
            ? `BLACKOUT — ${ELITE_LABEL} ARE HIDDEN${until}`
            : `BLACKOUT ON${until} — YOU SEE EVERYTHING`}
        </p>
      )}

      {total.length === 0 ? (
        <p className="board-empty">
          {started
            ? "NOBODY ON THIS BOARD YET — BE FIRST."
            : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="board">
            <thead>
              <tr>
                <th className="rk">#</th>
                <th>Rower</th>
                <th aria-label="Movement" />
                <th style={{ textAlign: "right" }}>Meters</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((t) => {
                const locked = maxMeters < t.meters;
                // Only the rung past the goal is a secret; the ladder up to
                // 100k is the challenge's own pitch.
                const hidden = locked && t.meters > GOAL_METERS;
                const members = total.filter((r) => sectionOf(r) === t.key);
                return (
                  <Fragment key={t.key}>
                    <tr className={`divrow ${locked ? "locked" : t.rarity}`}>
                      <td colSpan={4}>{hidden ? <BlockText chars={HIDDEN_TITLE_BLOCKS} /> : t.title}</td>
                    </tr>
                    {members.length > 0 ? (
                      members.map((r) => (
                        <TotalRowTr
                          key={r.participantId}
                          r={r}
                          rank={rankOf.get(r.participantId) ?? 0}
                          tier={t}
                        />
                      ))
                    ) : locked ? (
                      /* Nobody on the whole board has this yet. Past the
                       * goal the threshold is hidden too — you row until
                       * you get it. */
                      <tr className="lockrow">
                        <td colSpan={4}>
                          UNLOCKS AT{" "}
                          {hidden ? <Blocks digits={digitCount(t.meters)} /> : t.meters.toLocaleString("en-US")}{" "}
                          M — NOBODY HERE YET
                        </td>
                      </tr>
                    ) : (
                      /* Reached by somebody, empty on this tab: on ALL that
                       * means everyone in range moved up; on a division tab
                       * it means the other division got there first. One
                       * line for both (owner call, 2026-09-05). */
                      <tr className="lockrow">
                        <td colSpan={4}>NO ONE HERE YET</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {warming.length > 0 && (
                <>
                  <tr className="divrow rest">
                    <td colSpan={4}>Warming up</td>
                  </tr>
                  <tr className="lockrow">
                    <td colSpan={4}>
                      {warming.length} {warming.length === 1 ? "ROWER" : "ROWERS"} WARMING UP ·{" "}
                      {warmingMeters.toLocaleString("en-US")} M BETWEEN THEM
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <a className="big-act stats-link" href="/row100k/stats">
        Records, the calendar &amp; the curve →
      </a>
    </div>
  );
}

/* One standing. The tag goes IN FRONT of the name (owner call, 2026-09-05);
 * a blacked-out row wears ELITE 15 there instead of its tier, shows blocks
 * for its meters and drops the progress bar — the bar width would give the
 * number away. The name still links: /row100k/r/[num] masks the same
 * fifteen the same way, so the profile is no way around the blocks. */
function TotalRowTr({ r, rank, tier }: { r: TotalRow; rank: number; tier?: Tier }) {
  const badge = r.masked ? (
    <span className="tierbadge elite">{ELITE_TAG}</span>
  ) : (
    tier && <span className={`tierbadge ${tier.rarity}`}>{tier.label}</span>
  );
  return (
    <tr>
      <td className="rk">{rank}</td>
      <td>
        <Who row={r} badge={badge} />
      </td>
      <td>
        <Movement delta={r.delta} />
      </td>
      <td className="num">
        {r.masked ? (
          <>
            <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
          </>
        ) : (
          <>
            {fmtMeters(r.meters)}
            <div className="rowbar" aria-hidden="true">
              <div className="f" style={{ width: `${Math.min(100, r.pct)}%` }} />
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
