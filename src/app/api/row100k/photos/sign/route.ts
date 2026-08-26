import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2PresignPut } from "@/lib/r2";
import { CHALLENGE } from "@/lib/row100k";

export const runtime = "nodejs";

/* Mint a presigned PUT so the log form can push a session photo straight to
 * R2. Keys live under row100k/<challenge>/<participantId>/ — the rows API
 * only accepts keys with that exact prefix, which is what stops one rower
 * attaching another's upload. The client downscales before upload; the type
 * whitelist below is the server's half of keeping the bucket an image store. */

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
  }
  const participant = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true },
  });
  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "Join the challenge first — it takes 30 seconds." },
      { status: 400 },
    );
  }
  if (!r2Configured()) {
    return NextResponse.json(
      { ok: false, error: "Photo storage isn't configured on this server." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const ext = TYPES[contentType];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "Photos only — jpeg, png or webp." },
      { status: 400 },
    );
  }

  const limit = await rateLimit({
    key: `row100k-photo-sign:${participant.id}`,
    limit: 60,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const key = `row100k/${CHALLENGE}/${participant.id}/${randomUUID()}.${ext}`;
  const url = await r2PresignPut(key, contentType, 600);
  return NextResponse.json({ ok: true, key, url });
}
