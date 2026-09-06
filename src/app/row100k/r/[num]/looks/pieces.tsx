import type { ReactNode } from "react";
import { metersText, tokensFor } from "@/components/home/digits";
import { digitCount } from "@/lib/blackoutRules";
import { fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit } from "@/lib/row100k";
import { BlockClock, Blocks } from "../../../Blackout";
import { Heatmap } from "../../../Heatmap";
import { LogInPlace } from "../../../LogInPlace";
import { ProfileLog } from "../../../ProfileLog";
import { ProfileShare } from "../../../ProfileShare";
import { BestsTables } from "./BestsTables";
import { BestsTablesShare } from "./BestsTablesShare";
import { MyLog } from "./MyLog";
import type { ProfileView } from "./view";

/* The pieces the profile (Profile.tsx) is built from — server components,
 * all of them, so the raw numbers in the view never leave the server
 * except through the client components this file mounts on purpose:
 * LogInPlace and MyLog (the rower's own page only), BestsTablesShare (a
 * profile that is not masked), ProfileLog (rows the page already blanked).
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
 * step smaller, over a hairline; the dateline in the front page's mono. */
export function Nameplate({ view }: { view: ProfileView }) {
  return (
    <div className="pf-head">
      <h1 className="pf-name">
        <span className="num">{fmtRowerNumber(view.rower.rowerNumber)}</span> {view.rower.displayName}
      </h1>
      <p className="pf-date mono">{dateline(view)}</p>
    </div>
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

/* The six figures under the big number: TIME ROWED first (the owner's
 * ask), then sessions, the longest row, the average split, days rowed and
 * the rank. The split is dropped whole while masked — with either the
 * meters or the time it is the third. Days rowed goes too: it is only a
 * count, but no public surface printed it for an elite rower before (the
 * old page hid their whole calendar), and the rule is to publish nothing
 * new on a masked profile — sessions is the one count the rules name. */
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
    { key: "days", k: "Days rowed", v: view.masked ? "—" : String(t.daysRowed) },
    {
      key: "rank",
      k: view.rower.division === "F" ? "Rank · women" : "Rank · men",
      v: view.rank ? `#${view.rank.place} of ${view.rank.of}` : "—",
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
