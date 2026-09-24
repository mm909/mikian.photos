import { PeriodSelect } from "../../../PeriodSelect";
import type { ReactNode } from "react";
import { metersText, tokensFor } from "@/components/home/digits";
import { digitCount } from "@/lib/blackoutRules";
import {
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
} from "@/lib/row100k";
import { BlockClock, Blocks } from "../../../Blackout";
import { Heatmap } from "../../../Heatmap";
import { LogInPlace } from "../../../LogInPlace";
import { ProfileLog } from "../../../ProfileLog";
import { ProfileShare } from "../../../ProfileShare";
import { BestsTables } from "./BestsTables";
import { BestsTablesShare } from "./BestsTablesShare";
import { MyLog } from "./MyLog";
import { RowerSearch } from "./RowerSearch";
import { ShareWord } from "./ShareWord";
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

/* THE MONTH AS A WORD THAT IS A MENU — the dateline under the name, and
 * ONLY there (owner, 2026-09-25: "the date selection only at the top:
 * remove the month menus on THE BESTS and THE MONTH eyebrows", which had
 * carried the same word since the day before). A month picked here is the
 * same page with ?m= set (PeriodSelect.tsx). With only one month to
 * choose from — the first month, before the next one has begun — the word
 * is plain text, since a menu of one line is a menu of nothing. */
export function MonthWord({ view }: { view: ProfileView }) {
  const many = view.periodOptions.length > 2;
  return many ? (
    <PeriodSelect options={view.periodOptions} value={view.period.key} base={`/row100k/r/${view.rower.rowerNumber}`} current={view.thisMonthKey} />
  ) : (
    <>{periodText(view)}</>
  );
}

/* The month as plain text — "December 2026", or "All time" (the eyebrow
 * sets it in caps) — for the eyebrows that name it without offering a
 * menu (Profile.tsx). */
export function periodText(view: ProfileView): string {
  return view.period.label;
}

/* "DECEMBER 2026 ....... SHARE" — the dateline under the name. THE MONTH
 * IS THE CONTROL (owner, 2026-09-24: no MEN'S BOARD, the month there
 * instead, as text you can click to swap months). Just the month (owner,
 * same day: no 100K CLUB, no FINAL, no day) — and, since 2026-09-25, SHARE
 * at the far right of the same line (owner: "move the SHARE button onto
 * the same line as the DECEMBER 2026 date selection (right side); best on
 * mobile"), in the quiet mono face it already wore beside LOG A ROW. The
 * rower's own SHARE asks LogInPlace for its dialog (ShareWord.tsx); an
 * admin on somebody else's page gets ProfileShare, which carries its own,
 * in the same face. A visitor gets the month alone. */
function Dateline({ view }: { view: ProfileView }) {
  const share = view.isMe && view.log ? <ShareWord /> : view.isAdmin ? <ProfileShare data={view.shareData} quiet /> : null;
  return (
    <>
      <span>
        <MonthWord view={view} />
      </span>
      {share}
    </>
  );
}

/* The nameplate: number and name in the front page's masthead face, one
 * step smaller, over a hairline; the dateline in the front page's mono.
 *
 * The NAME is also the way off this page (owner ask, 2026-09-06: tap the
 * name and search for someone) — so the head itself is RowerSearch, a
 * client component: number and name together are the control (owner,
 * 2026-09-25: the bib number gets the same hover and click as the name;
 * no rule under it, no caret) and drop the search panel under the
 * dateline. The dateline is still computed and rendered here, on the
 * server, and handed in. */
export function Nameplate({ view }: { view: ProfileView }) {
  return (
    <RowerSearch
      rowerNumber={view.rower.rowerNumber}
      displayName={view.rower.displayName}
      roster={view.roster}
    >
      <p className="pf-date mono">
        <Dateline view={view} />
      </p>
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

/* LOG A ROW on the rower's own page — the front page's LogInPlace, so the
 * form opens under the word instead of standing open (owner call,
 * 2026-09-05), the share dialog pops on the single-row card once a row
 * lands, and #log / row100k:log still open the seam. The word is a toggle
 * that turns its arrow down while the form is open and scrolls itself
 * under the bar as it opens (owner, 2026-09-25 — see LogInPlace.tsx). It
 * stands ALONE since the same day: SHARE moved up onto the dateline
 * (Dateline above), so `noShare` drops the act row's own word. An admin on
 * someone else's page has their SHARE on the dateline too, so there is
 * nothing here for them, and nothing for a visitor. */
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
          noShare
        />
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

/* The three figures under the big number: TIME ROWED first (the owner's
 * ask, 2026-09-05), then sessions, then the average split. Three, down
 * from six (owner, 2026-09-25: "remove METERS A DAY, RANK and LONGEST
 * ROW; keep TIME ROWED, SESSIONS, AVERAGE SPLIT") — the longest row is on
 * THE BESTS already, the rank is the board's, and meters a day was a
 * ratio of two things the page prints. DAYS ROWED went earlier (owner,
 * 2026-09-05 evening).
 *
 * The split is dropped WHOLE while masked rather than drawn as blocks: it
 * is the hidden total by another route over the time the page already
 * prints, so blocks for it would cut the range the total's own blocks are
 * allowed to admit (review, 2026-09-05). One block per digit of the total
 * and nothing sharper. The view still carries `longest`, `rank` and
 * `elite` for the share cards and the dog tag; the ledger simply no longer
 * prints them. */
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
      key: "split",
      k: "Average split",
      v: rowed && !view.masked && t.seconds > 0 ? `${fmtSplit(t.meters, t.seconds)} /500m` : "—",
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
  return <Heatmap byDay={view.byDay} days={view.days} month={view.month ?? undefined} />;
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

/* The log: ONE TABLE either way (owner, 2026-09-24: "Combine the ledger
 * and the table on the profile: one log, keep the table view, show the
 * photos on the table") — the rower's own with share / edit / delete on
 * every row (MyLog), or the visitor's read-only one (ProfileLog). Both
 * carry the photo pair under the day, the distance chips and the sort. */
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
