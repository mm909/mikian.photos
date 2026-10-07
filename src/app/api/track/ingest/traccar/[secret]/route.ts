import { NextResponse } from "next/server";
import { traccarSecretOk } from "@/lib/tracker/gate";
import { normalizeTraccar, isTraccarError } from "@/lib/tracker/adapters/traccar";
import { ingestFix } from "@/lib/tracker/ingest";
import { snapshotAfterIngest } from "@/lib/tracker/snapshot";
import { readJson } from "../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The snapshot rebuild after ingest is awaited here.
export const maxDuration = 30;

/**
 * POST /api/track/ingest/traccar/[secret] — Traccar's position forwarding
 * (forward.url, forward.type=json): one `{ position, device }` per request.
 *
 * The secret is TRACKER_TRACCAR_SECRET, as the path segment or as
 * `Authorization: Bearer …` (forward.header). A bad secret is a 401.
 * EVERYTHING ELSE is a 200: Traccar retries any non-2xx up to ten times with
 * growing delays, and junk stays junk however often it is retried — so an
 * unknown device, a bad fix or a snapshot hiccup answers `{ ok:false, reason }`
 * with status 200 and Traccar moves on.
 */
export async function POST(req: Request, { params }: { params: { secret: string } }) {
  if (!traccarSecretOk(req, params.secret)) return new NextResponse(null, { status: 401 });

  const body = await readJson(req);
  if (body === null) return NextResponse.json({ ok: false, reason: "bad_json" });

  const fix = normalizeTraccar(body);
  if (isTraccarError(fix)) return NextResponse.json({ ok: false, reason: "invalid", error: fix.error });

  try {
    const { outcome, slug } = await ingestFix(fix);
    if (slug) {
      // Awaited, not fired and forgotten: on serverless the function may be
      // frozen the moment the response goes out.
      try {
        await snapshotAfterIngest(slug);
      } catch (err) {
        console.error(`track traccar: snapshot after ingest failed for ${slug}`, err);
      }
    }
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("track traccar: ingest failed", err);
    return NextResponse.json({ ok: false, reason: "server_error" });
  }
}
