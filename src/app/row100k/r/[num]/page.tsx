import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { clockShape, digitCount, fmtPacificDay } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  GOAL_METERS,
  LOG_CLOSE_MS,
  START_MS,
  clampDay,
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
  pacificDay,
  recordPlacements,
  type RecordBadge,
} from "@/lib/row100k";
import { barProps, maskedIds, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { boardView } from "../../boardData";
import { sanityBandForForm } from "../../sanity";
import { resolvePhotoMedia } from "../../photoUrls";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { Profile } from "./looks/Profile";
import type { ProfileBest, ProfileView } from "./looks/view";

export const dynamic = "force-dynamic";

/* One rower's public page: their stats, their September calendar, their
 * log. Reached by clicking any name on the boards. Settings live on
 * /row100k/settings and moderation on /row100k/moderation (owner call,
 * 2026-09-05) — this page is the rower's, and only the logging station
 * and the share button change with who is looking. This file computes
 * the view; looks/Profile.tsx lays it out (the owner's pick from three
 * looks, same day — the ?look= switch is gone with the other two).
 *
 * Blackout: while a window is open, THE ELITE FIFTEEN have their numbers
 * hidden from the public (blackoutRules.ts). This page hides exactly the
 * rowers the board hides — same masked set, same self/admin exemptions —
 * and draws blocks of the right shape wherever a number of theirs would
 * print — meters, times and the pace bests alike (owner rule, 2026-09-05:
 * a time over a known distance is the meters by another route); the
 * calendar, which is the numbers by another name, goes entirely. Names,
 * places, dates and the sessions count stay. */

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
    // The cards stop at today like the page calendar does.
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
  // the silhouette of the time (ProfileBest.shape, "##:##.#") and no split
  // — and the prorated note stops naming the piece, since "pace from a
  // 12,345 m row" is a row's meters by another route.
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

  // The logging station's prefills, on the rower's own page only: Pacific
  // today (the same UTC-7 shift every chart uses) clamped into September —
  // the day the rower actually rowed, not the UTC date that has already
  // rolled over by a Californian evening; validateEntry draws its future
  // line at this same day, and the picker stops here. The next session
  // number for the title. Admins can log before Sep 1 to test the pipeline
  // on their own account — the rows API waves the same people through. The
  // did-you-mean-that band never blocks, never throws (rowing-club
  // defaults when it cannot be drawn).
  const log: ProfileView["log"] = isMe
    ? {
        phase: isAdmin && phase === "before" ? "open" : phase,
        earlyAdmin: isAdmin && phase === "before",
        defaultDay: clampDay(pacificDay(now)),
        defaultTitle: `Rowtember #${entries.length + 1}`,
        sanity: await sanityBandForForm(),
      }
    : null;

  // TIME ROWED — the sum of every session (owner ask, 2026-09-05: how long
  // they have spent rowing is the figure the profile was missing).
  const totalSeconds = entries.reduce((s, e) => s + e.seconds, 0);

  // One object for the layout (looks/view.ts): everything above, computed
  // once; Profile.tsx only lays it out.
  const view: ProfileView = {
    rower: p,
    isMe,
    isAdmin,
    masked,
    blackoutNote,
    club: (masked ? floor : me.meters) >= GOAL_METERS,
    phase,
    days: daysElapsed(),
    totals: {
      meters: me.meters,
      sessions: me.sessions,
      seconds: totalSeconds,
      longest: longestM,
      daysRowed: me.days,
    },
    rank,
    bests,
    byDay,
    shareData,
    rows,
    logRows,
    log,
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      {/* The viewer is already resolved, so the bar skips its own lookup.
          No ROWER-number tag in it — the nameplate just below says whose
          page this is. */}
      <RowBar {...barProps(viewer)} />
      <Profile view={view} />
      <RowFooter />
    </div>
  );
}
