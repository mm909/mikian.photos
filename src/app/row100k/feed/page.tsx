import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  CHALLENGE,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";

export const metadata: Metadata = {
  title: "The feed — 100K September",
  description: "Every logged row, with its photo — newest first.",
};

export const dynamic = "force-dynamic";

/* The Strava half of the idea: every row is a post. Newest first, one column,
 * photo up front, the numbers underneath. Rows logged before the photo
 * requirement (and seeded demo rows) get a poster-styled placeholder — the
 * meters still count, they just don't have receipts. */

const FEED_SIZE = 60;

/* Deterministic placeholder tint per entry so the demo feed doesn't read as
 * one endless navy block. */
function tint(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hues = ["#1c2b33", "#14323f", "#0f3a52", "#243139", "#123647"];
  return hues[h % hues.length];
}

export default async function FeedPage() {
  let entries: {
    id: string;
    day: string;
    meters: number;
    seconds: number;
    photoKey: string;
    createdAt: Date;
    participant: { displayName: string; rowerNumber: number; instagram: string };
  }[] = [];
  try {
    entries = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      orderBy: { createdAt: "desc" },
      take: FEED_SIZE,
      select: {
        id: true,
        day: true,
        meters: true,
        seconds: true,
        photoKey: true,
        createdAt: true,
        participant: { select: { displayName: true, rowerNumber: true, instagram: true } },
      },
    });
  } catch (err) {
    console.error("row100k/feed: failed to load entries", err);
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="bar">
        <a className="mono back-link" href="/row100k">
          ← 100K SEPTEMBER
        </a>
        <span className="mono tag">THE FEED</span>
      </div>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The feed</h2>
            <span className="mono">EVERY ROW HAS RECEIPTS — NEWEST FIRST</span>
          </div>

          {entries.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET — THE FIRST ROW STARTS THE FEED.</p>
          ) : (
            <div className="feed">
              {entries.map((e) => {
                const photoId = e.photoKey.match(/^row100k\/rows\/([a-f0-9-]{36})\.jpg$/)?.[1];
                return (
                  <article className="feed-card" key={e.id}>
                    <header>
                      <a className="who" href={`/row100k/r/${e.participant.rowerNumber}`}>
                        <span className="fnum">{fmtRowerNumber(e.participant.rowerNumber)}</span>{" "}
                        {e.participant.displayName}
                      </a>
                      <span className="fday mono">{fmtDay(e.day)}</span>
                    </header>
                    <div className="ph">
                      {photoId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/row100k/photo/${photoId}`}
                          alt={`${e.participant.displayName}'s row — ${fmtMeters(e.meters)}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className="feed-ph" style={{ background: tint(e.id) }}>
                          <span className="mono">NO PHOTO — LOGGED BEFORE RECEIPTS</span>
                        </div>
                      )}
                    </div>
                    <footer>
                      <div className="stat">
                        <div className="n">{e.meters.toLocaleString("en-US")}</div>
                        <div className="l">meters</div>
                      </div>
                      <div className="stat">
                        <div className="n">{fmtDuration(e.seconds)}</div>
                        <div className="l">time</div>
                      </div>
                      <div className="stat">
                        <div className="n">{fmtSplit(e.meters, e.seconds)}</div>
                        <div className="l">/500m</div>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <div className="big">100K SEPTEMBER — 2026</div>
          <p className="mono">
            <a href="/row100k">← Back to the board</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
