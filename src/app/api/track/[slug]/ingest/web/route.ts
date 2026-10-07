import { NextResponse } from "next/server";
import { normalizeWebBatch, goodFixes } from "@/lib/tracker/adapters/web";
import { ingestFixes } from "@/lib/tracker/ingest";
import { snapshotAfterIngest } from "@/lib/tracker/snapshot";
import type { IngestOutcome } from "@/lib/tracker/types";
import { bad, readJson, requireCrew } from "../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A queued batch plus the awaited snapshot rebuild.
export const maxDuration = 30;

/**
 * POST /api/track/[slug]/ingest/web?k=<crew key> — the browser adapter.
 * Body { external_id, fixes: [{ fix_time, lat, lon, accuracy_m?, speed_mps?,
 * battery_pct?, altitude_m? }, …] } — a batch, because the van page queues
 * fixes offline and flushes them oldest first.
 *
 * Answers { ok, results: IngestOutcome[] } aligned with `fixes`, so the page
 * can drop from its queue exactly what the server has dealt with — a
 * duplicate or a rejected fix is "dealt with" too; only a 5xx means retry.
 * The device must belong to THIS event: a crew key opens one event only.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const crew = await requireCrew(req, params.slug, body);
  if ("res" in crew) return crew.res;
  if (crew.event.status === "archived") return bad("This event is archived.", 409);

  const batch = normalizeWebBatch(body, "web");
  if ("error" in batch) return bad(batch.error);

  const results: IngestOutcome[] = batch.fixes.map(() => ({ ok: false, reason: "invalid" }));
  const { fixes, indexes } = goodFixes(batch);
  try {
    if (fixes.length) {
      const r = await ingestFixes(fixes, { eventId: crew.event.id });
      r.outcomes.forEach((o, j) => {
        results[indexes[j]] = o;
      });
      for (const slug of r.touched) await snapshotAfterIngest(slug);
      if (r.counts.rejected) console.log(`track web ${params.slug} ${batch.externalId}: ${r.counts.line}`);
    }
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error(`track web ${params.slug}: ingest failed`, err);
    return bad("Couldn't store those fixes — try again.", 503);
  }
}
