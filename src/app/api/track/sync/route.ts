import { NextResponse } from "next/server";
import { gateTrackerAdminApi } from "@/lib/tracker/gate";
import { ConfigError } from "@/lib/tracker/config";
import { syncAll, syncEvent } from "@/lib/tracker/sync";
import { bad, readJson, slugOk } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/track/sync — admin only. Body { slug?: string, force?: boolean }.
 * Upserts events/*.yaml (one event, or every file) into the Tracker* tables;
 * the same code as `npm run track:sync`. There is no startup hook on
 * serverless, so this is how a deployed config edit reaches the database.
 */
export async function POST(req: Request) {
  const gate = await gateTrackerAdminApi();
  if (gate) return gate;
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const b = (typeof body === "object" && body !== null ? body : {}) as { slug?: unknown; force?: unknown };
  const force = b.force === true;
  const slug = typeof b.slug === "string" ? b.slug.trim() : "";
  if (slug && !slugOk(slug)) return bad("bad slug");
  try {
    if (slug) {
      const summary = await syncEvent(slug, { force });
      return NextResponse.json({ ok: true, events: [summary] });
    }
    const events = await syncAll({ force });
    return NextResponse.json({ ok: events.every((e) => !e.error), events });
  } catch (err) {
    if (err instanceof ConfigError) return NextResponse.json({ ok: false, error: err.message, problems: err.problems }, { status: 400 });
    console.error("track sync failed", err);
    return bad("Sync failed — see the server log.", 500);
  }
}
