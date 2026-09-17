import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cleanTitle, columnsFrom, defaultTitle, type TelemetryDoc, type TelemetrySavedRow } from "./session";

/* THE SAVED ROWS ON THE SERVER (owner, 2026-09-17: the option to save the
 * live telemetry of a row). Insert, list, fetch, delete — the four verbs
 * the routes and the page call, factored here so the scratchpad check runs
 * the same code against the demo namespace. NO "server-only" import: this
 * file has to load under tsx outside Next.
 *
 * Every verb is scoped to one challenge slug, and every read or delete
 * takes a participantId: the viewer's own for a rower, null for an admin
 * who may see everyone. A row the scope does not cover reads as not found.
 * A refusal the caller should print is a TelemetryStoreError with a
 * status; anything else is the database and the route answers 503. */

export class TelemetryStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const ROW_SELECT = {
  id: true,
  participantId: true,
  rowerNumber: true,
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

function toSaved(row: DbRow, names: Map<string, string>): TelemetrySavedRow {
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
    rowerNumber: row.rowerNumber,
    displayName: names.get(row.participantId) ?? "",
  };
}

/* displayName is not a relation on the table, so the names come in one
 * second query over the participant ids the rows mention. */
async function namesFor(rows: DbRow[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(rows.map((r) => r.participantId)));
  if (!ids.length) return new Map();
  const ps = await db.rowParticipant.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  return new Map(ps.map((p) => [p.id, p.displayName]));
}

export async function insertTelemetry(args: {
  challenge: string;
  participantId: string;
  rowerNumber: number;
  doc: TelemetryDoc;
  title?: unknown;
  entryId?: unknown;
}): Promise<TelemetrySavedRow> {
  const { challenge, participantId, rowerNumber, doc } = args;
  let entryId: string | null = null;
  if (typeof args.entryId === "string" && args.entryId) {
    const entry = await db.rowEntry.findFirst({ where: { id: args.entryId, challenge, participantId }, select: { id: true } });
    if (!entry) throw new TelemetryStoreError("That logged row is not yours, or is gone.", 404);
    entryId = entry.id;
  }
  const cols = columnsFrom(doc);
  const row = await db.rowTelemetry.create({
    data: {
      challenge,
      participantId,
      rowerNumber,
      ...cols,
      title: cleanTitle(args.title, defaultTitle(doc)),
      entryId,
      data: doc as unknown as Prisma.InputJsonValue,
    },
    select: ROW_SELECT,
  });
  return toSaved(row, await namesFor([row]));
}

/* Newest first. participantId null = every rower in the challenge. */
export async function listTelemetry(args: { challenge: string; participantId: string | null; limit?: number }): Promise<TelemetrySavedRow[]> {
  const rows = await db.rowTelemetry.findMany({
    where: { challenge: args.challenge, ...(args.participantId ? { participantId: args.participantId } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(500, Math.max(1, args.limit ?? 200)),
    select: ROW_SELECT,
  });
  const names = await namesFor(rows);
  return rows.map((r) => toSaved(r, names));
}

export async function getTelemetry(args: { challenge: string; id: string; participantId: string | null }): Promise<{ row: TelemetrySavedRow; doc: TelemetryDoc } | null> {
  const row = await db.rowTelemetry.findFirst({
    where: { id: args.id, challenge: args.challenge, ...(args.participantId ? { participantId: args.participantId } : {}) },
    select: { ...ROW_SELECT, data: true },
  });
  if (!row) return null;
  const { data, ...rest } = row;
  return { row: toSaved(rest, await namesFor([rest])), doc: data as unknown as TelemetryDoc };
}

/* True when a row went; false when the scope held none to delete. */
export async function deleteTelemetry(args: { challenge: string; id: string; participantId: string | null }): Promise<boolean> {
  const res = await db.rowTelemetry.deleteMany({
    where: { id: args.id, challenge: args.challenge, ...(args.participantId ? { participantId: args.participantId } : {}) },
  });
  return res.count > 0;
}
