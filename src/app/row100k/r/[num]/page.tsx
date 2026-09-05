import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { clockShape, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  FIRST_DAY,
  GOAL_METERS,
  LAST_DAY,
  LOG_CLOSE_MS,
  START_MS,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRecordTime,
  fmtRowerNumber,
  fmtSplit,
  nowMs as clockNow,
  recordPlacements,
  type RecordBadge,
} from "@/lib/row100k";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { boardView } from "../../boardData";
import { BlockClock, Blocks } from "../../Blackout";
import { Curve } from "../../Curve";
import { Heatmap } from "../../Heatmap";
import { BestsGrid, type Best } from "../../BestsGrid";
import { LogPanel } from "../../LogPanel";
import { sanityBandForForm } from "../../sanity";
import { ProfileLog } from "../../ProfileLog";
import { ProfileShare } from "../../ProfileShare";
import { resolvePhotoMedia } from "../../photoUrls";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";

export const dynamic = "force-dynamic";

/* One rower's public page: their stats, their September calendar, their
 * curve, their log. Reached by clicking any name on the boards. Settings
 * live on /row100k/settings and moderation on /row100k/moderation (owner
 * call, 2026-09-05) — this page is the rower's, and only the logging
 * station and the share button change with who is looking.
 *
 * Blackout: while a window is open, THE ELITE FIFTEEN have their numbers
 * hidden from the public (blackoutRules.ts). This page hides exactly the
 * rowers the board hides — same masked set, same self/admin exemptions —
 * and draws blocks of the right shape wherever a number of theirs would
 * print — meters, times and the pace bests alike (owner rule, 2026-09-05:
 * a time over a known distance is the meters by another route); the
 * calendar and the curve, which are the numbers by another name, go
 * entirely. Names, places, dates and the sessions count stay. */

const getRower = cache(async (num: number) => {
  const participant = await db.rowParticipant.findUnique({
    where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: num } },
    select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true },
  });
  if (!participant) return null;
  const entries = await db.rowEntry.findMany({
    where: { participantId: participant.id },
    select: {
      id: true,
      participantId: true,
      day: true,
      meters: true,
      seconds: true,
      title: true,
      photos: true,
    },
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

  // Who is looking. Their own page carries the logging station; admins see
  // the real numbers everywhere but otherwise get the visitor's page plus
  // the share button — their tools moved to /row100k/moderation.
  const viewer = await resolveViewer();
  const isAdmin = viewer.isAdmin;
  const isMe = viewer.myParticipantId === p.id;

  const b = computeBoards([p], entries);
  const me = b.total[0];
  const byDay: Record<string, number> = {};
  for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;
  const pct = Math.min(100, me.pct);
  const longestM = b.longest[0]?.value ?? 0;

  // Is THIS rower hidden from THIS viewer? Read off the board as the viewer
  // sees it (boardView → maskedIds): the fifteen the board masks, minus
  // self and admins. If the board cannot be read while a window is open the
  // page fails CLOSED for a stranger — it cannot know whether the rower is
  // elite, so it assumes so rather than leak.
  //
  // Standing + record placements come off the same board — cosmetic for
  // the share cards and the rank chips on the bests, so a board failure
  // just leaves them undefined. Placements go to #10: the profile share
  // card headlines the best one, and the bests below wear top-10 chips.
  const blackout = await activeBlackout();
  let masked = blackout.active && !isMe && !isAdmin;
  // The tier floor the board prints for a masked row: the 100K CLUB tag
  // follows it, since the board already files the row under its tier.
  let floor = me.meters;
  let rank: { place: number; of: number } | null | undefined;
  let records: RecordBadge[] | undefined;
  try {
    const { boards: full } = await boardView(viewOpts(viewer));
    rank = divisionRank(full, p.id);
    records = recordPlacements(full, p.id, 10);
    if (masked) {
      masked = maskedIds(full).has(p.id);
      floor = full.total.find((r) => r.participantId === p.id)?.meters ?? 0;
    }
  } catch (err) {
    console.error(`row100k: failed to load board data for placements (rower ${num})`, err);
    if (masked) {
      floor = 0;
      // Every stranger's profile masks in this state, rank 40 included —
      // said out loud at warn level so a mass-mask reads as a board outage
      // in the logs, not as a blackout that swallowed the whole roster.
      console.warn(`row100k: board unreadable during a blackout window — rower ${num} masked whole`);
    }
  }
  const digits = digitCount(me.meters);

  // Elite status for the SHARE payload comes off the PUBLIC board, not the
  // viewer's: the page may show a rower their own number, but a card leaves
  // the site, so an elite rower's own dialog (and an admin's repost card)
  // must draw blocks too. Fails closed while a window is open and the board
  // cannot be read.
  let elite = false;
  if (blackout.active) {
    try {
      const { boards: pub } = await boardView({});
      elite = maskedIds(pub).has(p.id);
    } catch {
      elite = true;
    }
  }
  const hiddenUntil = blackout.endsAt ? ` UNTIL ${fmtPacificDay(blackout.endsAt).toUpperCase()}` : "";
  const blackoutNote = `BLACKOUT — HIDDEN${hiddenUntil}`;

  // Everything the share cards draw. `masked`/`digits` ride along so a card
  // of a hidden rower draws blocks (share/cards.ts); a masked page never
  // mounts a share surface, and the placement values — real meters off the
  // record boards — are blanked so they cannot ride into a client prop.
  const shareData = {
    displayName: p.displayName,
    rowerNumber: p.rowerNumber,
    instagram: p.instagram,
    meters: me.meters,
    sessions: me.sessions,
    byDay,
    division: p.division,
    longest: longestM,
    rank,
    records: masked ? records?.map((r) => ({ ...r, value: "" })) : records,
    // The cards stop at today like the page charts do.
    days: daysElapsed(),
    masked: elite,
    digits: elite ? digits : undefined,
  };

  const now = clockNow();
  const phase: "before" | "open" | "closed" =
    now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open";

  // Each best knows its record-board key so it can wear the rower's division
  // ranking (top 10 only — that's as deep as `records` goes) as a chip, and
  // links to that record's leaderboard filtered to the same division so the
  // board you land on matches the chip.
  const divQ = p.division === "F" ? "f" : p.division === "M" ? "m" : "all";
  const boardHref = (board: string) => `/row100k/records/${board}?d=${divQ}`;
  const placeOf = (key: string) => records?.find((r) => r.key === key)?.place ?? null;
  // A masked profile's bests carry no value string at all: the two meters
  // bests keep only a digit count for the blocks, the two pace bests only
  // the silhouette of the time (Best.shape, "##:##.#") and no split — and
  // the prorated note stops naming the piece, since "pace from a 12,345 m
  // row" is a row's meters by another route.
  type ProfileBest = Best & { digits?: number };
  const metersBest = (
    key: string,
    label: string,
    r: { value: number; day: string } | undefined,
  ): ProfileBest => ({
    key,
    label,
    value: r ? (masked ? "" : fmtMeters(r.value)) : "—",
    sub: r ? fmtDay(r.day) : "not yet rowed",
    href: boardHref(key),
    place: placeOf(key),
    digits: r && masked ? digitCount(r.value) : undefined,
  });
  const bests: ProfileBest[] = [
    ...([5000, 10000] as const).map((d): ProfileBest => {
      const r = b.fastest[d][0];
      return {
        key: `fastest${d}`,
        label: `Fastest ${d / 1000}k`,
        value: r ? (masked ? "" : fmtRecordTime(r.value)) : "—",
        shape: r && masked ? clockShape(r.value, true) : undefined,
        sub: r
          ? r.prorated && r.meters
            ? `${fmtDay(r.day)} · pace from a ${masked ? "longer" : fmtMeters(r.meters)} row`
            : masked
              ? fmtDay(r.day)
              : `${fmtDay(r.day)} · ${fmtSplit(d, r.value)} /500m`
          : "not yet rowed",
        href: boardHref(String(d)),
        place: placeOf(`fastest${d}`),
      };
    }),
    metersBest("longest", "Longest row", b.longest[0]),
    metersBest("bigday", "Biggest day", b.bigDay[0]),
  ];

  // The log shows each row's photo pair — for everyone (the photos are the
  // honor system), and as the "current" pair in the owner's editor. One
  // media resolve per entry serves both consumers: the editable ledger gets
  // {full, thumb} pairs (64px squares render the thumb, the lightbox the
  // full) plus the plain full-URL list its Current strip wants, and the
  // read-only ProfileLog gets the same pairs — thumb on the card, full in
  // the lightbox, where it used to pull every full frame at once.
  const photoMediaLists = await Promise.all(entries.map((e) => resolvePhotoMedia(e.photos)));
  const rows = entries
    .map((e, i) => ({
      ...e,
      photos: photoMediaLists[i],
      photoUrls: photoMediaLists[i].map((m) => m.full),
    }))
    .reverse();
  // The visitor's rows are display strings only — and for a masked rower
  // there is NO meters, time or split string, just the digit count and the
  // time's silhouette, so the blocks are the width the numbers would have
  // been and nothing of theirs reaches the browser.
  const logRows = rows.map((r) => ({
    id: r.id,
    dayStr: fmtDay(r.day),
    title: r.title,
    metersStr: masked ? "" : fmtMeters(r.meters),
    durationStr: masked ? "" : fmtDuration(r.seconds),
    splitStr: masked ? "" : fmtSplit(r.meters, r.seconds),
    photos: r.photos,
    masked,
    digits: masked ? digitCount(r.meters) : undefined,
    timeShape: masked ? clockShape(r.seconds) : undefined,
  }));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>

      {/* No ROWER-number tag here — with the account chip on the right it
          crowded the bar on phones; the big number just below says whose
          page this is. The viewer is already resolved, so the bar skips
          its own lookup. */}
      <RowBar {...barProps(viewer)} />

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
              {/* Card-making stays for the rower and for admins (the repost
                  case: a card with their name and number on it). */}
              {(isMe || isAdmin) && <ProfileShare data={shareData} />}
            </div>
            <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--gray)" }}>
              {p.division === "F" ? "WOMEN'S BOARD" : "MEN'S BOARD"}
              {(masked ? floor : me.meters) >= GOAL_METERS ? " · 100K CLUB" : ""}
            </span>
          </div>

          <div className="me-stats">
            <div className="me-stat">
              <div className="n">{masked ? <Blocks digits={digits} /> : me.meters.toLocaleString("en-US")}</div>
              <div className="l">meters</div>
            </div>
            <div className="me-stat">
              <div className="n">{me.sessions}</div>
              <div className="l">sessions</div>
            </div>
            <div className="me-stat">
              <div className="n">
                {masked ? <Blocks digits={digitCount(longestM)} /> : longestM.toLocaleString("en-US")}
              </div>
              <div className="l">longest row</div>
            </div>
          </div>
          {masked ? (
            /* No bar at all: its fill width and the TO GO remainder each
               hand the number back, and a bar drawn without either would be
               a new look the owner never asked for. The label row stays so
               the blocks sit where everyone else's meters line does; the
               blackout note prints once, down in The month. */
            <div className="me-bar-label">
              <span>
                <Blocks digits={digits} /> M
              </span>
            </div>
          ) : (
            <>
              <div className="me-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="me-bar-label">
                <span>{fmtMeters(me.meters)}</span>
                <span>
                  {me.meters >= GOAL_METERS ? "100K — DONE" : `${fmtMeters(GOAL_METERS - me.meters)} TO GO`}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The bests</h2>
            <span className="mono">PERSONAL — THIS SEPTEMBER</span>
          </div>
          {masked ? (
            /* The same cards BestsGrid draws, rendered here on the server
               with blocks where the meters and the times would be: the grid
               takes value strings, and the real numbers must not reach the
               browser. No SHARE — a visitor never has it anyway. No inline
               column style either: .records.vol is already two-up and drops
               to one column on phones (an inline style would pin two-up). */
            <div className="records vol">
              {bests.map((r) => (
                <a className="rec" href={r.href} key={r.key}>
                  <div className="t">
                    {r.label}
                    {r.place ? (
                      <span className={`dtag${r.place <= 3 ? ` m${r.place}` : ""}`}>#{r.place}</span>
                    ) : null}
                  </div>
                  <div className="v">
                    {r.shape ? (
                      <BlockClock shape={r.shape} />
                    ) : r.digits ? (
                      <Blocks digits={r.digits} />
                    ) : (
                      r.value
                    )}
                  </div>
                  <div className="meta">{r.sub}</div>
                </a>
              ))}
            </div>
          ) : (
            <BestsGrid bests={bests} data={shareData} canShare={isMe || isAdmin} />
          )}
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The month</h2>
            <span className="mono">METERS PER DAY</span>
          </div>
          {masked ? (
            /* The calendar's shading and the curve are the numbers by
               another name — skipped whole rather than drawn blank. */
            <p className="prof-bo">{blackoutNote}</p>
          ) : (
            <>
              <Heatmap byDay={byDay} days={daysElapsed()} />
              <div style={{ marginTop: 10 }}>
                <Curve
                  daily={b.daily}
                  title="Their curve — vs the finish-on-time line"
                  goal={GOAL_METERS}
                  days={daysElapsed()}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Your own page carries the logging station: the form sits just above
          the log, and every row in the log can be shared, fixed or deleted. */}
      {isMe ? (
        <LogPanel
          data={shareData}
          rows={rows}
          /* Pacific today (the same UTC-7 shift every chart uses), clamped
             into September: the day the rower actually rowed, not the UTC
             date that has already rolled over by a Californian evening.
             validateEntry draws its future line at this same day, and the
             picker stops here. */
          defaultDay={((d) => (d < FIRST_DAY ? FIRST_DAY : d > LAST_DAY ? LAST_DAY : d))(
            new Date(now - 7 * 3_600_000).toISOString().slice(0, 10),
          )}
          defaultTitle={`Rowtember #${entries.length + 1}`}
          /* Admins can log before Sep 1 to test the pipeline on their own
             account — the rows API waves the same people through. */
          phase={isAdmin && phase === "before" ? "open" : phase}
          earlyAdmin={isAdmin && phase === "before"}
          /* The did-you-mean-that band for the form (never blocks, never
             throws — falls back to the rowing-club defaults). */
          sanity={await sanityBandForForm()}
        />
      ) : (
        /* Everyone else — admins included: their tools live on
           /row100k/moderation now, so on someone else's page an admin reads
           the same log a visitor does (and keeps the share button above). */
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>The log</h2>
              <span className="mono">{rows.length} SESSIONS</span>
            </div>
            {rows.length === 0 ? (
              <p className="board-empty">NOTHING LOGGED YET.</p>
            ) : (
              /* Two views: the clean numbers table (untouched, owner call)
                 and a photos view with the pair each session posted. */
              <ProfileLog rows={logRows} />
            )}
          </div>
        </section>
      )}

      <RowFooter />
    </div>
  );
}
