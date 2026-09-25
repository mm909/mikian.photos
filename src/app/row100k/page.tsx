import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  daysElapsed,
  divisionRank,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  isRow100kAdmin,
  nowMs as clockNow,
  recordPlacements,
  type Division,
  type RecordBadge,
  type TotalRow,
  MONTH,
} from "@/lib/row100k";
import { digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import { activeBlackout } from "@/lib/blackout";
import { previewViewOpts, readBlackoutPreview } from "@/lib/row100kViewer";
import { clampDay, pacificDay } from "@/lib/row100k";
import { sanityBandForForm } from "./sanity";
import { myWaveShare } from "./shareables/waveShare";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { frontCss } from "./frontCss";
import { RowBar } from "./RowBar";
import { RowFooter } from "./RowFooter";
import { JoinPanel } from "./JoinPanel";
import { Dashboard, Wheels } from "./Dashboard";
import { LogInPlace } from "./LogInPlace";
import { Who } from "./Boards";
import { Blocks } from "./Blackout";
import { EliteList, type EliteRow } from "./EliteList";
import { LogCell } from "./LogCell";
import { OptIn } from "./OptIn";
import {
  EMPTY_BOARDS,
  EMPTY_FRONT,
  boardView,
  frontExtras,
  type FrontExtras,
} from "./boardData";

/* The nameplate is Rowtember in September and the month itself any other
 * time (owner, 2026-09-24), and the metadata says the same. */
const ROWTEMBER = MONTH.month === 9;
const PAGE_TITLE = ROWTEMBER ? `Rowtember ${MONTH.year}` : MONTH.label;
const PAGE_BLURB = `Every meter rowed in ${MONTH.label}, counted live.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_BLURB,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_BLURB,
    images: [{ url: "/row100k/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_BLURB,
    images: ["/row100k/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-driven top block + live numbers — never render statically.
export const dynamic = "force-dynamic";

/* "12 MIN AGO" — for the latest-row cell. Server-rendered against nowMs(),
 * so there is nothing to hydrate. */
function ago(thenMs: number, now: number): string {
  const s = Math.max(0, Math.floor((now - thenMs) / 1000));
  if (s < 60) return "JUST NOW";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} MIN AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "HOUR" : "HOURS"} AGO`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "DAY" : "DAYS"} AGO`;
}

/* A rower's meters, or blocks when the blackout hides them. Every number
 * printed for someone who might be in the elite goes through here. */
function Meters({ r }: { r: Pick<TotalRow, "meters" | "masked" | "digits"> }) {
  return r.masked ? (
    <>
      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
    </>
  ) : (
    <>{fmtMeters(r.meters)}</>
  );
}

/* How deep each division board runs on the front page. Five since
 * 2026-09-06 (owner: "let us show top five"), the same depth the stats page
 * podiums use. */
const FRONT_TOP = 5;

/* The leaders of one division, as a compact board — as many rows as it is
 * handed, which is FRONT_TOP. Names go to the profile except for a masked
 * row (the profile still prints the real total — same rule as Boards.tsx). */
function TopRows({ label, rows }: { label: string; rows: TotalRow[] }) {
  return (
    <div className="front-three">
      <h3 className="mono">{label}</h3>
      {rows.length === 0 ? (
        <p className="board-empty">NOBODY ON THIS BOARD YET.</p>
      ) : (
        <table className="board">
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.participantId}>
                <td className="rk">{i + 1}</td>
                <td>
                  <Who row={{ name: r.name, rowerNumber: r.rowerNumber }} />
                </td>
                <td className="num">
                  <Meters r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* Meters per day and the longest row off the rower's month — what the
 * share cards want beyond the totals (share/cards.ts). Computed here, on
 * the server, because the form that carries the cards (LogInPlace) is
 * mounted by this page under the counter row since 2026-09-25. */
function shareSummary(rows: { day: string; meters: number }[]): { byDay: Record<string, number>; longest: number } {
  const byDay: Record<string, number> = {};
  let longest = 0;
  for (const r of rows) {
    byDay[r.day] = (byDay[r.day] ?? 0) + r.meters;
    if (r.meters > longest) longest = r.meters;
  }
  return { byDay, longest };
}

/* "1,234" hours on the erg, everyone together — the visitor's first cell
 * (owner, 2026-09-25: "HOURS where meters-together was"). Tenths while the
 * month is young, whole hours once there are a hundred of them. */
function fmtHours(seconds: number): string {
  const h = seconds / 3600;
  return h >= 100 ? Math.round(h).toLocaleString("en-US") : (Math.round(h * 10) / 10).toLocaleString("en-US");
}

export default async function Row100kPage() {
  const actor = await getEffectiveActor();
  const isAdmin = actor ? isRow100kAdmin(actor.email, actor.roles) : false;

  let me: {
    id: string;
    rowerNumber: number;
    displayName: string;
    instagram: string;
    division: string;
  } | null = null;
  let myRows: { id: string; day: string; meters: number; seconds: number }[] = [];
  try {
    if (actor) {
      me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: {
          id: true,
          rowerNumber: true,
          displayName: true,
          instagram: true,
          division: true,
        },
      });
      if (me) {
        myRows = await db.rowEntry.findMany({
          where: { participantId: me.id },
          select: { id: true, day: true, meters: true, seconds: true },
          orderBy: [{ day: "desc" }, { createdAt: "desc" }],
        });
      }
    }
  } catch (err) {
    console.error("row100k: failed to load viewer data", err);
  }

  // Fail open: if the tables aren't reachable the page still renders.
  // The board comes through boardView, which needs to know who is looking:
  // during a blackout the elite are hidden from everyone but admins
  // and the rower themself (blackoutRules.ts), so this waits for `me`. The
  // window's end comes back with it, for the one date this page prints
  // ("HIDDEN UNTIL SEP 27"); whether the elite are hidden at all is read
  // off the board's own rows (`unranked`), never off the window, so an
  // admin — whose board is never masked — sees the ordinary page.
  // The admin's test blackout (row100kViewer): while it is on, the admin
  // stops being an admin for the mask, and under "public" stops being
  // themself as well, so the page is the one everybody else is getting.
  const preview = readBlackoutPreview(isAdmin);
  let boards = EMPTY_BOARDS;
  let blackoutEndsAt: string | undefined;
  try {
    const view = await boardView(previewViewOpts(preview, me?.id ?? null, isAdmin));
    boards = view.boards;
    blackoutEndsAt = view.blackout.endsAt;
  } catch (err) {
    console.error("row100k: failed to load board data", err);
  }

  // Whether the signed-in rower is one of the hidden elite right now, off
  // the PUBLIC board — the viewer board above exempts self, so it cannot
  // say. Their own share cards must draw blocks even though the page shows
  // them their number (blackoutRules.ts: the total is not shareable). Fails
  // closed while a window is open and the board cannot be read.
  let elite = false;
  if (me) {
    try {
      const blackout = await activeBlackout();
      if (blackout.active || preview) {
        const pub = (await boardView(preview ? { forceBlackout: true } : {})).boards;
        elite = pub.total.find((r) => r.participantId === me.id)?.masked === true;
      }
    } catch (err) {
      console.error("row100k: failed to read the public board for elite status", err);
      elite = true;
    }
  }

  // The did-you-mean-that band for the in-place log form (sanity.ts) —
  // never throws, falls back to the club defaults.
  const sanity = me ? await sanityBandForForm() : undefined;

  // MY WAVE for the share dialog (owner, 2026-09-16): the race block with
  // the signed-in rower's own told wave on it, or nothing. Fails open.
  const raceShare = me ? await myWaveShare(me.id) : undefined;

  // The latest row — the newspaper's extras. Cached alongside the board; a
  // miss just blanks the cell.
  let extras: FrontExtras = EMPTY_FRONT;
  try {
    extras = await frontExtras();
  } catch (err) {
    console.error("row100k: failed to load front-page extras", err);
  }

  // The viewer's own stats come from their fresh rows, not the cached board,
  // so a just-logged session shows up immediately after router.refresh().
  // THIS MONTH's rows only (owner, 2026-09-24: the MY number under the
  // month was the all-time total; it must be the month's — the page is one
  // month, and so is every other number on it). The all-time list is still
  // what the query returned; nothing else on this page reads it.
  const monthRows = myRows.filter((r) => r.day >= FIRST_DAY && r.day <= LAST_DAY);
  const myMeters = monthRows.reduce((s, r) => s + r.meters, 0);

  const nowMs = clockNow();
  const phase: "before" | "open" | "closed" =
    nowMs < START_MS ? "before" : nowMs >= LOG_CLOSE_MS ? "closed" : "open";
  const today = daysElapsed(nowMs);

  // The together numbers come from the board's own sums, never a reduce
  // over the rows: during a blackout the rows carry floors. Static, from
  // this render (owner, 2026-09-25: "revert the meters-together number to
  // a static number, not counting up"); the live odometer and its feed
  // (/api/home/meters) are the root landing's, not this page's.
  const togetherMeters = boards.community.meters;
  const togetherSeconds = boards.community.seconds;

  // The PLACES half of the blackout rule (blackoutRules.ts): while a window
  // is open the elite come back unranked, and a page may not order
  // them at all. So this page stops printing two podiums — it prints THE
  // ELITE as a list, in the order the board already put them (digit count,
  // then name). Rows sixteen and down keep their real places, on the board
  // page. Admins and any board with no window open carry no `unranked` row,
  // so nothing below changes for them.
  const hidden = boards.total.some((r) => r.unranked);
  const eliteRows: EliteRow[] = hidden
    ? boards.total
        .filter((r) => r.unranked)
        .map((r) => ({
          name: r.name,
          rowerNumber: r.rowerNumber,
          division: r.division,
          masked: r.masked,
          // A masked row carries the real total's digit count; the viewer's
          // own row is exempt from the mask, so its meters are the truth and
          // their length is the count.
          digits: r.digits ?? digitCount(r.meters),
          // Their average split — the tag in front of the name, and the order
          // the list is in (owner, 2026-09-05).
          paceTag: r.paceTag,
          // The number itself only on a row the mask spared: the viewer's.
          meters: r.masked ? undefined : r.meters,
        }))
    : [];
  const eliteUntil = blackoutEndsAt ? fmtPacificDay(blackoutEndsAt) : "";

  // Empty while the elite are hidden — the podiums are not rendered then,
  // and an empty list is one less way for an order to leak.
  const onBoard = hidden ? [] : boards.total.filter((r) => r.meters > 0 || r.masked);
  const topMen = onBoard.filter((r) => r.division === "M").slice(0, FRONT_TOP);
  const topWomen = onBoard.filter((r) => r.division === "F").slice(0, FRONT_TOP);

  // The latest row: the board row tells us the name and whether the rower
  // is blacked out; the row's own meters (and its split) are printed only
  // when they are not — a split is a ratio of two hidden numbers, but a
  // masked rower gives nothing away here at all.
  const latest = extras.latest;
  const latestRow = latest
    ? (boards.total.find((r) => r.participantId === latest.participantId) ?? null)
    : null;
  const latestSplit =
    latest && latestRow && !latestRow.masked && latest.seconds > 0 && latest.meters > 0
      ? `${fmtSplit(latest.meters, latest.seconds)} /500M`
      : null;

  // Standing + record placements for the signed-in rower's share cards —
  // best-effort off the cached board (fails to undefined, cards just hide).
  // To #10, so the profile card can headline any top-ten stat.
  //
  // The dashboard prints no place of its own: `rank` below rides straight
  // into the share payload, and it is handed over as `elite ? null : myRank`
  // so a card of one of the hidden elite carries no "#N" (the PLACES half
  // of the rule, review 2026-09-05). It has to be blanked at the prop and
  // not here, because `myRank` is read off the VIEWER board, which is ranked
  // for an admin — without it an admin in the elite would repost blocks
  // with a real "#1" beside them.
  let myRank: { place: number; of: number } | null | undefined;
  let myRecords: RecordBadge[] | undefined;
  try {
    if (me) {
      myRank = divisionRank(boards, me.id);
      myRecords = recordPlacements(boards, me.id, 10);
    }
  } catch (err) {
    console.error("row100k: failed to compute placements", err);
  }

  // Prefills for the in-place log form — the same ones the profile computes:
  // Pacific today clamped into the month (the day the rower actually rowed,
  // not the UTC date that has rolled over by a Californian evening) and the
  // next session number. Admins may log before the 1st.
  const defaultDay = clampDay(pacificDay(nowMs));
  const earlyAdmin = isAdmin && phase === "before";

  /* THE THIRD CELL (owner, 2026-09-24: "the rowers-this-month cell becomes
   * the OPT IN button", "opt in becomes log a row" once signed in). Three
   * states, one place:
   *   a stranger — the landing OPT IN, which signs in with Google and lands
   *     back on #join; the cell IS #join, so the account menu lands here too;
   *   signed in, not on the board — OPT IN as a link down to the join form
   *     (#join, under the top fives), the flow JoinPanel always had;
   *   a joined rower — LOG A ROW, which opens the form in place (LogCell). */
  const thirdCell = me ? (
    <LogCell />
  ) : phase === "closed" ? (
    <p className="nothing">{MONTH.label.toUpperCase()} IS WRAPPED</p>
  ) : actor ? (
    <div className="go">
      <OptIn href="#join">Opt in</OptIn>
    </div>
  ) : (
    <div className="go" id="join">
      <JoinPanel mode="signedOut" />
    </div>
  );

  /* THE LOG FORM (LogInPlace, bare): nothing on the page until LOG A ROW
   * is tapped; the share dialog it carries pops on the fresh row once one
   * is saved. Built once here, above the page. No SHARE word anywhere
   * (owner). */
  const logForm = me ? (
    <LogInPlace
      share={{
        displayName: me.displayName,
        rowerNumber: me.rowerNumber,
        instagram: me.instagram,
        meters: myMeters,
        sessions: monthRows.length,
        ...shareSummary(monthRows),
        division: me.division as Division,
        rank: elite ? null : myRank,
        records: myRecords,
        days: today,
        masked: elite,
        digits: elite ? digitCount(myMeters) : undefined,
        race: raceShare,
      }}
      defaultDay={defaultDay}
      defaultTitle={`${ROWTEMBER ? "Rowtember" : MONTH.label.split(" ")[0]} #${monthRows.length + 1}`}
      phase={earlyAdmin ? "open" : phase}
      earlyAdmin={earlyAdmin}
      sanity={sanity}
      bare
    />
  ) : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{frontCss}</style>

      <RowBar active="home" signedIn={!!actor} rowerNumber={me?.rowerNumber ?? null} admin={isAdmin} />

      {/* The nameplate: ROWTEMBER in September, like a newspaper (owner
       * call, 2026-09-05); any other month the month itself, alone — no
       * date, no day count (owner, 2026-09-24: "the subtitle is just the
       * month: December 2026"). */}
      {ROWTEMBER ? (
        <header className="front-head">
          <div className="wrap front">
            <h1>
              Rowtember <span className="yr">{MONTH.year}</span>
            </h1>
          </div>
        </header>
      ) : (
        <header className="front-head off">
          <div className="wrap front">
            <p className="front-kicker mono">{MONTH.label}</p>
          </div>
        </header>
      )}

      {/* THE BIG NUMBER. A joined rower: their own month on seven wheels,
       * one line under it saying whose (Dashboard, bare). Anyone else:
       * everyone together on the landing's eight wheels, static (owner,
       * 2026-09-25: "the big number is the month's total meters, like
       * mikianmusser.com's counter head, dimmed leading wheels are fine but
       * static"); tapping it opens the stats page. */}
      <section className="fs">
        <div className="wrap front">
          {me ? (
            <Dashboard
              rowerNumber={me.rowerNumber}
              displayName={me.displayName}
              instagram={me.instagram}
              division={me.division as Division}
              meters={myMeters}
              sessions={monthRows.length}
              rows={monthRows}
              phase={earlyAdmin ? "open" : phase}
              bare
            />
          ) : (
            <div className="mine eight">
              <Wheels meters={togetherMeters} digits={8} href="/row100k/stats" label="the stats page" />
              <p className="my-unit mono">
                Meters · <b>everyone together</b>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* THE COUNTER ROW (owner, 2026-09-24, reviewed 2026-09-25): a rower
       * gets METERS TOGETHER, a visitor HOURS (their meters together are the
       * big number already) — static ink, a link to the stats page; the
       * latest row — by this person, the meters in bold, then at this pace
       * this long ago (owner, 2026-09-25: "put the bib number and the
       * rower's name ABOVE the meters, and the pace and how-long-ago BELOW
       * it; the meters stay bold"), with no callout; and OPT IN or LOG A
       * ROW. Every cell is a left-justified block, sat in the middle of its
       * box on desktop (frontCss.ts). On a phone the last cell comes first,
       * straight under the number. */}
      <section className="fs">
        <div className="wrap front">
          <div className="front-stats three big counter">
            <div className="cell fc tog">
              <div className="n">
                <Link href="/row100k/stats">{me ? fmtMeters(togetherMeters) : fmtHours(togetherSeconds)}</Link>
              </div>
              <div className="l mono">{me ? "meters together" : "hours together"}</div>
            </div>
            <div className="cell fc latest">
              {latest && latestRow ? (
                <>
                  <div className="by">
                    <span className="num">{fmtRowerNumber(latestRow.rowerNumber)} · </span>
                    <a href={`/row100k/r/${latestRow.rowerNumber}`}>{latestRow.name}</a>
                  </div>
                  <div className="n">
                    {latestRow.masked ? (
                      <>
                        <Blocks digits={digitCount(latest.meters)} /> m
                      </>
                    ) : (
                      fmtMeters(latest.meters)
                    )}
                  </div>
                  <div className="l mono">
                    {latestSplit ? `${latestSplit} · ` : ""}
                    {ago(latest.createdAtMs, nowMs)}
                  </div>
                </>
              ) : (
                <>
                  <div className="n">—</div>
                  <div className="l mono">nobody has logged a meter yet</div>
                </>
              )}
            </div>
            <div className="cell fc cta">{thirdCell}</div>
          </div>
        </div>
      </section>

      {/* THE LOG FORM, under the cells bar (owner, 2026-09-25: "when I
       * click LOG A ROW the form opens ABOVE the button; it should open
       * BELOW the cells bar, on desktop and mobile"). Nothing on the page
       * until LOG A ROW is tapped; the share dialog it carries pops on the
       * fresh row once one is saved. No SHARE word anywhere (owner). */}
      {logForm && <div className="wrap front front-form">{logForm}</div>}

      <section className="fs">
        <div className="wrap front">
          {hidden ? (
            /* One list across the measure instead of two podiums: no places,
             * no divisions split, no order but digits-then-name. */
            <div className="front-elite" id="elite">
              <EliteList
                rows={eliteRows}
                until={eliteUntil || undefined}
                meRowerNumber={me?.rowerNumber ?? null}
              />
            </div>
          ) : (
            <div className="front-top">
              <TopRows label="Men" rows={topMen} />
              <TopRows label="Women" rows={topWomen} />
            </div>
          )}
        </div>
      </section>

      {/* The join form, for a signed-in visitor who is not on the board
       * yet: OPT IN in the counter row links here, and the sign-in callback
       * and the account menu land on #join. A stranger has no form yet —
       * their #join is the OPT IN cell itself. */}
      {actor && !me && phase !== "closed" ? (
        <section id="join" className="fs front-cta">
          <div className="wrap front">
            {/* No 2px box around the form — the owner found that chrome
               hard on the log form and this one sits on the same page. */}
            <div className="panel flat">
              <JoinPanel
                mode="form"
                signedInAs={actor.email}
                initialName={actor.name}
                initialInstagram=""
                initialDivision={null}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* On the front measure, like everything above it (RowFooter.tsx). */}
      <RowFooter front />
    </div>
  );
}
