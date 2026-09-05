import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  END_MS,
  FIRST_DAY,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  daysElapsed,
  divisionRank,
  fmtMeters,
  fmtRowerNumber,
  isRow100kAdmin,
  nowMs as clockNow,
  recordPlacements,
  type Division,
  type RecordBadge,
  type TotalRow,
} from "@/lib/row100k";
import { digitCount } from "@/lib/blackoutRules";
import { activeBlackout } from "@/lib/blackout";
import { clampDay, pacificDay } from "@/lib/row100k";
import { sanityBandForForm } from "./sanity";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { RowBar } from "./RowBar";
import { RowFooter } from "./RowFooter";
import { Countdown } from "./Countdown";
import { JoinPanel } from "./JoinPanel";
import { Dashboard } from "./Dashboard";
import { Who } from "./Boards";
import { Blocks } from "./Blackout";
import {
  EMPTY_BOARDS,
  EMPTY_FRONT,
  boardView,
  frontExtras,
  leaderStreak,
  type FrontExtras,
} from "./boardData";

export const metadata: Metadata = {
  title: "Rowtember 2026",
  description: "Every meter rowed this September, counted live.",
  openGraph: {
    title: "Rowtember 2026",
    description: "Every meter rowed this September, counted live.",
    images: [{ url: "/row100k/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rowtember 2026",
    description: "Every meter rowed this September, counted live.",
    images: ["/row100k/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-driven top block + live numbers — never render statically.
export const dynamic = "force-dynamic";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/* "12 MIN AGO" — for the latest-row line. Server-rendered against nowMs(),
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
 * printed for someone who might be in the elite fifteen goes through here. */
function Meters({ r }: { r: Pick<TotalRow, "meters" | "masked" | "digits"> }) {
  return r.masked ? (
    <>
      <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
    </>
  ) : (
    <>{fmtMeters(r.meters)}</>
  );
}

/* The top three of one division, as a compact board. Names go to the
 * profile except for a masked row (the profile still prints the real
 * total — same rule as Boards.tsx). */
function TopThree({ label, rows }: { label: string; rows: TotalRow[] }) {
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
  // during a blackout the top fifteen are hidden from everyone but admins
  // and the rower themself (blackoutRules.ts), so this waits for `me`. The
  // front page prints only rows (leader, top three, latest), never the
  // table, so the window itself is not needed here — /row100k/board has it.
  let boards = EMPTY_BOARDS;
  try {
    boards = (await boardView({ viewerParticipantId: me?.id, admin: isAdmin })).boards;
  } catch (err) {
    console.error("row100k: failed to load board data", err);
  }

  // Whether the signed-in rower is one of the hidden fifteen right now, off
  // the PUBLIC board — the viewer board above exempts self, so it cannot
  // say. Their own share cards must draw blocks even though the page shows
  // them their number (blackoutRules.ts: the total is not shareable). Fails
  // closed while a window is open and the board cannot be read.
  let elite = false;
  if (me) {
    try {
      const blackout = await activeBlackout();
      if (blackout.active) {
        const pub = (await boardView({})).boards;
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

  // Time rowed, the latest row, the day-by-day leader — the newspaper's
  // extras. Cached alongside the board; a miss just blanks those lines.
  let extras: FrontExtras = EMPTY_FRONT;
  try {
    extras = await frontExtras();
  } catch (err) {
    console.error("row100k: failed to load front-page extras", err);
  }

  // The viewer's own stats come from their fresh rows, not the cached board,
  // so a just-logged session shows up immediately after router.refresh().
  const myMeters = myRows.reduce((s, r) => s + r.meters, 0);

  const nowMs = clockNow();
  const phase: "before" | "open" | "closed" =
    nowMs < START_MS ? "before" : nowMs >= LOG_CLOSE_MS ? "closed" : "open";
  const today = daysElapsed(nowMs);

  // The dateline: today in the rowers' day (Pacific, the UTC-7 shift every
  // chart uses) and where the month stands.
  const west = new Date(nowMs - 7 * 3_600_000);
  const stamp = `${MONTHS[west.getUTCMonth()]} ${west.getUTCDate()}`;
  const dateline =
    phase === "before"
      ? `${stamp} · FIRST STROKE SEP 1`
      : phase === "closed"
        ? `${stamp} · FINAL`
        : nowMs >= END_MS
          ? `${stamp} · LATE LOGS THROUGH OCT 3`
          : `${stamp} · DAY ${today} OF 30`;

  // A masked leader carries a tier floor (0 under 10k), so the mask itself
  // has to count as "has meters" or the headline would name the wrong rower.
  const leader = boards.total.find((r) => r.meters > 0 || r.masked);
  const streak = leader ? leaderStreak(extras, leader.participantId, today) : 0;

  // The together numbers come from the board's own sums, never a reduce
  // over the rows: during a blackout the rows carry floors.
  const togetherMeters = boards.community.meters;
  const hoursText = (extras.seconds / 3600).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const onBoard = boards.total.filter((r) => r.meters > 0 || r.masked);
  const topMen = onBoard.filter((r) => r.division === "M").slice(0, 3);
  const topWomen = onBoard.filter((r) => r.division === "F").slice(0, 3);

  // The latest row: the board row tells us the name and whether the rower
  // is blacked out; the row's own meters are printed only when they are not.
  const latestRow = extras.latest
    ? (boards.total.find((r) => r.participantId === extras.latest?.participantId) ?? null)
    : null;

  // Standing + record placements for the signed-in rower's share cards —
  // best-effort off the cached board (fails to undefined, cards just hide).
  // To #10, so the profile card can headline any top-ten stat.
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
  // Pacific today clamped into September (the day the rower actually rowed,
  // not the UTC date that has rolled over by a Californian evening) and the
  // next session number. Admins may log before Sep 1.
  const defaultDay = clampDay(pacificDay(nowMs));
  const earlyAdmin = isAdmin && phase === "before";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar active="home" signedIn={!!actor} rowerNumber={me?.rowerNumber ?? null} admin={isAdmin} />

      {/* The nameplate. Just the title, like a newspaper (owner call,
       * 2026-09-05) — the pitch that used to sit here is in pitch.ts. */}
      <header className="front-head">
        <div className="wrap front">
          <h1>
            Rowtember <span className="yr">2026</span>
          </h1>
          <p className="front-date mono">{dateline}</p>
        </div>
      </header>

      {me && (
        <section className="fs">
          <div className="wrap front">
            <Dashboard
              rowerNumber={me.rowerNumber}
              displayName={me.displayName}
              instagram={me.instagram}
              division={me.division as Division}
              meters={myMeters}
              sessions={myRows.length}
              rows={myRows}
              phase={earlyAdmin ? "open" : phase}
              rank={myRank}
              records={myRecords}
              defaultDay={defaultDay}
              defaultTitle={`Rowtember #${myRows.length + 1}`}
              earlyAdmin={earlyAdmin}
              masked={elite}
              digits={elite ? digitCount(myMeters) : undefined}
              days={today}
              sanity={sanity}
            />
          </div>
        </section>
      )}

      {/* Everyone together: bold number over a lighter descriptor. */}
      <section className="fs">
        <div className="wrap front">
          <div className="front-stats">
            <div className="cell">
              <div className="n">{togetherMeters.toLocaleString("en-US")}</div>
              <div className="l mono">meters together</div>
            </div>
            <div className="cell">
              <div className="n">{hoursText} h</div>
              <div className="l mono">time rowed · everyone, every session</div>
            </div>
          </div>
        </div>
      </section>

      {/* The first headline, and the clock in the corner beside it. */}
      <section className="fs">
        <div className="wrap front">
          <div className="front-duo">
            <div className="front-box">
              <div className="eyebrow mono">The leader</div>
              {leader ? (
                <>
                  <div className="head mono">
                    {streak <= 1 ? "NEW LEADER" : `IN THE LEAD FOR ${streak} DAYS`}
                  </div>
                  <div className="v">
                    <Meters r={leader} />
                  </div>
                  <div className="nm">
                    <Who row={{ name: leader.name, rowerNumber: leader.rowerNumber }} />
                  </div>
                </>
              ) : (
                <div className="head mono">
                  {phase === "before" ? "FIRST STROKE SEP 1" : "NOBODY HAS LOGGED A METER YET"}
                </div>
              )}
            </div>
            <div className="front-box clock">
              <div className="eyebrow mono">The clock</div>
              <Countdown size="small" />
            </div>
          </div>
        </div>
      </section>

      <section className="fs">
        <div className="wrap front">
          <div className="front-top">
            <TopThree label="Men" rows={topMen} />
            <TopThree label="Women" rows={topWomen} />
          </div>
        </div>
      </section>

      {latestRow && extras.latest && (
        <section className="fs">
          <div className="wrap front">
            <p className="front-latest mono">
              LATEST ROW — {fmtRowerNumber(latestRow.rowerNumber)} · <b>{latestRow.name}</b> ·{" "}
              <b>
                {latestRow.masked ? (
                  <>
                    <Blocks digits={digitCount(extras.latest.meters)} /> m
                  </>
                ) : (
                  fmtMeters(extras.latest.meters)
                )}
              </b>{" "}
              · {ago(extras.latest.createdAtMs, nowMs)}
            </p>
          </div>
        </section>
      )}

      {/* The call to action comes after the news. Sign-in callbacks and the
       * account menu land on #join, so the anchor stays. */}
      {!me && (
        <section id="join" className="fs front-cta">
          <div className="wrap front">
            {phase === "closed" ? (
              <p className="board-empty">ROWTEMBER 2026 IS WRAPPED — THE BOARD IS FINAL.</p>
            ) : actor ? (
              /* No 2px box around the form — the owner found that chrome
                 hard on the log form and this one sits on the same page. */
              <div className="panel flat">
                <JoinPanel
                  mode="form"
                  signedInAs={actor.email}
                  initialName={actor.name}
                  initialInstagram=""
                  initialDivision={null}
                />
              </div>
            ) : (
              <JoinPanel mode="signedOut" />
            )}
          </div>
        </section>
      )}

      <RowFooter />
    </div>
  );
}
