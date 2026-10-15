import "server-only";
import { db } from "@/lib/db";
import type { HandoffDto, HandoffRequest, HandoffSource } from "./types";
import { slotName } from "./compute";
import { snapshotAfterIngest } from "./snapshot";

/**
 * Handoffs (TRACKER_SPEC.md §8 rules 5–6, §11 crew page): a crew tap says
 * "this runner is on course from `time`". The crew page stores taps in
 * IndexedDB with the client's timestamp and a UUID and retries until the
 * server acknowledges, so:
 *
 *   - a retried POST is the SAME handoff: upsert on clientEventId, and an
 *     existing row comes back unchanged (never duplicated, never re-timed);
 *   - taps arrive late and out of order: accepted as they are, the snapshot
 *     recomputes legs from the corrected times;
 *   - phone clocks drift: each request carries client_now; when the server
 *     is more than 5 s off from it the tap time is shifted by that offset
 *     and the offset is kept on the row (clockOffsetS) for the record. A
 *     request WITHOUT client_now gets no correction at all (clockOffsetS
 *     null). Review 2026-10-06: the parser used to substitute the tap time,
 *     so "an admin posting a missed tap by curl minutes later got it
 *     re-stamped to now" — the transport delay read as clock skew.
 *
 * Undo is `voided`, never a delete (the crew page shows voided taps greyed
 * so a mis-tap is visibly undone, not silently gone).
 *
 * Slots (owner, 2026-10-15: "we are running two by two"): a tap names the
 * slot the runner takes, 1-based, default 1 — a classic relay never sends
 * one. It must fit the entry's `slots` (400 otherwise), is stored on the row
 * and comes back in the DTO, so the crew page can show "A: Taylor · B: Sam".
 * One runner, one slot: a tap for a runner who holds a DIFFERENT slot at
 * that time is refused with a 409 (`rejectDoubleHoldings`); the crew page
 * drops it and shows the reason, since no retry would change the answer.
 */

export const SKEW_THRESHOLD_S = 5;
/** The config caps an entry at this many slots (config.ts), so a tap past it can only be a bug. */
export const MAX_SLOTS = 8;
const HANDOFF_SOURCES: readonly HandoffSource[] = ["crew", "runner", "admin", "simulator"];

export class HandoffError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Row = {
  id: string;
  entryId: string;
  participantId: string;
  time: Date;
  receivedTime: Date;
  source: string;
  voided: boolean;
  clientEventId: string;
  slot: number;
  participant: { name: string };
};

const rowSelect = {
  id: true,
  entryId: true,
  participantId: true,
  time: true,
  receivedTime: true,
  source: true,
  voided: true,
  clientEventId: true,
  slot: true,
  participant: { select: { name: true } },
} as const;

function toDto(r: Row): HandoffDto {
  return {
    id: r.id,
    entry_id: r.entryId,
    participant_id: r.participantId,
    participant_name: r.participant.name,
    time: r.time.toISOString(),
    received_time: r.receivedTime.toISOString(),
    source: (HANDOFF_SOURCES as readonly string[]).includes(r.source) ? (r.source as HandoffSource) : "crew",
    voided: r.voided,
    client_event_id: r.clientEventId,
    slot: r.slot,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** A parsed request: the wire shape, with client_now null when the client did not send one. */
export type ParsedHandoff = Omit<HandoffRequest, "client_now"> & { client_now: string | null };

/** Shape-check one request body entry; throws HandoffError(400) with the field named. */
export function parseHandoffRequest(raw: unknown): ParsedHandoff {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new HandoffError(400, "handoff must be an object");
  const r = raw as Record<string, unknown>;
  const client_event_id = str(r.client_event_id);
  if (!client_event_id || client_event_id.length > 64) throw new HandoffError(400, "client_event_id is required (≤ 64 chars)");
  const entry_id = str(r.entry_id);
  if (!entry_id) throw new HandoffError(400, "entry_id is required");
  const participant_id = str(r.participant_id);
  if (!participant_id) throw new HandoffError(400, "participant_id is required");
  const time = str(r.time);
  if (!time || !Number.isFinite(Date.parse(time))) throw new HandoffError(400, "time must be an ISO date-time");
  // A client that does not say what time it thinks it is gets no skew
  // correction: the tap time is taken as sent (see the header).
  const client_now = str(r.client_now) || null;
  if (client_now !== null && !Number.isFinite(Date.parse(client_now))) throw new HandoffError(400, "client_now must be an ISO date-time");
  const sourceRaw = str(r.source);
  const source = sourceRaw ? (sourceRaw as HandoffSource) : undefined;
  if (source && !HANDOFF_SOURCES.includes(source)) throw new HandoffError(400, `source must be one of ${HANDOFF_SOURCES.join("|")}`);
  // The slot is optional on the wire (a classic relay's crew page never
  // sends one); when given it must be a whole number the config could have.
  let slot: number | undefined;
  if (r.slot !== undefined && r.slot !== null && r.slot !== "") {
    const n = Number(r.slot);
    if (!Number.isInteger(n) || n < 1 || n > MAX_SLOTS) throw new HandoffError(400, `slot must be a whole number 1–${MAX_SLOTS}`);
    slot = n;
  }
  return { client_event_id, entry_id, participant_id, time, client_now, source, slot };
}

/**
 * Server clock minus client clock, in seconds, when it is worth applying:
 * null without a client_now (spec §8 rule 6 has nothing to compare) and
 * null inside the ±5 s threshold.
 */
export function skewOffsetS(serverNow: Date, clientNow: string | null): number | null {
  if (clientNow === null) return null;
  const offsetS = (serverNow.getTime() - Date.parse(clientNow)) / 1000;
  return Math.abs(offsetS) > SKEW_THRESHOLD_S ? offsetS : null;
}

/** `HandoffRequest | { handoffs: HandoffRequest[] }` → the list. */
export function parseHandoffBody(body: unknown): ParsedHandoff[] {
  if (typeof body === "object" && body !== null && Array.isArray((body as { handoffs?: unknown }).handoffs)) {
    const list = (body as { handoffs: unknown[] }).handoffs;
    if (list.length === 0) throw new HandoffError(400, "handoffs[] is empty");
    if (list.length > 200) throw new HandoffError(400, "too many handoffs in one request (max 200)");
    return list.map(parseHandoffRequest);
  }
  return [parseHandoffRequest(body)];
}

/** What a request's participant row tells us: the entry it is on and that entry's slots. */
type ParticipantInfo = { name: string; entryId: string; slots: number; slotNames: string[] };

/** A tap as the double-holding check reads it (a stored row or one of this request's). */
type Tap = { participantId: string; timeMs: number; slot: number };

/**
 * The slot `participantId` holds at `atMs`, read the way compute reads it:
 * per slot, the latest tap at or before that instant (a slot past the
 * entry's count folds into the last one, as clampSlot does). Null when
 * they hold none.
 */
function slotHeldAt(taps: readonly Tap[], participantId: string, atMs: number, slots: number): number | null {
  const latest: (Tap | null)[] = Array.from({ length: slots }, () => null);
  for (const t of taps) {
    if (t.timeMs > atMs) continue;
    const i = Math.min(slots, Math.max(1, t.slot)) - 1;
    const have = latest[i];
    if (!have || t.timeMs >= have.timeMs) latest[i] = t;
  }
  const i = latest.findIndex((t) => t !== null && t.participantId === participantId);
  return i < 0 ? null : i + 1;
}

/**
 * One runner, one slot. Review 2026-10-15 (findings #2 and #4): a tap that
 * put a runner into slot B while they held slot A had them on course twice
 * — two live legs, their time and distance counted in both. Such a tap is
 * refused with a 409, "<name> is already on course in <slot>", unless the
 * slot is the one they already hold: that is the same-handoff replay (two
 * crew phones, a resend) compute folds away, and stays idempotent. "Holds"
 * is per slot the entry's latest non-voided tap at or before this tap's
 * corrected time, the earlier taps of this request included, so a batch
 * from an offline phone is judged in its own order. A retry of a tap we
 * already have is never refused: the row stands whatever was tapped since.
 * Throwing here, before any write, keeps a refused batch all-or-nothing;
 * the crew page then resends the taps one by one and drops the refused one.
 */
async function rejectDoubleHoldings(reqs: readonly ParsedHandoff[], times: readonly Date[], infoOf: Map<string, ParticipantInfo>): Promise<void> {
  const rows = await db.trackerHandoff.findMany({
    where: { entryId: { in: [...new Set(reqs.map((r) => r.entry_id))] } },
    orderBy: [{ time: "asc" }, { receivedTime: "asc" }],
    select: { clientEventId: true, entryId: true, participantId: true, time: true, slot: true, voided: true },
  });
  const known = new Set(rows.map((h) => h.clientEventId));
  const tapsOf = new Map<string, Tap[]>();
  for (const h of rows) {
    if (h.voided) continue;
    const list = tapsOf.get(h.entryId) ?? [];
    list.push({ participantId: h.participantId, timeMs: h.time.getTime(), slot: h.slot });
    tapsOf.set(h.entryId, list);
  }
  reqs.forEach((r, i) => {
    if (known.has(r.client_event_id)) return;
    const p = infoOf.get(r.participant_id);
    if (!p) return; // recordHandoffs has already answered 404 for this
    const slot = r.slot ?? 1;
    const list = tapsOf.get(r.entry_id) ?? [];
    const held = slotHeldAt(list, r.participant_id, times[i].getTime(), p.slots);
    if (held !== null && held !== slot) {
      throw new HandoffError(409, `${p.name} is already on course in ${slotName({ slotNames: p.slotNames }, held)}`);
    }
    list.push({ participantId: r.participant_id, timeMs: times[i].getTime(), slot });
    tapsOf.set(r.entry_id, list);
    known.add(r.client_event_id);
  });
}

/**
 * Record taps for an event. Every entry/participant must belong to `slug`
 * (404 otherwise — a key for one event opens nothing in another), every
 * slot must be one the entry has (400) and no tap may put a runner into a
 * second slot (409, see rejectDoubleHoldings). Returns the DTOs for the
 * requests sent, in order, existing rows included.
 */
export async function recordHandoffs(
  slug: string,
  reqs: readonly ParsedHandoff[],
  opts: { serverNow?: Date } = {},
): Promise<HandoffDto[]> {
  if (reqs.length === 0) return [];
  const serverNow = opts.serverNow ?? new Date();

  const participants = await db.trackerParticipant.findMany({
    where: { id: { in: [...new Set(reqs.map((r) => r.participant_id))] }, entry: { eventId: slug } },
    select: { id: true, name: true, entryId: true, entry: { select: { slots: true, slotNames: true } } },
  });
  const infoOf = new Map<string, ParticipantInfo>(
    participants.map((p) => [p.id, { name: p.name, entryId: p.entryId, slots: Math.max(1, p.entry.slots), slotNames: p.entry.slotNames }]),
  );
  for (const r of reqs) {
    const p = infoOf.get(r.participant_id);
    if (!p) throw new HandoffError(404, `participant ${r.participant_id} is not in event ${slug}`);
    if (p.entryId !== r.entry_id) throw new HandoffError(404, `participant ${r.participant_id} is not on entry ${r.entry_id}`);
    const slot = r.slot ?? 1;
    if (slot > p.slots) throw new HandoffError(400, `slot must be 1..${p.slots} for entry ${r.entry_id}`);
  }

  // No client_now → no correction (offset null); with one, correct only
  // past the threshold so a phone a second off is left alone. Worked out
  // once here: the double-holding check judges the corrected times.
  const offsets = reqs.map((r) => skewOffsetS(serverNow, r.client_now));
  const times = reqs.map((r, i) => new Date(Date.parse(r.time) + (offsets[i] ?? 0) * 1000));

  await rejectDoubleHoldings(reqs, times, infoOf);

  const out: HandoffDto[] = [];
  for (let i = 0; i < reqs.length; i++) {
    const r = reqs[i];
    const offsetS = offsets[i];
    const time = times[i];
    const row = await db.trackerHandoff.upsert({
      where: { clientEventId: r.client_event_id },
      create: {
        clientEventId: r.client_event_id,
        entryId: r.entry_id,
        participantId: r.participant_id,
        time,
        receivedTime: serverNow,
        source: r.source ?? "crew",
        clockOffsetS: offsetS === null ? null : Math.round(offsetS * 1000) / 1000,
        slot: r.slot ?? 1,
      },
      // A retry of a tap we already have changes nothing — the first
      // delivery's time and offset stand.
      update: {},
      select: rowSelect,
    });
    out.push(toDto(row));
  }

  await snapshotAfterIngest(slug);
  return out;
}

/** Undo: mark one tap voided (by the client's UUID or our id). 404 when it is not this event's. */
export async function voidHandoff(slug: string, ref: { client_event_id?: string; id?: string }): Promise<HandoffDto> {
  const clientEventId = str(ref.client_event_id);
  const id = str(ref.id);
  if (!clientEventId && !id) throw new HandoffError(400, "send client_event_id or id");
  const existing = await db.trackerHandoff.findFirst({
    where: { ...(clientEventId ? { clientEventId } : { id }), entry: { eventId: slug } },
    select: { id: true, voided: true },
  });
  if (!existing) throw new HandoffError(404, "no such handoff in this event");
  const row = await db.trackerHandoff.update({
    where: { id: existing.id },
    data: { voided: true },
    select: rowSelect,
  });
  if (!existing.voided) await snapshotAfterIngest(slug);
  return toDto(row);
}

/** Newest first, voided included (the DTO flags them), each with its slot. */
export async function listHandoffs(slug: string, limit = 50): Promise<HandoffDto[]> {
  const rows = await db.trackerHandoff.findMany({
    where: { entry: { eventId: slug } },
    orderBy: [{ time: "desc" }, { receivedTime: "desc" }],
    take: Math.max(1, Math.min(500, limit)),
    select: rowSelect,
  });
  return rows.map(toDto);
}
