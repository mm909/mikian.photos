import { NextResponse } from "next/server";
import { gateTrackerAdminApi } from "@/lib/tracker/gate";
import { snapshotAfterIngest } from "@/lib/tracker/snapshot";
import { backfillFromTraccar, TraccarRestError } from "@/lib/tracker/traccarRest";
import { bad, readJson, slugOk } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/track/[slug]/backfill — admin only. Pulls every traccar device's
 * positions from the Traccar REST API (TRACKER_TRACCAR_URL + _TOKEN) since
 * event start − 1 h (or body.since, ISO) through the ordinary ingest, to
 * fill any webhook gap. 503 when the env is not set.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const gate = await gateTrackerAdminApi();
  if (gate) return gate;
  if (!slugOk(params.slug)) return new NextResponse(null, { status: 404 });
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const b = (typeof body === "object" && body !== null ? body : {}) as { since?: unknown; until?: unknown };
  const since = typeof b.since === "string" && Number.isFinite(Date.parse(b.since)) ? new Date(b.since) : undefined;
  const until = typeof b.until === "string" && Number.isFinite(Date.parse(b.until)) ? new Date(b.until) : undefined;
  try {
    const result = await backfillFromTraccar(params.slug, { since, until });
    if (result.touched) {
      try {
        await snapshotAfterIngest(params.slug);
      } catch (err) {
        console.error(`track backfill ${params.slug}: snapshot rebuild failed`, err);
        result.errors.push("snapshot rebuild failed — it will rebuild on the next read");
      }
    }
    console.log(`track backfill ${params.slug}: ${result.devices} devices, fetched ${result.fetched}, stored ${result.stored}, duplicates ${result.duplicates}, rejected ${result.rejected}`);
    return NextResponse.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    if (err instanceof TraccarRestError) return bad(err.message, err.status);
    console.error(`track backfill ${params.slug}: failed`, err);
    return bad("Backfill failed — see the server log.", 500);
  }
}
