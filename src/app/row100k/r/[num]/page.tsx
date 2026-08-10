import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  GOAL_METERS,
  computeBoards,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  type Division,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { Curve } from "../../Curve";
import { EditProfile } from "../../EditProfile";
import { Heatmap } from "../../Heatmap";

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
    select: { id: true, participantId: true, day: true, meters: true, seconds: true },
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

  // Settings render only on your own page.
  let isMe = false;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      const mine = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
      isMe = mine?.id === p.id;
    }
  } catch {
    /* cosmetic — the join API re-authenticates every save anyway */
  }

  const b = computeBoards([p], entries);
  const me = b.total[0];
  const byDay: Record<string, number> = {};
  for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;
  const pct = Math.min(100, me.pct);

  const bests: { label: string; value: string; sub: string }[] = [
    ...([1000, 5000, 10000] as const).map((d) => {
      const r = b.fastest[d][0];
      return {
        label: `Fastest ${d / 1000}k`,
        value: r ? fmtRecordTime(r.value) : "—",
        sub: r ? `${fmtDay(r.day)} · ${fmtSplit(d, r.value)} /500m` : "not yet rowed",
      };
    }),
    {
      label: "Longest row",
      value: b.longest[0] ? fmtMeters(b.longest[0].value) : "—",
      sub: b.longest[0] ? fmtDay(b.longest[0].day) : "not yet rowed",
    },
  ];

  const rows = entries.slice().reverse();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="bar">
        <a className="mono back-link" href="/row100k">
          ← 100K SEPTEMBER
        </a>
        <span className="mono tag">ROWER {fmtRowerNumber(p.rowerNumber)}</span>
      </div>

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

          <div className="me-stats four">
            <div className="me-stat">
              <div className="n">{me.meters.toLocaleString("en-US")}</div>
              <div className="l">meters</div>
            </div>
            <div className="me-stat">
              <div className="n">{me.sessions}</div>
              <div className="l">sessions</div>
            </div>
            <div className="me-stat">
              <div className="n">{me.days}</div>
              <div className="l">days rowed</div>
            </div>
            <div className="me-stat">
              <div className="n">{(b.bigDay[0]?.value ?? 0).toLocaleString("en-US")}</div>
              <div className="l">biggest day</div>
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
            {bests.map((r) => (
              <div className="rec" key={r.label}>
                <div className="t">{r.label}</div>
                <div className="v">{r.value}</div>
                <div className="meta">{r.sub}</div>
              </div>
            ))}
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
                      <td>{fmtDay(r.day)}</td>
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
