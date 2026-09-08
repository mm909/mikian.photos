import { db } from "@/lib/db";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import type { RaffleDef } from "./raffles";

/* THE RAFFLE, read from the database (server only). raffles.ts says what a
 * raffle is; this says where it stands: who is in the hat, whether the
 * viewer is, who won. Every read fails OPEN — a missing table or a db
 * hiccup renders the raffle as not yet drawn with the second chance
 * hidden, never a 500 on a public page. */

export type RaffleWinner = {
  participantId: string;
  rowerNumber: number;
  name: string;
  /* Their total at the draw, and their rows inside the window. */
  meters: number;
  rows: number;
  drawnAt: string;
  drawnBy: string;
  /* How many rowers the hat held. */
  entrants: number;
};

export type RaffleState = {
  slug: string;
  ctaLive: boolean;
  winner: RaffleWinner | null;
};

export const EMPTY_RAFFLE_STATE = (slug: string): RaffleState => ({ slug, ctaLive: false, winner: null });

export async function raffleState(slug: string): Promise<RaffleState> {
  try {
    const row = await db.rowRaffle.findUnique({
      where: { challenge_slug: { challenge: CHALLENGE, slug } },
    });
    if (!row) return EMPTY_RAFFLE_STATE(slug);
    const drawn =
      row.winnerParticipantId && row.winnerRowerNumber !== null && row.winnerName && row.drawnAt
        ? {
            participantId: row.winnerParticipantId,
            rowerNumber: row.winnerRowerNumber,
            name: row.winnerName,
            meters: row.winnerMeters ?? 0,
            rows: row.winnerRows ?? 0,
            drawnAt: row.drawnAt.toISOString(),
            drawnBy: row.drawnBy,
            entrants: row.entrants ?? 0,
          }
        : null;
    return { slug, ctaLive: row.ctaLive, winner: drawn };
  } catch (err) {
    console.error(`row100k raffle: state read failed for ${slug} (table pushed?)`, err);
    return EMPTY_RAFFLE_STATE(slug);
  }
}

/* One rower in the hat. `rows` and `windowMeters` are inside the window;
 * `meters` is their whole September. `admin` marks an account that gives
 * the prizes away rather than wins them — listed for the owner, never
 * drawn. */
export type Entrant = {
  participantId: string;
  rowerNumber: number;
  name: string;
  instagram: string;
  division: string;
  rows: number;
  windowMeters: number;
  meters: number;
  admin: boolean;
};

/* Everyone with a ticket: a row dated inside the window and logged before
 * the close (raffles.ts explains the rule). Sorted by rower number — the
 * hat has no order. Throws on a db failure; callers decide how to fail. */
export async function raffleEntrants(r: RaffleDef): Promise<Entrant[]> {
  const inWindow = await db.rowEntry.findMany({
    where: {
      challenge: CHALLENGE,
      day: { gte: r.entryFrom, lte: r.entryTo },
      createdAt: { lt: new Date(r.closesAt) },
    },
    select: { participantId: true, meters: true },
  });
  if (inWindow.length === 0) return [];

  const tally = new Map<string, { rows: number; windowMeters: number }>();
  for (const e of inWindow) {
    const t = tally.get(e.participantId) ?? { rows: 0, windowMeters: 0 };
    t.rows += 1;
    t.windowMeters += e.meters;
    tally.set(e.participantId, t);
  }
  const pids = [...tally.keys()];

  const [participants, allRows] = await Promise.all([
    db.rowParticipant.findMany({
      where: { id: { in: pids }, challenge: CHALLENGE },
      select: { id: true, rowerNumber: true, displayName: true, instagram: true, division: true, userId: true },
    }),
    db.rowEntry.findMany({
      where: { participantId: { in: pids } },
      select: { participantId: true, meters: true },
    }),
  ]);
  const accounts = await db.photographer.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true, roles: true },
  });
  const adminByUser = new Map(accounts.map((a) => [a.id, isRow100kAdmin(a.email, a.roles ?? [])]));
  const total = new Map<string, number>();
  for (const e of allRows) total.set(e.participantId, (total.get(e.participantId) ?? 0) + e.meters);

  return participants
    .map((p) => {
      const t = tally.get(p.id) ?? { rows: 0, windowMeters: 0 };
      return {
        participantId: p.id,
        rowerNumber: p.rowerNumber,
        name: p.displayName,
        instagram: p.instagram,
        division: p.division,
        rows: t.rows,
        windowMeters: t.windowMeters,
        meters: total.get(p.id) ?? 0,
        admin: adminByUser.get(p.userId) ?? false,
      };
    })
    .sort((a, b) => a.rowerNumber - b.rowerNumber);
}

/* How many rowers hold a ticket — the public number ("14 IN THE HAT"),
 * admins left out. Null when the count cannot be read. */
export async function raffleHatSize(r: RaffleDef): Promise<number | null> {
  try {
    return (await raffleEntrants(r)).filter((e) => !e.admin).length;
  } catch (err) {
    console.error(`row100k raffle: hat count failed for ${r.slug}`, err);
    return null;
  }
}

/* The viewer's own ticket: their rows inside the window, 0 when they have
 * none. Looked up by rower number so the bar — which carries only the
 * number — can ask too. Fails open to 0. */
export async function myRaffleRows(r: RaffleDef, rowerNumber: number | null): Promise<number> {
  if (rowerNumber === null) return 0;
  try {
    return await db.rowEntry.count({
      where: {
        challenge: CHALLENGE,
        participant: { challenge: CHALLENGE, rowerNumber },
        day: { gte: r.entryFrom, lte: r.entryTo },
        createdAt: { lt: new Date(r.closesAt) },
      },
    });
  } catch (err) {
    console.error(`row100k raffle: own-entry read failed for ${r.slug}`, err);
    return 0;
  }
}
