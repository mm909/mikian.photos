import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { crewKeyFrom, crewKeyOk, TRACKER_PUBLIC } from "@/lib/tracker/gate";

/**
 * Shared plumbing for the /api/track routes: defensive JSON, the crew-key
 * check against the event's own key, and the cache headers that follow the
 * development gate (private while the tracker is admin-only, so no shared
 * cache ever holds a snapshot a stranger could then be served).
 */

export const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/** Body JSON, `{}` for an empty body, `null` for malformed JSON (→ 400). */
export async function readJson(req: Request): Promise<unknown | null> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export type CrewEvent = { id: string; crewKey: string; status: string };

/**
 * The crew gate: 404 for an unknown event, 403 for a wrong or missing key.
 * The key may ride in ?k=, X-Crew-Key or the JSON body's `k` (gate.ts).
 */
export async function requireCrew(req: Request, slug: string, body?: unknown): Promise<{ event: CrewEvent } | { res: NextResponse }> {
  const event = await db.trackerEvent.findUnique({ where: { id: slug }, select: { id: true, crewKey: true, status: true } });
  if (!event) return { res: new NextResponse(null, { status: 404 }) };
  if (!crewKeyOk(event.crewKey, crewKeyFrom(req, body))) return { res: bad("bad crew key", 403) };
  return { event };
}

/** `private, max-age=N` in development; `public, s-maxage=N, stale-while-revalidate=2N` once live. */
export function cacheControl(maxAgeS: number): string {
  return TRACKER_PUBLIC ? `public, s-maxage=${maxAgeS}, stale-while-revalidate=${maxAgeS * 2}` : `private, max-age=${maxAgeS}`;
}

export function slugOk(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug);
}
