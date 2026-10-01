import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2Delete } from "@/lib/r2";
import { SHIRT_PHOTO_KEY_RE, SHIRT_PHOTO_TAG } from "@/app/row100k/shirtPhotos";
import { thumbKey } from "@/app/row100k/photoUrls";

export const runtime = "nodejs";

/* Take one shirt photo off the carousel — the gallery delete route's twin
 * (api/row100k/gallery/delete). Admin-only; the key is the only input and
 * must be exactly row100k/shirts/<color>/<uuid>.<ext>, so nothing else in
 * the bucket can be named. The main object and its thumb go in one bulk
 * delete, and the listing cache is dropped so the owner's refresh does not
 * show the frame he just removed. */

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ ok: false, error: "Photo storage isn't configured on this server." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  const key = typeof body.key === "string" ? body.key : "";
  if (!SHIRT_PHOTO_KEY_RE.test(key) || /\.thumb\.[a-z0-9]+$/i.test(key)) {
    return NextResponse.json({ ok: false, error: "Not a shirt photo." }, { status: 400 });
  }

  const limit = await rateLimit({
    key: `row100k-shirt-photo-delete:${actor.photographerId}`,
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
    console.error("row100k shirts: photo delete failed", key, err);
    return NextResponse.json({ ok: false, error: "Couldn't remove that photo — try again." }, { status: 500 });
  }

  revalidateTag(SHIRT_PHOTO_TAG);
  return NextResponse.json({ ok: true });
}
