import type { ReactNode } from "react";
import { metersText, tokensFor } from "@/components/home/digits";
import { ELITE_TAG, digitCount } from "@/lib/blackoutRules";
import { fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit } from "@/lib/row100k";
import { BlockClock, Blocks } from "../../../Blackout";
import { Heatmap } from "../../../Heatmap";
import { LogInPlace } from "../../../LogInPlace";
import { ProfileLog } from "../../../ProfileLog";
import { ProfileShare } from "../../../ProfileShare";
import { BestsTables } from "./BestsTables";
import { BestsTablesShare } from "./BestsTablesShare";
import { MyLog } from "./MyLog";
import { RowerSearch } from "./RowerSearch";
import type { ProfileView } from "./view";

/* The pieces the profile (Profile.tsx) is built from — server components,
 * all of them, so the raw numbers in the view never leave the server
 * except through the client components this file mounts on purpose:
 * LogInPlace and MyLog (the rower's own page only), BestsTablesShare (a
 * profile that is not masked), ProfileLog (rows the page already blanked),
 * RowerSearch (the roster, which is numbers and names and nothing else).
 *
 * Every number of the rower's goes through Num / Clock below, which draw
 * blocks while the viewer is masked (blackoutRules.ts), so the layout
 * cannot print a hidden figure by forgetting the guard — it has no other
 * way to print one. */

/* "12.4 h" — time rowed, the front page's hours voice. */
export function hoursText(seconds: number): string {
  const h = (seconds / 3600).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${h} h`;
}

/* A meters figure of the rower's: blocks of the right width while masked. */
export function Num({ view, n }: { view: ProfileView; n: number }) {
  return view.masked ? (
    <>
      <Blocks digits={digitCount(n)} /> m
    </>
  ) : (
    <>{fmtMeters(n)}</>
  );
}

/* A time of the rower's: the clock's silhouette while masked. */
export function Clock({ view, s }: { view: ProfileView; s: number }) {
  return view.masked ? <BlockClock seconds={s} /> : <>{fmtDuration(s)}</>;
}

/* ------------------------------------------------------------ nameplate */

/* "MEN'S BOARD · 100K CLUB · DAY 5 OF 30" — the dateline under the name. */
function dateline(view: ProfileView): string {
  const board = view.rower.division === "F" ? "WOMEN'S BOARD" : "MEN'S BOARD";
  const day =
    view.phase === "before"
      ? "FIRST STROKE SEP 1"
      : view.phase === "closed"
        ? "FINAL"
        : `DAY ${view.days} OF 30`;
  return `${board}${view.club ? " · 100K CLUB" : ""} · ${day}`;
}

/* The nameplate: number and name in the front page's masthead face, one
 * step smaller, over a hairline; the dateline in the front page's mono.
 *
 * The NAME is also the way off this page (owner ask, 2026-09-06: tap the
 * name and search for someone) — so the head itself is RowerSearch, a
 * client component: the number stays plain text, the name carries the
 * caret and drops the search panel under the dateline. The dateline is
 * still computed and rendered here, on the server, and handed in. */
export function Nameplate({ view }: { view: ProfileView }) {
  return (
    <RowerSearch
      rowerNumber={view.rower.rowerNumber}
      displayName={view.rower.displayName}
      roster={view.roster}
    >
      <p className="pf-date mono">{dateline(view)}</p>
    </RowerSearch>
  );
}

/* ----------------------------------------------------------- big number */

/* THE one big blue figure: on the rower's own page their meters in the
 * front page odometer (seven cells, leading zeros dimmed — the front
 * page's .my-od; the ten-millions wheel went with the owner, 2026-09-05), on anyone else's the board head number; blocks while masked.
 * `unit` is the mono descriptor under it. */
export function BigMeters({ view, unit }: { view: ProfileView; unit: ReactNode }) {
  const m = view.totals.meters;
  if (view.isMe) {
    const tokens = tokensFor(metersText(m, 7));
    return (
      <div className="pf-od">
        <div className="my-od" role="img" aria-label={`${m.toLocaleString("en-US")} meters rowed`}>
          {tokens.map((t, i) => (
            <span
              key={i}
              className={`${t.sep ? "sep" : "cell"}${t.lead ? " lead" : ""}`}
              aria-hidden="true"
            >
              {t.ch}
            </span>
          ))}
        </div>
        <p className="my-unit mono">{unit}</p>
      </div>
    );
  }
  return (
    <div className="pf-big">
      <div className="bhead-n">
        {view.masked ? <Blocks digits={digitCount(m)} /> : m.toLocaleString("en-US")}
      </div>
      <p className="bhead-l mono">{unit}</p>
    </div>
  );
}

/* "Meters · 12.4 h on the erg" — the descriptor that carries TIME ROWED
 * right under the big number. A masked rower's hours are a number of
 * theirs, so the line says so instead; a rower with no rows yet gets the
 * ledger's own phrase rather than 0.0 h, so the two agree that zero is
 * not a figure. */
export function MetersUnit({ view }: { view: ProfileView }) {
  const text = view.masked
    ? "blackout"
    : view.totals.sessions > 0
      ? `${hoursText(view.totals.seconds)} on the erg`
      : "not yet rowed";
  return (
    <>
      Meters · <b>{text}</b>
    </>
  );
}

/* ------------------------------------------------------------- actions */

/* LOG A ROW / SHARE on the rower's own page — the front page's
 * LogInPlace, so the form opens under the button instead of standing open
 * (owner call, 2026-09-05), the share dialog pops on the single-row card
 * once a row lands, and #log / row100k:log still open the seam. An admin
 * on someone else's page keeps the share button (the repost case) in the
 * same face. Nothing for a visitor. */
export function Actions({ view }: { view: ProfileView }) {
  if (view.isMe && view.log) {
    return (
      <div className="pf-act">
        <LogInPlace
          share={view.shareData}
          defaultDay={view.log.defaultDay}
          defaultTitle={view.log.defaultTitle}
          phase={view.log.phase}
          earlyAdmin={view.log.earlyAdmin}
          sanity={view.log.sanity}
        />
      </div>
    );
  }
  if (view.isAdmin) {
    return (
      <div className="pf-adm">
        <ProfileShare data={view.shareData} />
      </div>
    );
  }
  return null;
}

/* The mono identity line the front page prints instead of a bib card —
 * number, name, handle (the handle opens Instagram). */
export function Identity({ view }: { view: ProfileView }) {
  const { rowerNumber, displayName, instagram } = view.rower;
  return (
    <p className="front-id mono pf-id">
      ROWER {fmtRowerNumber(rowerNumber)} · {displayName.toUpperCase()}
      {instagram ? (
        <>
          {" · "}
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer">
            @{instagram.toUpperCase()}
          </a>
        </>
      ) : null}
    </p>
  );
}

/* -------------------------------------------------------------- ledger */

export type LedgerItem = {
  key: string;
  k: ReactNode;
  v: ReactNode;
};

/* The board's dotted ledger (.bl): key, leaders, bold value. */
export function Ledger({ items }: { items: LedgerItem[] }) {
  return (
    <ul className="bl">
      {items.map((it) => (
        <li key={it.key}>
          <span className="k">{it.k}</span>
          <span className="dots" aria-hidden="true" />
          <span className="v">{it.v}</span>
        </li>
      ))}
    </ul>
  );
}

/* METERS A DAY — the total over the September days ELAPSED so far
 * (view.days, the day the month calendar stops at; never below 1), not
 * over the days rowed: it is the rower's pace toward the goal, so a rest
 * day counts against it (owner ask, 2026-09-05; to average over the days
 * they actually rowed instead, count the days in view.byDay — the view no
 * longer carries a days-rowed total). Rounded to the metre. */
export function metersPerDay(view: ProfileView): number {
  return Math.round(view.totals.meters / Math.max(1, view.days));
}

/* The six figures under the big number: TIME ROWED first (the owner's
 * ask), then sessions, the longest row, the average split, meters a day
 * and the rank. DAYS ROWED is gone (owner, 2026-09-05 evening) — and six
 * rows fill the two-column ledger (640-719px) evenly, where seven left the
 * rank orphaned.
 *
 * Two of the six are dropped WHOLE while masked rather than drawn as
 * blocks — the average split and meters a day. Both are the hidden total by
 * another route over something the page already prints: the split needs
 * only the time, and meters a day divides by the day count in the dateline
 * ("DAY 5 OF 30"), so a five-block per-day figure beside a five-block total
 * would cut the range the total's own blocks are allowed to admit (review,
 * 2026-09-05). One block per digit of the total and nothing sharper: the
 * longest row keeps its blocks because it is a figure of its own.
 *
 * The rank is the PLACES half of the blackout rule (blackoutRules.ts): one
 * of the hidden fifteen has no place to show — divisionRank hands back null
 * for them exactly as it does for a rower who has never rowed — so the row
 * says ELITE 15 when `elite` and keeps the dash for the rower who genuinely
 * has no standing yet. An admin's board is ranked, so they see the place.
 * The key drops its division word in that state: the fifteen are cut off
 * the COMBINED board (blackoutRules.eliteIndexes walks boards.total), so
 * "Rank · women ... ELITE 15" would claim the top fifteen of the women,
 * which is a different and stronger thing than the truth. */
export function coreLedger(view: ProfileView): LedgerItem[] {
  const t = view.totals;
  const rowed = t.sessions > 0;
  return [
    {
      key: "time",
      k: "Time rowed",
      v: rowed ? <Clock view={view} s={t.seconds} /> : "—",
    },
    { key: "sessions", k: "Sessions", v: String(t.sessions) },
    {
      key: "longest",
      k: "Longest row",
      v: rowed ? <Num view={view} n={t.longest} /> : "—",
    },
    {
      key: "split",
      k: "Average split",
      v: rowed && !view.masked && t.seconds > 0 ? `${fmtSplit(t.meters, t.seconds)} /500m` : "—",
    },
    {
      key: "perday",
      k: "Meters a day",
      v: rowed && !view.masked ? <Num view={view} n={metersPerDay(view)} /> : "—",
    },
    {
      key: "rank",
      k: view.elite
        ? "Rank"
        : view.rower.division === "F"
          ? "Rank · women"
          : "Rank · men",
      v: view.elite ? ELITE_TAG : view.rank ? `#${view.rank.place} of ${view.rank.of}` : "—",
    },
  ];
}

/* ------------------------------------------------------------- eyebrow */

/* A block heading kept to one mono line over a hairline — the owner found
 * the stats page spent too much room on titles. */
export function Eyebrow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="pf-eye">
      <span>{left}</span>
      {right ? <span className="r">{right}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------- blocks */

/* The month calendar — or, while masked, the blackout line: the shading
 * is the numbers by another name, so it goes entirely. No curve on the
 * profile: the calendar is the month (the owner picked the two looks
 * without one, 2026-09-05). */
export function MonthBlock({ view }: { view: ProfileView }) {
  if (view.masked) return <p className="pf-bo">{view.blackoutNote}</p>;
  return <Heatmap byDay={view.byDay} days={view.days} />;
}

/* The bests boards: with SHARE for the rower and admins (a client
 * component, real values), plain from the server for everyone else — and
 * for a masked rower the values are already blanked, so the server draws
 * the blocks and nothing of theirs reaches the browser. */
export function Bests({ view }: { view: ProfileView }) {
  if (!view.masked && (view.isMe || view.isAdmin)) {
    return <BestsTablesShare bests={view.bests} data={view.shareData} />;
  }
  return <BestsTables bests={view.bests} />;
}

/* The log: the rower's own editable ledger (share / fix / delete on every
 * row), or the visitor's read-only TABLE / PHOTOS view. */
export function LogBlock({ view }: { view: ProfileView }) {
  const n = view.rows.length;
  return (
    <div className="pf-log">
      <Eyebrow left="The log" right={`${n} SESSIONS`} />
      {n === 0 ? (
        <p className="board-empty">NOTHING LOGGED YET.</p>
      ) : view.isMe ? (
        <MyLog data={view.shareData} rows={view.rows} canEdit={view.log?.phase !== "closed"} />
      ) : (
        <ProfileLog rows={view.logRows} />
      )}
    </div>
  );
}
