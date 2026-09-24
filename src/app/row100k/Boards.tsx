"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  GOAL_METERS,
  PACE_TAG_FROM,
  TIERS,
  fmtMeters,
  fmtPaceTag,
  fmtRowerNumber,
  tierFor,
  visibleTiers,
  type Boards as BoardData,
  type Tier,
  type TotalRow,
} from "@/lib/row100k";
import { ELITE_LABEL, ELITE_TAG, digitCount, fmtPacificDay, partialShape } from "@/lib/blackoutRules";
import { BlockShape, BlockText, Blocks } from "./Blackout";

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

/* The one line an empty tier says, locked or not (owner, 2026-09-08: one
 * wording, not "no one listed" here and "nobody here" there). */
const EMPTY_LINE = "NOBODY HERE YET";

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
 * board by definition (it IS one of the elite), so it keeps a seat in the
 * lowest tier rather than vanishing into the warming-up count. */
function sectionOf(r: TotalRow): Tier["key"] | null {
  return tierFor(r.meters)?.key ?? (r.masked ? TIERS[0].key : null);
}

/* Case- and accent-insensitive, the fold the profile's roster search uses
 * (r/[num]/looks/RowerSearch.tsx): NFD splits an accent off its letter and
 * the combining marks are dropped, so JOSE finds José and José finds Jose.
 * Kept here rather than imported so the board does not pull a page's
 * client module in for six lines. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* Does a folded query find this row: anywhere in the name, or in the
 * rower's number as it prints (045 and 45 are the same rower). `q` is
 * already folded and non-empty. */
function rowMatches(r: { name: string; rowerNumber: number }, q: string): boolean {
  if (/^[0-9]+$/.test(q)) {
    if (Number(q) === r.rowerNumber) return true;
    if (fmtRowerNumber(r.rowerNumber).includes(q)) return true;
  }
  return fold(r.name).includes(q);
}

/* THE BOARD — the total-meters view of the full rankings since 2026-09-24
 * (owner: the board page is retired, its features brought over to
 * /row100k/records/total): the community strip and the standings — total
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
 * stay global across sections; while the elite lead the table they count
 * the listed rows from 1.
 *
 * Blackout: the rows arrive already masked from boardView (blackoutRules),
 * so the elite show digit blocks and their average split where the tier tag
 * goes — this component never sees their real numbers. Everything deeper
 * (records, the boards, the calendar, the hours, the field) lives on
 * /row100k/stats. */
export function Boards({
  boards,
  started,
  blackout = { active: false },
  head = true,
  tab: controlled,
  movement = true,
  statsHref = "/row100k/stats",
  query = "",
}: {
  boards: BoardsProp;
  started: boolean;
  blackout?: BlackoutProp;
  /* Off: no .bhead number — the full rankings print the month word and the
   * leader above the board (records/[record]/page.tsx) and must not print
   * the community total twice. No ledger either way since 2026-09-25
   * (owner: "remove the ROWERS IN / SESSIONS / 100K CLUB / TIME ROWED
   * ledger"); the stats page carries those figures. */
  head?: boolean;
  /* THE BOARD ON THE FULL RANKINGS (owner, 2026-09-24: the board page is
   * retired; its table lives on /row100k/records/total). There the
   * division is the page's own ?d= links, so the page hands the tab in and
   * the buttons here are not drawn. Absent: the board keeps its own tabs. */
  tab?: Tab;
  /* Off: no up/down arrows. A finished month has no last logged day to
   * have moved since; its board is final and says nothing about movement. */
  movement?: boolean;
  /* Where the line under the table goes — the stats page, for the month the
   * board is showing. */
  statsHref?: string;
  /* FIND A ROWER (owner, 2026-09-25: "I want to be able to search for a
   * rower on this page"): a number or a name, typed on the full rankings
   * (records/BoardFind.tsx). The board keeps only the rows it matches —
   * each one at its true place, under its own tier heading — and the tiers
   * nobody matched are not drawn. Empty: the whole board, as ever. */
  query?: string;
}) {
  const [own, setOwn] = useState<Tab>("ALL");
  const tab = controlled ?? own;
  const filtered = boards.total.filter((r) => tab === "ALL" || r.division === tab);

  // THE ELITE come OUT of the tier ladder while they are hidden (review,
  // 2026-09-05). A tier heading is a bracket, and bracketing them — .25M
  // above The 100K Club, 50K above 10K — publishes a finer ranking than the
  // blocks do: two rowers drawing six blocks each would be sorted by the
  // sections into an order the digit count never gave away, which is exactly
  // the "am I three or four" the owner took off the board. So they stand in
  // one block at the top of the table, in the order maskBoards handed over
  // (average split, then name), and the sections below carry everyone else.
  // Outside a window nobody is unranked and `rest` is the whole tab.
  const eliteRows = filtered.filter((r) => r.unranked);
  const rest = filtered.filter((r) => !r.unranked);

  // Movement is re-derived WITHIN the current tab, AMONG THE LISTED ROWS:
  // the previous order of a filtered board is its rows sorted by their
  // previous EVERYONE rank, so a man logging can't read as every woman
  // dropping a place. The elite are out of both orders (review, 2026-09-08):
  // maskBoards lifts the elite (the top N of each board, or the top N
  // overall, as the policy says — rowSettings.ts) to the head of the table,
  // and the tenth woman lifted over the eleventh man would otherwise print
  // as him dropping ten places — an arrow that never happened, and a bound
  // on ten hidden totals. The elite keep the zeroed delta they arrived with.
  // Outside a window this reproduces the server's delta exactly on ALL.
  const prevPos = new Map(
    rest
      .slice()
      .sort((a, b) => a.prevRank - b.prevRank)
      .map((r, i) => [r.participantId, i]),
  );
  const listed = rest.map((r, i) => ({
    ...r,
    delta: (prevPos.get(r.participantId) ?? i) - i,
  }));

  // Places are places among the listed rows, from 1 — the rule the stats
  // period board already follows (owner, 2026-09-08: the elite in their
  // block, "the ranked list under them numbers only the visible rows, from
  // 1"). Not the masked index: with ten hidden per division the elite are
  // no prefix of the Everyone board, so "one past the elite" (the 09-05
  // convention, true while the elite were the head of the whole board)
  // would call the eleventh man twenty-first, and his true place would say
  // how many of the elite he out-rows. Outside a window `listed` is the
  // whole tab, so this is the true place.
  const rankOf = new Map(listed.map((r, i) => [r.participantId, i + 1]));

  // The ladder is decided by the best rower on the WHOLE board. Masked rows
  // carry their tier floor, so the reach is the same as the truth's.
  const maxMeters = boards.total.reduce((m, r) => Math.max(m, r.meters), 0);
  const sections = [...visibleTiers(maxMeters)].reverse(); // highest first

  // Warming up = under 10k. Joined-but-not-logged rowers count toward the
  // number, not the meters; nobody here is listed by name until 10k.
  const warming = listed.filter((r) => sectionOf(r) === null);
  const warmingMeters = warming.reduce((s, r) => s + r.meters, 0);

  // FIND A ROWER (owner, 2026-09-25). Decided AFTER places and movement, so
  // a row found by name keeps the place and the arrow it holds on the whole
  // board: the search narrows what is drawn, never what is counted. The
  // elite block is searched the same way — a hidden rower's number and
  // name are public, and that is all a match gives away.
  const q = fold(query);
  const finding = q !== "";
  const eliteShown = finding ? eliteRows.filter((r) => rowMatches(r, q)) : eliteRows;
  const listedShown = finding ? listed.filter((r) => rowMatches(r, q)) : listed;

  // The rows themselves carry the mask, so a blacked-out board reads as one
  // even if a caller forgot the flag. Checked on the whole board, not the
  // tab: a Women's tab with no woman in the elite is still blacked out.
  // An admin (nothing masked while a window is open) gets told the truth
  // about what they are looking at rather than a line about hidden rows.
  // `unranked` counts too: the one board where nothing is masked but a row is
  // hidden is the viewer's own, alone in the elite — they get the note, not
  // an unexplained elite block.
  const anyHidden = boards.total.some((r) => r.masked || r.unranked);
  const blackedOut = blackout.active || anyHidden;

  // The head follows the tab (owner call, 2026-09-05): on the men's or
  // women's board it is that board's figures. Real sums from the server,
  // never a total over masked rows. No TODAY line (owner, 2026-09-08): the
  // day's meters and hours came off the board head; the front page has them.
  // No ledger under it since 2026-09-25 (owner: "remove the ROWERS IN /
  // SESSIONS / 100K CLUB / TIME ROWED ledger") — the number, when a caller
  // wants it, and then straight to the standings.
  const comm = tab === "ALL" ? boards.community : boards.community.divisions[tab];

  return (
    <div>
      {/* The newspaper head: one big blue number, the way the landing does
       * it (owner call, 2026-09-05). The full rankings hand `head` off: the
       * month word and the leader are their head. */}
      {head && (
        <div className="bhead">
          <div className="bhead-n">{comm.meters.toLocaleString("en-US")}</div>
          <p className="bhead-l mono">
            Meters combined · <b>{tab === "ALL" ? "everyone" : `${TAB_LABEL[tab]} board`}</b>
          </p>
        </div>
      )}

      {controlled === undefined && (
        <div className="tabs">
          {(["ALL", "M", "F"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              className={tab === t ? "on" : undefined}
              onClick={() => setOwn(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {blackedOut && (
        <p className="bo-note">
          {anyHidden
            ? `${ELITE_LABEL} · LISTED BY PACE`
            : `${ELITE_LABEL} IS ON — YOU SEE EVERYTHING`}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="board-empty">
          {started
            ? "NOBODY ON THIS BOARD YET — BE FIRST."
            : "THE START LIST IS FILLING — METERS SHOW UP HERE SEP 1."}
        </p>
      ) : finding && eliteShown.length === 0 && listedShown.length === 0 ? (
        /* The search found nobody on this board. A rower under 10k is not
         * listed by name (warming up), so they are not found here either;
         * the roster on any profile page finds everyone. */
        <p className="board-empty">NOBODY ON THIS BOARD MATCHES.</p>
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
              {eliteShown.length > 0 && (
                <>
                  {/* One block, no tier, no places — the list the note above
                      promises. It leads the table: they are the top of the
                      board, that much is public. Cream and ink like every
                      other row (owner, 2026-09-08: the white-on-black came
                      out — keep the paper, keep the pace numbers, keep them
                      apart from the rest): the heading is ink on a solid
                      rule, a second solid rule closes the block, and the
                      pace tag is the identity, the order by it. */}
                  <tr className="divrow elite" id="elite">
                    <td colSpan={4}>
                      {ELITE_LABEL}
                      <span className="by">BY AVERAGE SPLIT</span>
                    </td>
                  </tr>
                  {eliteShown.map((r) => (
                    <TotalRowTr key={r.participantId} r={r} rank={0} movement={movement} />
                  ))}
                </>
              )}
              {sections.map((t) => {
                const locked = maxMeters < t.meters;
                // Only the rung past the goal is a secret; the ladder up to
                // 100k is the challenge's own pitch.
                const hidden = locked && t.meters > GOAL_METERS;
                const members = listedShown.filter((r) => sectionOf(r) === t.key);
                // While the elite lead the table an empty tier is not drawn
                // at all — no heading, no line (owner, 2026-09-08): the
                // elite may well be standing in it, so the board has nothing
                // true to say there. A tier with somebody listed still
                // shows, elite or not. Outside a window the empty rungs stay:
                // the ladder is the pitch — unless a search is on, when the
                // tiers collapse to the matches (owner, 2026-09-25).
                if (members.length === 0 && (eliteRows.length > 0 || finding)) return null;
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
                          movement={movement}
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
                          M — {EMPTY_LINE}
                        </td>
                      </tr>
                    ) : (
                      /* Reached by somebody, empty on this tab: on ALL that
                       * means everyone in range moved up; on a division tab
                       * it means the other division got there first. One
                       * line for both (owner call, 2026-09-05), and the same
                       * line a locked tier ends on. Never drawn while the
                       * elite are out of the ladder (see above). */
                      <tr className="lockrow">
                        <td colSpan={4}>{EMPTY_LINE}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {/* Not while searching: the warming-up count is a line about
                  everybody under 10k, not about anyone the search found. */}
              {warming.length > 0 && !finding && (
                <>
                  <tr className="divrow rest">
                    <td colSpan={4}>Warming up</td>
                  </tr>
                  <tr className="lockrow">
                    <td colSpan={4}>
                      {warming.length} {warming.length === 1 ? "ROWER" : "ROWERS"} WARMING UP FOR{" "}
                      {warmingMeters.toLocaleString("en-US")} M
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <a className="big-act stats-link" href={statsHref}>
        Records, the boards &amp; the field →
      </a>
    </div>
  );
}

/* One standing. The tag goes IN FRONT of the name (owner call, 2026-09-05);
 * a blacked-out row wears its average split there instead of its tier,
 * shows blocks for its meters and drops the progress bar — the bar width
 * would give the number away. The name still links: /row100k/r/[num] masks
 * the same elite the same way, so the profile is no way around the blocks.
 *
 * The places half of the rule (owner, 2026-09-05 evening): one of the
 * hidden elite carries NO place — the # cell stays empty (the cell keeps
 * the column, so every row below still lines up) and no movement arrow is
 * drawn, since a place moved is a place known. The tab keeps the elite out
 * of its movement math, so they arrive with the zeroed delta maskBoards
 * handed over; the skip here is the belt to that brace. They wear no tier
 * tag: the row sits
 * in the elite block, outside the ladder (the viewer's own row keeps its
 * meters, but it is in the same block and reads the same). The elite-row
 * class only closes the block: the last of them draws the solid rule. */
function TotalRowTr({ r, rank, tier, movement = true }: { r: TotalRow; rank: number; tier?: Tier; movement?: boolean }) {
  // Past PACE_TAG_FROM the tag is the rower's average split, to the second —
  // pace as identity, the way a marathoner is a 3:10 (owner, 2026-09-05).
  // While hidden, the tag is their average split too (owner, 2026-09-05:
  // the elite rank by pace and wear it where the club tag goes); the plain
  // ELITE tag only when there is no timed row to average.
  const badge = r.unranked && r.paceTag ? (
    <span className="tierbadge pace">{r.paceTag}</span>
  ) : r.masked || r.unranked ? (
    <span className="tierbadge elite">{ELITE_TAG}</span>
  ) : r.meters >= PACE_TAG_FROM && r.seconds > 0 ? (
    <span className="tierbadge pace">{fmtPaceTag(r.meters, r.seconds)}</span>
  ) : (
    tier && <span className={`tierbadge ${tier.rarity}`}>{tier.label}</span>
  );
  return (
    <tr className={r.unranked ? "elite-row" : undefined}>
      <td className="rk">{r.unranked ? "" : rank}</td>
      <td>
        <Who row={r} badge={badge} />
      </td>
      <td>{r.unranked || !movement ? null : <Movement delta={r.delta} />}</td>
      <td className="num">
        {r.masked ? (
          <>
            <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
          </>
        ) : r.hideLow ? (
          <>
            {/* The run-up: the digits still showing are real, the tail is
                already out of the row (blackoutRules.rampRow). No bar —
                its width would give the covered digits back. */}
            <BlockShape
              shape={partialShape(r.meters, r.hideLow, r.digits)}
              label="partly hidden"
            />{" "}
            m
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
