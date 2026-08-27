import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  FIRST_DAY,
  GOAL_METERS,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  computeBoards,
  divisionRank,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs as clockNow,
  recordPlacements,
  type Division,
  type RecordBadge,
} from "@/lib/row100k";
import { isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { boardData } from "../../boardData";
import { Curve } from "../../Curve";
import { EditProfile } from "../../EditProfile";
import { Heatmap } from "../../Heatmap";
import { AdminShare } from "../../AdminShare";
import { LogPanel } from "../../LogPanel";
import { RemoveRower } from "../../RemoveRower";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";

export const dynamic = "force-dynamic";

/* One rower's public page: their stats, their September calendar, their
 * curve, their log. Reached by clicking any name on the boards. */

const getRower = cache(async (num: number) => {
  const participant = await db.rowParticipant.findUnique({
    where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: num } },
    select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
  });
  if (!participant) return null;
  const entries = await db.rowEntry.findMany({
    where: { participantId: participant.id },
    select: { id: true, participantId: true, day: true, meters: true, seconds: true, title: true },
    orderBy: [{ day: "asc" }, { createdAt: "asc" }],
  });
  return { participant, entries };
});

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

export async function generateMetadata({ params }: { params: { num: string } }): Promise<Metadata> {
  const num = parseNum(params.num);
  const data = num ? await getRower(num).catch(() => null) : null;
  const title = data
    ? `Rower ${fmtRowerNumber(data.participant.rowerNumber)} · ${data.participant.displayName} — 100K September`
    : "Rower — 100K September";
  return { title };
}

export default async function RowerProfilePage({ params }: { params: { num: string } }) {
  const num = parseNum(params.num);
  if (!num) notFound();
  const data = await getRower(num).catch(() => null);
  if (!data) notFound();
  const { participant: p, entries } = data;

  // Settings render only on your own page; moderation only for admins.
  let isMe = false;
  let isAdmin = false;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      isAdmin = isRow100kAdmin(actor.email, actor.roles);
      const mine = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
      isMe = mine?.id === p.id;
    }
  } catch {
    /* cosmetic — the APIs re-authenticate every write anyway */
  }

  const b = computeBoards([p], entries);
  const me = b.total[0];
  const byDay: Record<string, number> = {};
  for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;
  const pct = Math.min(100, me.pct);

  // Standing + record placements come off the full cached board — cosmetic
  // for the share cards and the rank chips on the bests, so a board failure
  // just leaves them undefined. Placements go to #10: the profile share card
  // headlines the best one, and the bests below wear top-10 chips.
  let rank: { place: number; of: number } | null | undefined;
  let records: RecordBadge[] | undefined;
  try {
    const full = await boardData();
    rank = divisionRank(full, p.id);
    records = recordPlacements(full, p.id, 10);
  } catch (err) {
    console.error("row100k: failed to load board data for placements", err);
  }

  const shareData = {
    displayName: p.displayName,
    rowerNumber: p.rowerNumber,
    instagram: p.instagram,
    meters: me.meters,
    sessions: me.sessions,
    byDay,
    division: p.division,
    longest: b.longest[0]?.value ?? 0,
    rank,
    records,
  };

  const now = clockNow();
  const phase: "before" | "open" | "closed" =
    now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open";
  const todayUTC = new Date(now).toISOString().slice(0, 10);
  const defaultDay = todayUTC < FIRST_DAY ? FIRST_DAY : todayUTC > LAST_DAY ? LAST_DAY : todayUTC;

  // Each best knows its record-board key so it can wear the rower's division
  // ranking (top 10 only — that's as deep as `records` goes) as a chip.
  const bests: { key: string; label: string; value: string; sub: string }[] = [
    ...([5000, 10000] as const).map((d) => {
      const r = b.fastest[d][0];
      return {
        key: `fastest${d}`,
        label: `Fastest ${d / 1000}k`,
        value: r ? fmtRecordTime(r.value) : "—",
        sub: r
          ? r.prorated && r.meters
            ? `${fmtDay(r.day)} · pace from a ${fmtMeters(r.meters)} row`
            : `${fmtDay(r.day)} · ${fmtSplit(d, r.value)} /500m`
          : "not yet rowed",
      };
    }),
    {
      key: "longest",
      label: "Longest row",
      value: b.longest[0] ? fmtMeters(b.longest[0].value) : "—",
      sub: b.longest[0] ? fmtDay(b.longest[0].day) : "not yet rowed",
    },
    {
      key: "bigday",
      label: "Biggest day",
      value: b.bigDay[0] ? fmtMeters(b.bigDay[0].value) : "—",
      sub: b.bigDay[0] ? fmtDay(b.bigDay[0].day) : "not yet rowed",
    },
  ];
  const placeOf = (key: string) => records?.find((r) => r.key === key)?.place;

  const rows = entries.slice().reverse();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <RowBar>
        <span className="mono tag">ROWER {fmtRowerNumber(p.rowerNumber)}</span>
      </RowBar>

      <section>
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="prof-name">
                <span style={{ color: "var(--gray)" }}>{fmtRowerNumber(p.rowerNumber)}</span>{" "}
                {p.displayName}
              </div>
              <p style={{ marginTop: 8 }}>
                <a
                  className="prof-ig"
                  href={`https://instagram.com/${p.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{p.instagram}
                </a>
              </p>
            </div>
            <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--gray)" }}>
              {p.division === "F" ? "WOMEN'S BOARD" : "MEN'S BOARD"}
              {me.meters >= GOAL_METERS ? " · 100K CLUB" : ""}
            </span>
          </div>

          <div className="me-stats">
            <div className="me-stat">
              <div className="n">{me.meters.toLocaleString("en-US")}</div>
              <div className="l">meters</div>
            </div>
            <div className="me-stat">
              <div className="n">{me.sessions}</div>
              <div className="l">sessions</div>
            </div>
            <div className="me-stat">
              <div className="n">{(b.longest[0]?.value ?? 0).toLocaleString("en-US")}</div>
              <div className="l">longest row</div>
            </div>
          </div>
          <div className="me-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="me-bar-label">
            <span>{fmtMeters(me.meters)}</span>
            <span>
              {me.meters >= GOAL_METERS ? "100K — DONE" : `${fmtMeters(GOAL_METERS - me.meters)} TO GO`}
            </span>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The bests</h2>
            <span className="mono">PERSONAL — THIS SEPTEMBER</span>
          </div>
          <div className="records vol" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {bests.map((r) => {
              const place = placeOf(r.key);
              return (
                <div className="rec" key={r.key}>
                  <div className="t">
                    {r.label}
                    {place ? <span className="dtag">#{place}</span> : null}
                  </div>
                  <div className="v">{r.value}</div>
                  <div className="meta">{r.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
            <span className="mono">METERS PER DAY</span>
          </div>
          <Heatmap byDay={byDay} />
          <div style={{ marginTop: 10 }}>
            <Curve daily={b.daily} title="Their curve — vs the finish-on-time line" goal={GOAL_METERS} />
          </div>
        </div>
      </section>

      {/* Your own page carries the logging station: the form sits just above
          the log, and every row in the log can be shared, fixed or deleted. */}
      {isMe ? (
        <LogPanel
          data={shareData}
          rows={rows}
          defaultDay={defaultDay}
          /* Admins can log before Sep 1 to test the pipeline on their own
             account — the rows API waves the same people through. */
          phase={isAdmin && phase === "before" ? "open" : phase}
          earlyAdmin={isAdmin && phase === "before"}
        />
      ) : isAdmin ? (
        <AdminShare data={shareData} rows={rows} />
      ) : (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>The log</h2>
              <span className="mono">{rows.length} SESSIONS</span>
            </div>
            {rows.length === 0 ? (
              <p className="board-empty">NOTHING LOGGED YET.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="board">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th style={{ textAlign: "right" }}>Meters</th>
                      <th style={{ textAlign: "right" }}>Time</th>
                      <th style={{ textAlign: "right" }}>/500m</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {fmtDay(r.day)}
                          {r.title ? (
                            <div
                              className="mono"
                              style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}
                            >
                              {r.title}
                            </div>
                          ) : null}
                        </td>
                        <td className="num">{fmtMeters(r.meters)}</td>
                        <td className="num">{fmtDuration(r.seconds)}</td>
                        <td className="num" style={{ color: "var(--gray)" }}>
                          {fmtSplit(r.meters, r.seconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {isMe && (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>Settings</h2>
            </div>
            <EditProfile
              name={p.displayName}
              instagram={p.instagram}
              division={p.division as Division}
            />
          </div>
        </section>
      )}

      {isAdmin && (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>Moderation</h2>
              <span className="mono">ADMIN ONLY — YOU CAN SEE THIS, THEY CAN&rsquo;T</span>
            </div>
            <RemoveRower participantId={p.id} name={p.displayName} />
          </div>
        </section>
      )}

      <RowFooter>
        <p className="mono">
          <a href="/row100k">← Back to the board</a>
        </p>
      </RowFooter>
    </div>
  );
}
