import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOwnerActor } from "@/lib/permissions";
import { routeFoot, routeSectionCandidates } from "@/lib/routing";

/**
 * Owner-only demo/routing helpers for the relay tracker — so TSP can be built
 * and tested WITHOUT real GPX files.
 *
 *   POST /api/relay/[eventId]/simulate  { action, ... }
 *
 * Actions:
 *   seedTeam   { count?=8 }              create N demo runners (if none yet)
 *   planRoute  { waypoints:[[lat,lng]] } foot-route through the waypoints
 *                                        (BRouter, straight-line fallback) and
 *                                        save it as THE planned route
 *   simulate   { fraction?=0.5, reset?=true }
 *                                        generate completed legs (1–3 mi each,
 *                                        round-robin runners, synthetic pace)
 *                                        covering `fraction` of the plan, with
 *                                        the last leg ending ~now
 *   clearAll   {}                        delete all segments (keep runners)
 *
 * Everything is owner-gated and scoped to [eventId]. Fails open with a push
 * hint if the Relay tables aren't migrated yet.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

// Warm TSP palette (see src/lib/dtk.ts RUNNER_PALETTE — duplicated here since
// this route is server-side and dtk.ts is client-shared; keep in sync).
const PALETTE = [
  "#e8613c", "#f0b060", "#ffcf8f", "#c8401a",
  "#d98e73", "#b8a98a", "#e8934a", "#a86f4f",
];
const MI = 1609.34;

type Pt = [number, number, number];

const R_EARTH = 6371000;
function havM(a: Pt, b: Pt): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}
function decimate(points: Pt[], max = 1500): Pt[] {
  if (points.length <= max) return points;
  const out: Pt[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}
function asPoints(raw: unknown): Pt[] {
  if (!Array.isArray(raw)) return [];
  const out: Pt[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") {
      out.push([p[0], p[1], typeof p[2] === "number" ? p[2] : 0]);
    }
  }
  return out;
}
function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request, { params }: { params: { eventId: string } }) {
  if (!(await isOwnerActor())) return bad("Not allowed", 403);
  const eventId = params.eventId;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid JSON body");
  }
  const action = body.action;

  try {
    if (action === "seedTeam") {
      const count = Math.min(20, Math.max(1, Number(body.count) || 8));
      const existing = await db.relayRunner.count({ where: { eventId } });
      if (existing > 0) {
        return NextResponse.json({ ok: true, created: 0, note: "runners already exist" });
      }
      for (let i = 0; i < count; i++) {
        await db.relayRunner.create({
          data: {
            eventId,
            name: `Runner ${i + 1}`,
            color: PALETTE[i % PALETTE.length],
            sortOrder: i,
          },
        });
      }
      return NextResponse.json({ ok: true, created: count });
    }

    if (action === "planRoute") {
      const wpRaw = body.waypoints;
      if (!Array.isArray(wpRaw) || wpRaw.length < 2) {
        return bad("waypoints required ([[lat,lng], …], ≥2)");
      }
      const waypoints: [number, number][] = [];
      for (const w of wpRaw) {
        if (
          !Array.isArray(w) ||
          typeof w[0] !== "number" ||
          typeof w[1] !== "number" ||
          Math.abs(w[0]) > 90 ||
          Math.abs(w[1]) > 180
        ) {
          return bad("malformed waypoint");
        }
        waypoints.push([w[0], w[1]]);
      }
      const routed = await routeFoot(waypoints);
      // Replace any existing planned route.
      await db.routeSegment.deleteMany({ where: { eventId, kind: "planned" } });
      await db.routeSegment.create({
        data: {
          eventId,
          kind: "planned",
          name: "Planned route",
          points: decimate(routed.points),
          distanceM: routed.distanceM,
          gainM: routed.gainM,
          sortOrder: 0,
        },
        select: { id: true },
      });
      return NextResponse.json({
        ok: true,
        source: routed.source,
        distanceMi: +(routed.distanceM / MI).toFixed(1),
      });
    }

    if (action === "simulate") {
      const fraction = Math.min(1, Math.max(0.05, Number(body.fraction) || 0.5));
      const reset = body.reset !== false;

      const runners = await db.relayRunner.findMany({
        where: { eventId },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      if (runners.length === 0) return bad("Seed the team first.");

      const plannedRows = await db.routeSegment.findMany({
        where: { eventId, kind: "planned" },
        orderBy: { sortOrder: "asc" },
        select: { points: true },
      });
      const plan: Pt[] = plannedRows.flatMap((r) => asPoints(r.points));
      if (plan.length < 2) return bad("Draw a planned route first.");

      // Total planned distance + per-vertex cumulative.
      const cum: number[] = [0];
      for (let i = 1; i < plan.length; i++) cum[i] = cum[i - 1] + havM(plan[i - 1], plan[i]);
      const planTotal = cum[cum.length - 1];
      const targetCover = planTotal * fraction;

      // Cut legs of 1–3 mi until we've covered the target fraction.
      type Leg = { pts: Pt[]; distM: number };
      const legs: Leg[] = [];
      let startIdx = 0;
      let legTarget = (1 + Math.random() * 2) * MI;
      for (let i = 1; i < plan.length; i++) {
        const legSoFar = cum[i] - cum[startIdx];
        if (legSoFar >= legTarget || i === plan.length - 1) {
          legs.push({ pts: plan.slice(startIdx, i + 1), distM: legSoFar });
          startIdx = i;
          legTarget = (1 + Math.random() * 2) * MI;
        }
        if (cum[i] >= targetCover) break;
      }
      if (legs.length === 0) return bad("Planned route too short to simulate.");

      // Synthesize pace + timestamps so the LAST leg ends ~now (relay is live).
      const enriched = legs.map((leg) => {
        const paceMinPerMi = 8 + Math.random() * 3; // 8–11 min/mi
        const movingSec = Math.round((leg.distM / MI) * paceMinPerMi * 60);
        const gainM = leg.distM * (0.005 + Math.random() * 0.02); // ~25–130 ft/mi
        const restSec = 300 + Math.floor(Math.random() * 900); // 5–20 min handoff
        return { ...leg, movingSec, gainM, restSec };
      });
      const totalWallSec = enriched.reduce((a, l) => a + l.movingSec + l.restSec, 0);
      const startBaseMs = Date.now() - totalWallSec * 1000;

      if (reset) await db.routeSegment.deleteMany({ where: { eventId, kind: "completed" } });
      const baseOrder = await db.routeSegment.count({ where: { eventId, kind: "completed" } });

      let cursorMs = startBaseMs;
      for (let i = 0; i < enriched.length; i++) {
        const leg = enriched[i];
        const startedAt = new Date(cursorMs);
        const endedAt = new Date(cursorMs + leg.movingSec * 1000);
        cursorMs = endedAt.getTime() + leg.restSec * 1000;
        await db.routeSegment.create({
          data: {
            eventId,
            runnerId: runners[i % runners.length].id,
            kind: "completed",
            name: `Leg ${baseOrder + i + 1}`,
            points: decimate(leg.pts),
            distanceM: leg.distM,
            gainM: leg.gainM,
            movingTimeSec: leg.movingSec,
            startedAt,
            endedAt,
            sortOrder: baseOrder + i,
          },
          select: { id: true },
        });
      }
      return NextResponse.json({
        ok: true,
        legs: enriched.length,
        coveredMi: +(enriched.reduce((a, l) => a + l.distM, 0) / MI).toFixed(1),
      });
    }

    // ---- Route-planner section actions (waypoint → waypoint) --------------

    if (action === "routeSection") {
      // Up to 3 foot-route candidates between two of this event's waypoints.
      const fromId = String(body.fromWaypointId ?? "");
      const toId = String(body.toWaypointId ?? "");
      const [from, to] = await Promise.all([
        db.routeWaypoint.findFirst({ where: { id: fromId, eventId } }),
        db.routeWaypoint.findFirst({ where: { id: toId, eventId } }),
      ]);
      if (!from || !to) return bad("unknown waypoint(s) for this event");
      const candidates = await routeSectionCandidates([from.lat, from.lng], [to.lat, to.lng]);
      return NextResponse.json({
        ok: true,
        // First candidate is the recommended one (sorted server-side).
        candidates: candidates.map((c, i) => ({
          alt: c.alt,
          source: c.source,
          distanceM: c.distanceM,
          gainM: c.gainM,
          points: decimate(c.points, 1200),
          recommended: i === 0,
        })),
      });
    }

    if (action === "lockSection") {
      // Persist a chosen candidate as THE planned route for a waypoint pair
      // (one per pair — re-locking replaces). Client sends back the candidate's
      // points/stats from routeSection; validate shape + ownership.
      const fromId = String(body.fromWaypointId ?? "");
      const toId = String(body.toWaypointId ?? "");
      const [from, to] = await Promise.all([
        db.routeWaypoint.findFirst({ where: { id: fromId, eventId } }),
        db.routeWaypoint.findFirst({ where: { id: toId, eventId } }),
      ]);
      if (!from || !to) return bad("unknown waypoint(s) for this event");
      const points = asPoints(body.points);
      if (points.length < 2 || points.length > 4000) return bad("malformed points");
      const distanceM = Number(body.distanceM);
      if (!Number.isFinite(distanceM) || distanceM <= 0 || distanceM > 400_000) {
        return bad("distanceM out of range");
      }
      const gainM = Number.isFinite(Number(body.gainM)) ? Math.max(0, Number(body.gainM)) : 0;
      await db.routeSegment.deleteMany({
        where: { eventId, kind: "planned", fromWaypointId: fromId, toWaypointId: toId },
      });
      const seg = await db.routeSegment.create({
        data: {
          eventId,
          kind: "planned",
          name: `${from.name} → ${to.name}`,
          fromWaypointId: fromId,
          toWaypointId: toId,
          points,
          distanceM,
          gainM,
          // Keep the concatenated planned line in waypoint order.
          sortOrder: from.sortOrder,
        },
        select: { id: true },
      });
      return NextResponse.json({ ok: true, segmentId: seg.id });
    }

    if (action === "unlockSection") {
      if (!body.id) return bad("id required");
      await db.routeSegment.deleteMany({
        where: { eventId, kind: "planned", id: String(body.id) },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "clearAll") {
      await db.routeSegment.deleteMany({ where: { eventId } });
      return NextResponse.json({ ok: true });
    }

    return bad("unknown action");
  } catch (e) {
    console.error(`relay simulate ${String(action)} failed:`, e);
    return NextResponse.json(
      {
        error:
          "Relay tables aren't available yet — run `npm run prisma:push`, then retry.",
      },
      { status: 503 }
    );
  }
}
