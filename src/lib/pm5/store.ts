import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cleanTitle, columnsFrom, defaultTitle, type TelemetryDoc, type TelemetrySavedRow } from "./session";

/* THE SAVED SESSIONS ON THE SERVER (owner, 2026-09-17: the erg console
 * moves out of Rowtember and the two things go disjoint). Insert, list,
 * fetch, delete — the four verbs /api/erg/sessions calls, factored here so
 * the scratchpad check can run the same code. NO "server-only" import:
 * this file has to load under tsx outside Next.
 *
 * SCOPE IS THE ACCOUNT NOW, not a rower. Every verb takes the viewer's
 * Photographer id; a write sets userId and leaves challenge, participantId
 * and rowerNumber exactly as the schema left them (the default and two
 * nulls). A read matches on userId — plus the one legacy clause below.
 *
 * THE LEGACY CLAUSE. Two real sessions were saved from PM5 530724321
 * before the move: they carry a participantId and no userId, so a plain
 * userId match would hide the owner's own rows from him. A read therefore
 * also takes a row whose userId is null when its participantId is the
 * viewer's own RowParticipant. That is the ONLY tie to Rowtember left in
 * this file — one lookup, kept purely so two old rows stay reachable, and
 * it can go the day they are re-saved or dropped.
 *
 * A refusal the caller should print is an ErgStoreError with a status;
 * anything else is the database and the route answers 503. */

export class ErgStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/* Who is asking. isAdmin reads every session there is; a plain account
 * reads its own. */
export type ErgScope = { userId: string; isAdmin?: boolean };

const ROW_SELECT = {
  id: true,
  device: true,
  simulated: true,
  startedAt: true,
  endedAt: true,
  meters: true,
  tenths: true,
  strokes: true,
  avgPaceTenths: true,
  avgWatts: true,
  avgSpm: true,
  avgHr: true,
  dragFactor: true,
  title: true,
  entryId: true,
  createdAt: true,
} satisfies Prisma.RowTelemetrySelect;

type DbRow = Prisma.RowTelemetryGetPayload<{ select: typeof ROW_SELECT }>;

function toSaved(row: DbRow): TelemetrySavedRow {
  return {
    id: row.id,
    device: row.device,
    simulated: row.simulated,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    meters: row.meters,
    tenths: row.tenths,
    strokes: row.strokes,
    avgPaceTenths: row.avgPaceTenths,
    avgWatts: row.avgWatts,
    avgSpm: row.avgSpm,
    avgHr: row.avgHr,
    dragFactor: row.dragFactor,
    title: row.title,
    entryId: row.entryId,
    createdAt: row.createdAt.toISOString(),
  };
}

/* EVERY RowParticipant this account has ever had, whatever challenge it
 * belongs to — see THE LEGACY CLAUSE above.
 *
 * It asks for all of them rather than the one in CHALLENGE on purpose
 * (owner, 2026-09-17: two saved sessions he could not see). CHALLENGE is
 * the DEMO namespace whenever the demo flag is set, which is what the
 * local dev server runs on, so keying the lookup to it hid his own rows
 * from him on the machine he was looking at — and would hide them again
 * the day the challenge is renamed. The rows themselves are pinned to one
 * participant id; which challenge that participant sat in is not this
 * question.
 *
 * A failure is not fatal: the read goes on with the account match alone. */
async function legacyParticipantIds(userId: string): Promise<string[]> {
  try {
    const rows = await db.rowParticipant.findMany({ where: { userId }, select: { id: true } });
    return rows.map((r) => r.id);
  } catch (err) {
    console.error("erg sessions: legacy participant lookup failed, matching on the account alone", err);
    return [];
  }
}

/* The where clause every read shares: everything for an admin, the
 * account's own rows plus its pre-move rows for anyone else. */
async function scopeWhere(scope: ErgScope): Promise<Prisma.RowTelemetryWhereInput> {
  if (scope.isAdmin) return {};
  const pids = await legacyParticipantIds(scope.userId);
  const or: Prisma.RowTelemetryWhereInput[] = [{ userId: scope.userId }];
  if (pids.length > 0) or.push({ userId: null, participantId: { in: pids } });
  return { OR: or };
}

export async function insertErgSession(args: { userId: string; doc: TelemetryDoc; title?: unknown }): Promise<TelemetrySavedRow> {
  const cols = columnsFrom(args.doc);
  const row = await db.rowTelemetry.create({
    data: {
      userId: args.userId,
      ...cols,
      title: cleanTitle(args.title, defaultTitle(args.doc)),
      data: args.doc as unknown as Prisma.InputJsonValue,
    },
    select: ROW_SELECT,
  });
  return toSaved(row);
}

/* Newest first. */
export async function listErgSessions(scope: ErgScope & { limit?: number }): Promise<TelemetrySavedRow[]> {
  const rows = await db.rowTelemetry.findMany({
    where: await scopeWhere(scope),
    orderBy: { createdAt: "desc" },
    take: Math.min(500, Math.max(1, scope.limit ?? 200)),
    select: ROW_SELECT,
  });
  return rows.map(toSaved);
}

export async function getErgSession(args: ErgScope & { id: string }): Promise<{ row: TelemetrySavedRow; doc: TelemetryDoc } | null> {
  const row = await db.rowTelemetry.findFirst({
    where: { id: args.id, ...(await scopeWhere(args)) },
    select: { ...ROW_SELECT, data: true },
  });
  if (!row) return null;
  const { data, ...rest } = row;
  return { row: toSaved(rest), doc: data as unknown as TelemetryDoc };
}

/* True when a row went; false when the scope held none to delete. */
export async function deleteErgSession(args: ErgScope & { id: string }): Promise<boolean> {
  const res = await db.rowTelemetry.deleteMany({ where: { id: args.id, ...(await scopeWhere(args)) } });
  return res.count > 0;
}
