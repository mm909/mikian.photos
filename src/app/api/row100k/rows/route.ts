import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { r2Configured, r2Put } from "@/lib/r2";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  MAX_ENTRIES_PER_DAY,
  MAX_ENTRIES_TOTAL,
  nowMs,
  validateEntry,
} from "@/lib/row100k";

export const runtime = "nodejs";

/* Log one rowing session — multipart now, because every row ships with a
 * photo (erg screen, the water, whatever proves the meters — still honor
 * system, but with receipts). The photo is required at the door; if R2 is
 * down or unconfigured the row still logs (a lost photo must never eat
 * someone's meters) and the feed shows a placeholder. All the real number
 * rules live in validateEntry() in src/lib/row100k.ts. */
export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  const participant = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
  });
  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "Join the challenge first — it takes 30 seconds." },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "expected a multipart form (day, meters, seconds, photo)" },
      { status: 400 },
    );
  }

  const body: Record<string, unknown> = {
    day: form.get("day"),
    meters: Number(form.get("meters")),
    seconds: Number(form.get("seconds")),
  };

  const check = validateEntry(body, nowMs());
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json(
      { ok: false, error: "Every row needs a photo — erg screen, the water, anything." },
      { status: 400 },
    );
  }
  // The client shrinks photos before sending; anything past this either
  // skipped that path or isn't an image.
  if (photo.size > 4_000_000) {
    return NextResponse.json(
      { ok: false, error: "That photo is too large — use a JPEG under 4MB." },
      { status: 400 },
    );
  }

  const limit = await rateLimit({
    key: `row100k-log:${participant.id}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many logs at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Count-then-create is racy under concurrency, but the 40/hr rate limit
  // above bounds any overshoot to one window — these caps are anti-absurdity
  // guards on an honor-system board, not hard invariants.
  const [dayCount, totalCount] = await Promise.all([
    db.rowEntry.count({ where: { participantId: participant.id, day: check.value.day } }),
    db.rowEntry.count({ where: { participantId: participant.id } }),
  ]);
  if (dayCount >= MAX_ENTRIES_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: `That's already ${MAX_ENTRIES_PER_DAY} sessions on that day — the max.` },
      { status: 400 },
    );
  }
  if (totalCount >= MAX_ENTRIES_TOTAL) {
    return NextResponse.json(
      { ok: false, error: "You've hit the entry cap for the month." },
      { status: 400 },
    );
  }

  // Normalize + store the photo. Failures downgrade to "no photo" rather
  // than refusing the row — the meters matter more than the picture.
  let photoKey = "";
  if (r2Configured()) {
    try {
      const raw = Buffer.from(await photo.arrayBuffer());
      const jpeg = await sharp(raw)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      photoKey = `row100k/rows/${randomUUID()}.jpg`;
      await r2Put(photoKey, jpeg, "image/jpeg");
    } catch (err) {
      console.error("row100k: photo upload failed, logging row without it", err);
      photoKey = "";
    }
  } else {
    console.warn("row100k: R2 not configured — row logged without its photo");
  }

  const entry = await db.rowEntry.create({
    data: { challenge: CHALLENGE, participantId: participant.id, ...check.value, photoKey },
  });
  revalidateTag("row100k-boards");
  return NextResponse.json({ ok: true, id: entry.id, photo: photoKey !== "" });
}
