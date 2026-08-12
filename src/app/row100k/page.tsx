import type { Metadata, Viewport } from "next";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  END_MS,
  LOG_CLOSE_MS,
  START_MS,
  fmtMeters,
  fmtRowerNumber,
  nowMs as clockNow,
  type Division,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { BarAccount } from "./BarAccount";
import { Countdown } from "./Countdown";
import { JoinPanel } from "./JoinPanel";
import { Dashboard } from "./Dashboard";
import { Boards } from "./Boards";
import { boardData, EMPTY_BOARDS } from "./boardData";

export const metadata: Metadata = {
  title: "100K September — the rowing challenge",
  description:
    "One month. 100,000 meters. Sign in, claim your rower number, log every session, climb the board. Open to everyone.",
  openGraph: {
    title: "100K September — the rowing challenge",
    description: "One month. Row 100,000 meters. Get on the board.",
    images: [{ url: "/row100k/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "100K September — the rowing challenge",
    description: "One month. Row 100,000 meters. Get on the board.",
    images: ["/row100k/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-driven panel + live board — never render statically.
export const dynamic = "force-dynamic";

/* One photo. Replace the file (same name) to swap it; null hides the frame. */
const PHOTOS: { hero: string | null; mid: string | null } = {
  hero: "/row100k/hero.jpg",
  mid: null,
};

export default async function Row100kPage() {
  const actor = await getEffectiveActor();

  // Fail open: if the tables aren't reachable the poster still renders.
  let boards = EMPTY_BOARDS;
  try {
    boards = await boardData();
  } catch (err) {
    console.error("row100k: failed to load board data", err);
  }

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

  // The viewer's own stats come from their fresh rows, not the cached board,
  // so a just-logged session shows up immediately after router.refresh().
  const myMeters = myRows.reduce((s, r) => s + r.meters, 0);

  const nowMs = clockNow();
  const phase: "before" | "open" | "closed" =
    nowMs < START_MS ? "before" : nowMs >= LOG_CLOSE_MS ? "closed" : "open";
  const started = nowMs >= START_MS;

  const leader = boards.total.find((r) => r.meters > 0);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="bar">
        <span className="mono tag">ROW100K</span>
        <BarAccount signedIn={!!actor} rowerNumber={me?.rowerNumber ?? null} />
      </div>

      <header className="hero">
        <div className="wrap" style={{ padding: 0 }}>
          <h1>
            <span className="o">100k</span>
            <br />
            September.
          </h1>
          <p className="sub">
            One month. Row 100,000 meters. Every session counts — log it, climb
            the board.
          </p>
          <div className="mark-row">
            <span className="cc-mark">Rowtember 2026</span>
          </div>
        </div>
      </header>

      <div className="facts">
        <div className="in">
          <div className="cell">
            <div className="k mono">Window</div>
            <div className="v">Sep 1–30</div>
          </div>
          <div className="cell">
            <div className="k mono">The goal</div>
            <div className="v">100,000 m</div>
          </div>
          <div className="cell">
            <div className="k mono">Current leader</div>
            {leader ? (
              <div className="v blue">
                {fmtMeters(leader.meters)}
                <small>
                  {fmtRowerNumber(leader.rowerNumber)} · {leader.name}
                  {leader.instagram ? ` · @${leader.instagram}` : ""}
                </small>
              </div>
            ) : (
              <div className="v">
                Open
                <small>nobody&rsquo;s logged a meter yet</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {PHOTOS.hero && (
        <div className="frame">
          <div className="ph">
            <img
              src={PHOTOS.hero}
              alt="Runner passing a cream and teal brick mural"
              width={1400}
              height={1750}
            />
          </div>
        </div>
      )}

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The clock</h2>
            <span className="mono">
              {phase === "before" ? "FIRST STROKE — SEP 1" : "SEP 1 → SEP 30"}
            </span>
          </div>
          <Countdown />
        </div>
      </section>

      {!me && (
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The deal</h2>
            <span className="mono">THREE MOVES</span>
          </div>
          <div className="step">
            <div className="d">01</div>
            <div>
              <h3>Claim your number</h3>
              <p>
                Sign in with Google, put a name and your @ on the board.
              </p>
            </div>
          </div>
          <div className="step">
            <div className="d">02</div>
            <div>
              <h3>Row</h3>
              <p>Show up. Row. Repeat. Can you make it to 100k?</p>
            </div>
          </div>
          <div className="step">
            <div className="d">03</div>
            <div>
              <h3>Log it</h3>
              <p>Meters and time. 1k / 5k / 10k pieces count for the record boards.</p>
            </div>
          </div>
        </div>
      </section>
      )}

      {PHOTOS.mid && (
        <div className="inter">
          <div className="ph">
            <img src={PHOTOS.mid} alt="Rowing" width={1100} height={1375} loading="lazy" />
          </div>
        </div>
      )}

      <section id="join">
        <div className="wrap">
          <div className="sec-head">
            <h2>{me ? "Your September" : "Get on the board"}</h2>
            <span className="mono">
              {me
                ? `ROWER ${fmtRowerNumber(me.rowerNumber)} · ${fmtMeters(myMeters)} LOGGED`
                : phase === "closed"
                  ? "SEPTEMBER 2026 — WRAPPED"
                  : actor
                    ? "ALMOST IN — PICK YOUR NAME"
                    : "TAKES 30 SECONDS"}
            </span>
          </div>
          <div className="panel">
            {me ? (
              <Dashboard
                rowerNumber={me.rowerNumber}
                displayName={me.displayName}
                instagram={me.instagram}
                division={me.division as Division}
                meters={myMeters}
                sessions={myRows.length}
                rows={myRows}
                phase={phase}
              />
            ) : phase === "closed" ? (
              <p className="board-empty">
                THE CHALLENGE IS WRAPPED — THE BOARD BELOW IS FINAL. SEE YOU
                NEXT TIME.
              </p>
            ) : actor ? (
              <JoinPanel
                mode="form"
                signedInAs={actor.email}
                initialName={actor.name}
                initialInstagram=""
                initialDivision={null}
              />
            ) : (
              <JoinPanel mode="signedOut" />
            )}
          </div>
        </div>
      </section>

      <section id="board">
        <div className="wrap">
          <div className="sec-head">
            <h2>The board</h2>
            <span className="mono">
              {nowMs >= LOG_CLOSE_MS
                ? "FINAL"
                : nowMs >= END_MS
                  ? "CLOSING — LATE LOGS THROUGH OCT 3"
                  : "LIVE — UPDATES AS ROWS LAND"}
            </span>
          </div>
          <Boards boards={boards} started={started} />
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <div className="big">100K SEPTEMBER — 2026</div>
          <p className="mono">
            Questions →{" "}
            <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
              @mikian_
            </a>
            {" "}·{" "}
            <a href="/">mikianmusser.com</a>
          </p>
          <p className="mono" style={{ marginTop: 18 }}>
            for yourself and others
          </p>
        </div>
      </footer>
    </div>
  );
}
