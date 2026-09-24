import type { Metadata, Viewport } from "next";
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
import { meterSnapshot, type MeterSnapshot } from "@/lib/homeStats";
import { previewViewOpts, readBlackoutPreview } from "@/lib/row100kViewer";
import { clampDay, pacificDay } from "@/lib/row100k";
import { sanityBandForForm } from "./sanity";
import { myWaveShare } from "./shareables/waveShare";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { frontCss } from "./frontCss";
import { RowBar } from "./RowBar";
import { RowFooter } from "./RowFooter";
import { JoinPanel } from "./JoinPanel";
import { Dashboard } from "./Dashboard";
import { Who } from "./Boards";
import { Blocks } from "./Blackout";
import { EliteList, type EliteRow } from "./EliteList";
import { LiveTogether } from "./LiveTogether";
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

/* A snapshot for the wheels when the feed itself could not be read: the
 * board total, frozen (rate 0 holds the counter still, and the first poll
 * takes over once the feed answers). */
function stillSnapshot(meters: number, now: number): MeterSnapshot {
  return {
    meters,
    rowers: 0,
    sessions: 0,
    finished: 0,
    rate: 0,
    splitMean: 0,
    splitSd: 0,
    splitN: 0,
    at: Date.now(),
    phase: now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open",
    daysLeft: 0,
    day: 0,
    ok: false,
  };
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
  // over the rows: during a blackout the rows carry floors.
  const togetherMeters = boards.community.meters;

  /* METERS TOGETHER, LIVE (owner, 2026-09-24): the first paint of the
   * landing counter — the same snapshot the root page and /api/home/meters
   * serve, for the month the clock is in. The wheels then poll the feed
   * themselves (useLiveMeters). meterSnapshot never throws, but a page
   * must not fall over a counter: the fallback is the board total, still. */
  let snapshot: MeterSnapshot;
  try {
    snapshot = await meterSnapshot();
  } catch (err) {
    console.error("row100k: failed to build the meter snapshot", err);
    snapshot = stillSnapshot(togetherMeters, nowMs);
  }

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

      {/* A joined rower: their own number first, the seven wheels, then
       * the id line. LOG A ROW moved down into the counter row; the form
       * still opens here, under the number (LogInPlace, bare). */}
      {me && (
        <section className="fs">
          <div className="wrap front">
            <Dashboard
              rowerNumber={me.rowerNumber}
              displayName={me.displayName}
              instagram={me.instagram}
              division={me.division as Division}
              meters={myMeters}
              sessions={monthRows.length}
              rows={monthRows}
              phase={earlyAdmin ? "open" : phase}
              rank={elite ? null : myRank}
              records={myRecords}
              defaultDay={defaultDay}
              defaultTitle={`${ROWTEMBER ? "Rowtember" : MONTH.label.split(" ")[0]} #${monthRows.length + 1}`}
              earlyAdmin={earlyAdmin}
              masked={elite}
              digits={elite ? digitCount(myMeters) : undefined}
              days={today}
              sanity={sanity}
              race={raceShare}
              bare
            />
          </div>
        </section>
      )}

      {/* THE COUNTER ROW (owner, 2026-09-24): meters together, ticking, a
       * link to the stats page; the latest row — meters, at this pace, by
       * this person, this long ago; and OPT IN or LOG A ROW. */}
      <section className="fs">
        <div className="wrap front">
          <div className="front-stats three big counter">
            <div className="cell fc">
              <LiveTogether snapshot={snapshot} />
            </div>
            <div className="cell fc">
              {latest && latestRow ? (
                <>
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
                    latest row{latestSplit ? ` · ${latestSplit}` : ""} · {ago(latest.createdAtMs, nowMs)}
                  </div>
                  <div className="by">
                    <span className="num">{fmtRowerNumber(latestRow.rowerNumber)} · </span>
                    <a href={`/row100k/r/${latestRow.rowerNumber}`}>{latestRow.name}</a>
                  </div>
                </>
              ) : (
                <>
                  <div className="n">—</div>
                  <div className="l mono">latest row · nobody has logged a meter yet</div>
                </>
              )}
            </div>
            <div className="cell fc">{thirdCell}</div>
          </div>
        </div>
      </section>

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

      <RowFooter />
    </div>
  );
}
