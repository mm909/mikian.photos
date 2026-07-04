import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnerActor } from "@/lib/permissions";

/**
 * Owner-only mutations for the relay tracker (TSP France).
 *
 *   POST /api/relay/[eventId]/admin  { action, ...payload }
 *
 * Actions:
 *   addRunner      { name, color? }
 *   deleteRunner   { id }                (their segments keep runnerId=null? No —
 *                                         segments are re-pointed to null so the
 *                                         route stays on the map)
 *   addSegment     { name?, runnerId?, kind, points: [lat,lng,ele][],
 *                    distanceM, gainM, movingTimeSec?, startedAt?, endedAt? }
 *                  (the uploader parses + decimates the GPX in the browser —
 *                   DOMParser isn't available server-side — and posts the
 *                   distilled track; the server validates shape + bounds)
 *   deleteSegment  { id }
 *   addWaypoint    { name, lat, lng }
 *   deleteWaypoint { id }
 *
 * Gated on the platform owner (isOwnerActor) — the tracker is a first-party
 * surface, not per-event-manager delegated. All writes scoped to [eventId].
 */
export const runtime = "nodejs";

const MAX_POINTS = 4000; // uploader targets ~1500; hard bound the row size
const MAX_SEGMENT_KM = 400; // sanity bound — a "segment" longer than this is a bad file

/** Normalize a user-supplied link: trimmed http(s) URL, bare "@handle" or
 *  "handle" treated as Instagram. Returns undefined for empty (clear), false
 *  for invalid. */
function normalizeUrl(v: unknown): string | undefined | false {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return undefined;
  if (/^https?:\/\/\S+$/i.test(s)) return s;
  if (/^@?[a-zA-Z0-9._]{2,40}$/.test(s)) {
    return `https://instagram.com/${s.replace(/^@/, "")}`;
  }
  return false;
}

type Body = {
  action?: string;
  id?: string;
  name?: string;
  color?: string;
  url?: string | null;
  runnerId?: string | null;
  kind?: string;
  points?: unknown;
  distanceM?: number;
  gainM?: number;
  movingTimeSec?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  lat?: number;
  lng?: number;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { eventId: string } }) {
  if (!(await isOwnerActor())) return bad("Not allowed", 403);
  const eventId = params.eventId;
  if (!eventId) return bad("eventId required");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("invalid JSON body");
  }

  try {
    switch (body.action) {
      case "addRunner": {
        const name = (body.name ?? "").trim();
        if (!name) return bad("name required");
        const color = /^#[0-9a-fA-F]{6}$/.test(body.color ?? "") ? body.color! : "#c8401a";
        const url = normalizeUrl(body.url);
        if (url === false) return bad("url must be http(s)");
        const count = await db.relayRunner.count({ where: { eventId } });
        const runner = await db.relayRunner.create({
          data: { eventId, name, color, url: url ?? null, sortOrder: count },
        });
        return NextResponse.json({ ok: true, runner });
      }
      case "updateRunner": {
        // Partial update: name / color / url (the runner "settings").
        if (!body.id) return bad("id required");
        const data: Record<string, unknown> = {};
        if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
        if (typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)) {
          data.color = body.color;
        }
        if (body.url !== undefined) {
          const url = normalizeUrl(body.url);
          if (url === false) return bad("url must be http(s)");
          data.url = url ?? null;
        }
        await db.relayRunner.updateMany({ where: { eventId, id: body.id }, data });
        return NextResponse.json({ ok: true });
      }
      case "deleteRunner": {
        if (!body.id) return bad("id required");
        // Keep their segments on the map — just unassign.
        await db.routeSegment.updateMany({
          where: { eventId, runnerId: body.id },
          data: { runnerId: null },
        });
        await db.relayRunner.deleteMany({ where: { eventId, id: body.id } });
        return NextResponse.json({ ok: true });
      }
      case "addSegment": {
        const kind = body.kind === "planned" ? "planned" : "completed";
        if (!Array.isArray(body.points) || body.points.length < 2) {
          return bad("points required (≥2)");
        }
        if (body.points.length > MAX_POINTS) {
          return bad(`too many points (max ${MAX_POINTS}) — decimate before upload`);
        }
        const points: [number, number, number][] = [];
        for (const p of body.points) {
          if (
            !Array.isArray(p) ||
            typeof p[0] !== "number" ||
            typeof p[1] !== "number" ||
            Math.abs(p[0]) > 90 ||
            Math.abs(p[1]) > 180
          ) {
            return bad("malformed point in track");
          }
          points.push([p[0], p[1], typeof p[2] === "number" ? p[2] : 0]);
        }
        const distanceM = Number(body.distanceM);
        if (!Number.isFinite(distanceM) || distanceM <= 0 || distanceM > MAX_SEGMENT_KM * 1000) {
          return bad("distanceM out of range");
        }
        const gainM = Number.isFinite(Number(body.gainM)) ? Math.max(0, Number(body.gainM)) : 0;
        // A completed segment's runner must belong to this event (or be null).
        let runnerId: string | null = null;
        if (kind === "completed" && body.runnerId) {
          const r = await db.relayRunner.findFirst({
            where: { id: body.runnerId, eventId },
            select: { id: true },
          });
          if (!r) return bad("unknown runnerId for this event");
          runnerId = r.id;
        }
        const startedAt = body.startedAt ? new Date(body.startedAt) : null;
        const endedAt = body.endedAt ? new Date(body.endedAt) : null;
        const count = await db.routeSegment.count({ where: { eventId, kind } });
        const segment = await db.routeSegment.create({
          data: {
            eventId,
            runnerId,
            name: (body.name ?? "").trim() || null,
            kind,
            points,
            distanceM,
            gainM,
            movingTimeSec:
              Number.isFinite(Number(body.movingTimeSec)) && Number(body.movingTimeSec) > 0
                ? Math.round(Number(body.movingTimeSec))
                : null,
            startedAt: startedAt && !isNaN(startedAt.getTime()) ? startedAt : null,
            endedAt: endedAt && !isNaN(endedAt.getTime()) ? endedAt : null,
            sortOrder: count,
          },
          select: { id: true },
        });
        return NextResponse.json({ ok: true, segmentId: segment.id });
      }
      case "deleteSegment": {
        if (!body.id) return bad("id required");
        await db.routeSegment.deleteMany({ where: { eventId, id: body.id } });
        return NextResponse.json({ ok: true });
      }
      case "addWaypoint": {
        const name = (body.name ?? "").trim();
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!name) return bad("name required");
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return bad("valid lat/lng required");
        }
        const count = await db.routeWaypoint.count({ where: { eventId } });
        const waypoint = await db.routeWaypoint.create({
          data: { eventId, name, lat, lng, sortOrder: count },
        });
        return NextResponse.json({ ok: true, waypoint });
      }
      case "deleteWaypoint": {
        if (!body.id) return bad("id required");
        await db.routeWaypoint.deleteMany({ where: { eventId, id: body.id } });
        return NextResponse.json({ ok: true });
      }
      default:
        return bad("unknown action");
    }
  } catch (e) {
    // Most likely: tables not migrated yet.
    console.error(`relay admin ${body.action} failed:`, e);
    return NextResponse.json(
      {
        error:
          "Relay tables aren't available yet — run `npm run prisma:push` to create them, then retry.",
      },
      { status: 503 }
    );
  }
}
