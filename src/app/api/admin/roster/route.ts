/**
 * GET /api/admin/roster?eventId=lighthouse-half-2026
 *
 * Owner-only. Joins the static event roster (LIGHTHOUSE_RACERS for the
 * Lighthouse Half) with per-bib photo + face counts so the roster screen
 * can show "we have N photos for runner X".
 *
 * Roster source is currently a hand-curated TS file. When more events come
 * in, we'd swap this for a per-event roster lookup; the response shape
 * stays the same.
 *
 * Response:
 *   {
 *     event: { id, name },
 *     runners: [{
 *       bib, name, gender, age, city, state, chipTime, chipMinutes,
 *       photoCount, faceCount
 *     }],
 *     officialResultsUrl: string | null   // null when unknown for this event
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";

export const runtime = "nodejs";

// Per-event official results URLs. Edit when new events land — keeping this
// here (vs. on the Event row) lets us point at an external URL without
// needing a schema change. null means "unknown" → UI renders no link.
const OFFICIAL_RESULTS_URLS: Record<string, string> = {
  // Race Roster's per-race result page. `filter_search=` left empty so it
  // lands on the full leaderboard; the user can type a bib/name there.
  // If we ever scrape 5K/10K rosters, swap in their own race ids here.
  "lighthouse-half-2026":
    "https://results.raceroster.com/v3/events/tmf7z96gjcpjtuet/race/283500?filter_search=",
};

export async function GET(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Unknown eventId" }, { status: 404 });
  }

  // Per-bib distinct-photo count for THIS event. groupBy on PhotoBib joined
  // back to Photo via the eventId filter.
  const bibPhotoRows = await db.photoBib.findMany({
    where: { photo: { eventId, hidden: false } },
    select: { bib: true, photoId: true },
  });
  const photosByBib = new Map<number, Set<string>>();
  for (const r of bibPhotoRows) {
    const set = photosByBib.get(r.bib) ?? new Set<string>();
    set.add(r.photoId);
    photosByBib.set(r.bib, set);
  }

  // Pick the roster for this event. Only Lighthouse is wired today.
  const roster =
    eventId === "lighthouse-half-2026" ? LIGHTHOUSE_RACERS : [];

  const runners = roster.map((r) => ({
    bib: r.bib,
    name: r.name,
    gender: r.gender,
    age: r.age,
    city: r.city,
    state: r.state,
    chipTime: r.chipTime,
    chipMinutes: r.chipMinutes,
    photoCount: photosByBib.get(r.bib)?.size ?? 0,
    // Face count is per-runner once face → bib linking is established. For
    // now it's the same proxy as "any face cluster appears in a photo this
    // bib also appears in" — surfaced via the coverage screen, not here.
    faceCount: 0,
  }));

  return NextResponse.json({
    event,
    runners,
    officialResultsUrl: OFFICIAL_RESULTS_URLS[eventId] ?? null,
  });
}
