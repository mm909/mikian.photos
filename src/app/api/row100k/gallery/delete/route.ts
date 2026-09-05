import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2Delete } from "@/lib/r2";
import { GALLERY_TAG } from "@/app/row100k/galleryList";
import { thumbKey } from "@/app/row100k/photoUrls";

export const runtime = "nodejs";

/* Unpublish one gallery photo. The mirror image of the sign route: that one
 * mints the PUT, this one takes the object back out, so the owner can drop a
 * bad frame from /row100k/gallery without a deploy. Admin-only, same 403 shape.
 *
 * The key is the ONLY input, so its validation is the whole security story:
 * it must sit directly under row100k/gallery/ with a uuid-shaped name and a
 * photo extension. That shuts out row photos (row100k/<challenge>/...), other
 * rowers' uploads, and every other object in the bucket — there is no path
 * traversal to worry about because anything with a slash, a dot or a stray
 * character in the name simply fails the pattern.
 *
 * Both the main object and its thumbKey() sibling go in one bulk delete;
 * deleting a key that does not exist is a no-op in S3/R2, so a photo that
 * never got a thumb is fine. The gallery listing cache is dropped afterwards
 * so the owner's refresh does not show the frame they just removed. */

const GALLERY_KEY_RE = /^row100k\/gallery\/[a-z0-9-]+\.(jpe?g|png|webp)$/i;
const THUMB_RE = /\.thumb\.[a-z0-9]+$/i;

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
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

  const key = typeof body.key === "string" ? body.key : "";
  // A ".thumb." name can't match GALLERY_KEY_RE anyway (the character class
  // has no dot), but the check is explicit so the intent survives an edit to
  // the pattern: thumbs are removed WITH their main, never on their own.
  if (!GALLERY_KEY_RE.test(key) || THUMB_RE.test(key)) {
    return NextResponse.json({ ok: false, error: "Not a gallery photo." }, { status: 400 });
  }

  // Generous — the caller is already an admin; this only stops a runaway
  // client loop from hammering the bucket.
  const limit = await rateLimit({
    key: `row100k-gallery-delete:${actor.photographerId}`,
    limit: 100,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many deletes at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  try {
    await r2Delete([key, thumbKey(key)]);
  } catch (err) {
    console.error("row100k gallery: delete failed", key, err);
    return NextResponse.json(
      { ok: false, error: "Couldn't remove that photo — try again." },
      { status: 500 },
    );
  }

  revalidateTag(GALLERY_TAG);
  return NextResponse.json({ ok: true });
}
