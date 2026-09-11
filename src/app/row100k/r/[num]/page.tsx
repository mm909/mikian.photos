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
  fmtPaceTag,
  fmtSplit,
  nowMs as clockNow,
  pacificDay,
  recordPlacements,
  type RecordBadge,
} from "@/lib/row100k";
import { barProps, maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { boardView } from "../../boardData";
import { sanityBandForForm } from "../../sanity";
import { resolvePhotoMedia } from "../../photoUrls";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { DogTag } from "./looks/DogTag";
import { fieldEntries } from "../../fieldData";
import { buildDistanceKdes } from "../../stats/distances";
import { buildField } from "../../stats/field";
import type { PacePoint } from "./looks/PaceCurve";
import { Profile } from "./looks/Profile";
import type { ProfileBest, ProfileView, RosterRower } from "./looks/view";

export const dynamic = "force-dynamic";

/* One rower's public page: their stats, their September calendar, their
 * log. Reached by clicking any name on the boards. Settings live on
 * /row100k/settings and moderation on /row100k/moderation (owner call,
 * 2026-09-05) — this page is the rower's, and only the logging station
 * and the share button change with who is looking. This file computes
 * the view; looks/Profile.tsx lays it out (the owner's pick from three
 * looks, same day — the ?look= switch is gone with the other two).
 *
 * Blackout: while a window is open, THE ELITE — the top ten men and the
 * top ten women (blackoutRules.ts) — have their numbers hidden from the
 * public. This page hides exactly the rowers the board hides — same masked
 * set, same self/admin exemptions — and draws blocks of the right shape
 * wherever a number of theirs would print — meters, times and the pace
 * bests alike (owner rule, 2026-09-05: a time over a known distance is the
 * meters by another route); the calendar, which is the numbers by another
 * name, goes entirely. Names, dates and the sessions count stay. Their
 * PLACE does not (owner, same evening): the elite carry none while hidden,
 * themself included, so the ledger says ELITE (ELITE_TAG) where the rank
 * would be and no card draws a #. */

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

/* The roster the nameplate search reads (looks/RowerSearch.tsx): every
 * rower in the challenge by number and name. A hundred rows of three
 * public fields, read here on the server and passed down — no API route,
 * no client fetch.
 *
 * The select is the whole guard, so keep it exactly this wide: names,
 * numbers and boards are always public (blackoutRules.ts), and the list
 * goes to a client component, so one meters or seconds field added here
 * would publish a figure for all hundred rowers, the hidden elite
 * included. It is NOT read off boardData: that cached object carries every
 * number on the board, and the roster must never be a reason to widen it.
 * cache() here is React's per-request dedupe and nothing more — a second
 * call inside one render is free, and every request still reads the live
 * roster, which is what a page that is already force-dynamic wants. */
const getRoster = cache(async (): Promise<RosterRower[]> =>
  db.rowParticipant.findMany({
    where: { challenge: CHALLENGE },
    select: { rowerNumber: true, displayName: true, division: true },
    orderBy: { rowerNumber: "asc" },
  }),
);

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

  // The roster for the nameplate search, and who is looking. Together, not
  // one after the other: the roster is only read for a panel most visitors
  // never open, so it must not add a round trip to the time this page takes
  // to answer (review, 2026-09-06). A roster failure costs the search and
  // nothing else — the name stays a control, the panel says the roster
  // could not be read.
  //
  // The viewer decides the page: their own carries the logging station;
  // admins see the real numbers everywhere but otherwise get the visitor's
  // page plus the share button — their tools moved to /row100k/moderation.
  const [roster, viewer] = await Promise.all([
    getRoster().catch((err) => {
      console.error(`row100k: failed to load the roster for the name search (rower ${num})`, err);
      return [] as RosterRower[];
    }),
    resolveViewer(),
  ]);
  const isAdmin = viewer.isAdmin;
  const isMe = viewer.myParticipantId === p.id;

  const b = computeBoards([p], entries);
  const me = b.total[0];
  const byDay: Record<string, number> = {};
  for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;
  const longestM = b.longest[0]?.value ?? 0;

  // Is THIS rower hidden from THIS viewer? Read off the board as the viewer
  // sees it (boardView → maskedIds): the elite the board masks, minus
  // self and admins. If the board cannot be read while a window is open the
  // page fails CLOSED for a stranger — it cannot know whether the rower is
  // elite, so it assumes so rather than leak.
  //
  // Standing + record placements come off the same board — cosmetic for
  // the share cards and the rank chips on the bests, so a board failure
  // just leaves them undefined. Placements go to #10: the profile share
  // card headlines the best one, and the bests below wear top-10 chips.
  // The admin's test blackout reaches here too (owner, 2026-09-08: under
  // IN THE ELITE another elite rower's profile still showed the total):
  // the window is open for this request, the admin exemption is off, and
  // under OUTSIDE IT the admin is not themself either.
  const blackout = previewBlackout(viewer, await activeBlackout());
  const maskAdmin = isAdmin && !viewer.preview;
  const maskMe = isMe && viewer.preview !== "public";
  let masked = blackout.active && !maskMe && !maskAdmin;
  // The tier floor the board prints for a masked row: the 100K CLUB tag
  // follows it, since the board already files the row under its tier.
  let floor = me.meters;
  let rank: { place: number; of: number } | null | undefined;
  let records: RecordBadge[] | undefined;
  // The PLACES half of the rule (owner, 2026-09-05 evening): one of the
  // hidden elite carries no place at all — not even to themself — so
  // divisionRank hands back null though they do hold one. `elite` is how
  // the ledger tells that apart from a rower who genuinely has no rank
  // (nothing logged yet): it is the unranked flag off the board as THIS
  // viewer sees it, which is set on all the elite including the viewer's
  // own row and on none of them for an admin, whose board is ranked.
  let elite = false;
  try {
    const { boards: full } = await boardView(viewOpts(viewer));
    rank = divisionRank(full, p.id);
    records = recordPlacements(full, p.id, 10);
    elite = full.total.find((r) => r.participantId === p.id)?.unranked === true;
    if (masked) {
      masked = maskedIds(full).has(p.id);
      floor = full.total.find((r) => r.participantId === p.id)?.meters ?? 0;
    }
  } catch (err) {
    console.error(`row100k: failed to load board data for placements (rower ${num})`, err);
    if (masked) {
      floor = 0;
      // `elite` stays FALSE here on purpose (review, 2026-09-05): the
      // numbers fail closed because blocks disclose nothing, but ELITE is
      // not a withheld value, it is a claim — and in this state the page
      // cannot tell rank 3 from rank 40, so it would pin an elite badge
      // on rowers who are nowhere near it. With no rank read, the ledger
      // prints the dash, which claims nothing about anyone.
      //
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
  let shareElite = false;
  if (blackout.active) {
    try {
      const { boards: pub } = await boardView({ forceBlackout: !!viewer.preview });
      shareElite = maskedIds(pub).has(p.id);
    } catch {
      shareElite = true;
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
    // No place on a card of one of the elite, ever: the page may show an
    // admin (or the rower) the ranked board, but a card leaves the site,
    // and "#3" is the number by another route (the PLACES half of the
    // rule). For everyone else this is the rank the page prints.
    rank: shareElite ? null : rank,
    records: masked ? records?.map((r) => ({ ...r, value: "" })) : records,
    // The cards stop at today like the page calendar does.
    days: daysElapsed(),
    masked: shareElite,
    digits: shareElite ? digits : undefined,
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
    day: r.day,
    dayStr: fmtDay(r.day),
    title: r.title,
    // The numbers behind the strings, for the sort and the distance chips
    // (logSort.ts) — never for a masked row.
    meters: masked ? undefined : r.meters,
    seconds: masked ? undefined : r.seconds,
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

  // THE PACE (owner ask, 2026-09-08): the running average split after each
  // timed session, against the meters rowed so far. Untimed rows add no
  // point — a split needs both numbers. Not built for a masked view: the
  // dog tag replaces the page, and the points would be the truth.
  const paceCurve: PacePoint[] = [];
  if (!masked) {
    let cm = 0;
    let cs = 0;
    for (const e of entries) {
      if (!(e.meters > 0) || !(e.seconds > 0)) continue;
      cm += e.meters;
      cs += e.seconds;
      paceCurve.push({ m: cm, s: cs / (cm / 500), dayStr: fmtDay(e.day) });
    }
  }

  // THE FIELD on the profile (same ask): everyone's densities with this
  // rower over them. The hidden set is the board's, as THIS viewer sees it,
  // so the grey ground counts everyone and the overlay is the rower's own.
  // A failed read just leaves the block off the page.
  let field: ProfileView["field"] = null;
  if (!masked && entries.length > 0) {
    try {
      const all = await fieldEntries();
      const hidden = new Set<string>();
      try {
        const { boards: pub } = await boardView(viewOpts(viewer));
        for (const id of maskedIds(pub)) hidden.add(id);
      } catch {
        /* no board, no hidden set — the densities are aggregates anyway */
      }
      const f = buildField(all, { isHidden: (id) => hidden.has(id), meId: p.id });
      // The 5k and the 10k as distributions of TIME, this rower's attempts
      // over the field's (owner ask, 2026-09-11, stats/distances.ts). Same
      // rows, same meId: the overlay belongs to the rower whose page this
      // is, not to whoever is looking. The same hidden set goes along as
      // buildField gets — the figures are public (a 5k time is, even for one
      // of the elite: records/defs.ts) but a rug tick on a chart titled 5K
      // is that rower's meters by another route.
      //
      // Filtered to the distances this rower has actually rowed HERE, on the
      // server. ProfileField is a client component, so anything handed to it
      // is serialised into the page whether it draws or not — an untouched
      // 10k chart is 120 xs, 120 ys and a 60-tick rug of dead weight on
      // every profile of a rower who has never rowed one.
      if (f.field.sessions > 0 && f.you)
        field = {
          field: f.field,
          you: f.you,
          distances: buildDistanceKdes(all, p.id, (id) => hidden.has(id)).filter((d) => d.youN > 0),
        };
    } catch (err) {
      console.error(`row100k: failed to build the field for rower ${num}`, err);
    }
  }

  // THE OWN-PROFILE DOG TAG (owner, 2026-09-08): an elite rower's own page
  // carries, under the stats and above THE PACE, the tag a stranger gets in
  // place of the page — what everyone else sees. Only the rower themself
  // (an admin on somebody else's page keeps the whole page), only while a
  // window is open for this request (the admin's test blackout counts, via
  // previewBlackout), and only when the board files them among the elite
  // as this viewer sees it — or the admin is looking as one OF the elite
  // (preview "elite"), which is how the owner checks it without having to
  // be top ten. `elite` is off the viewer's board, so under the test
  // blackout it is already the answer for the forced window. Never on a
  // masked page (the admin under OUTSIDE IT on their own elite row): that
  // page IS the tag, and the view should say so once.
  const ownTag: ProfileView["ownTag"] =
    !masked && isMe && blackout.active && (elite || viewer.preview === "elite")
      ? { until: blackout.endsAt ? fmtPacificDay(blackout.endsAt) : undefined }
      : null;

  // One object for the layout (looks/view.ts): everything above, computed
  // once; Profile.tsx only lays it out.
  const view: ProfileView = {
    rower: p,
    roster,
    isMe,
    isAdmin,
    masked,
    blackoutNote,
    club: (masked ? floor : me.meters) >= GOAL_METERS,
    phase,
    days: daysElapsed(),
    // The average split: computed here, from the real total and the real
    // seconds, and shipped as a string. It survives the mask on purpose.
    paceTag: me.meters > 0 && totalSeconds > 0 ? fmtPaceTag(me.meters, totalSeconds) : undefined,
    paceCurve,
    field,
    totals: {
      meters: me.meters,
      sessions: me.sessions,
      seconds: totalSeconds,
      longest: longestM,
    },
    rank,
    elite,
    ownTag,
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
      {/* One of the elite, seen by anybody else while a window is open:
          the profile is a dog tag, not a wall of blocks (owner,
          2026-09-06). Self and admins keep the whole page — an elite
          rower's own page carries the tag under the stats (view.ownTag). */}
      {masked ? (
        <DogTag view={view} until={blackout.endsAt ? fmtPacificDay(blackout.endsAt) : undefined} />
      ) : (
        <Profile view={view} />
      )}
      <RowFooter />
    </div>
  );
}
