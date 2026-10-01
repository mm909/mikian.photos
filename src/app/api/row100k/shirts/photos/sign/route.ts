import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2PresignPut } from "@/lib/r2";
import { parseColor } from "@/app/row100k/shirtPreorder";
import { SHIRT_PHOTO_KEY_RE, SHIRT_PHOTO_TAG, colorOfKey } from "@/app/row100k/shirtPhotos";
import { thumbKey } from "@/app/row100k/photoUrls";

export const runtime = "nodejs";

/* Mint a presigned PUT for one shirt photo (owner, 2026-10-01: a carousel
 * he can post photos into). The gallery sign route's twin
 * (api/row100k/gallery/sign): admin-only, jpeg / png / webp, 12 MB, the
 * exact byte count in the signature, and a thumbFor branch that mints the
 * small jpeg beside a photo already landed. The one difference is the
 * folder — { color: "black" | "cream" } picks it — and a thumb's colour is
 * read off the key it is for, never off the body. Every mint drops the
 * listing cache (SHIRT_PHOTO_TAG), the gallery's reasoning. */

const MAX_PHOTO_BYTES = 12_000_000;

const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  const ext = TYPES[contentType];
  if (!ext) {
    return NextResponse.json({ ok: false, error: "Photos only — jpeg, png or webp." }, { status: 400 });
  }
  const contentLength = typeof body.contentLength === "number" ? Math.round(body.contentLength) : NaN;
  if (!Number.isFinite(contentLength) || contentLength < 1 || contentLength > MAX_PHOTO_BYTES) {
    return NextResponse.json({ ok: false, error: "That photo is too big — 12 MB max." }, { status: 400 });
  }

  const limit = await rateLimit({
    key: `row100k-shirt-photo-sign:${actor.photographerId}`,
    limit: 300,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const thumbFor = typeof body.thumbFor === "string" ? body.thumbFor : null;
  if (thumbFor) {
    if (!SHIRT_PHOTO_KEY_RE.test(thumbFor) || /\.thumb\.[a-z0-9]+$/i.test(thumbFor) || !colorOfKey(thumbFor)) {
      return NextResponse.json({ ok: false, error: "Not a shirt photo." }, { status: 400 });
    }
    if (contentType !== "image/jpeg" || contentLength > 1_000_000) {
      return NextResponse.json({ ok: false, error: "Thumbs are small jpegs only." }, { status: 400 });
    }
    const key = thumbKey(thumbFor);
    const url = await r2PresignPut(key, contentType, 600, contentLength);
    revalidateTag(SHIRT_PHOTO_TAG);
    return NextResponse.json({ ok: true, key, url });
  }

  const color = parseColor(body.color);
  if (!color) return NextResponse.json({ ok: false, error: "Which shirt?" }, { status: 400 });
  const key = `row100k/shirts/${color}/${randomUUID()}.${ext}`;
  const url = await r2PresignPut(key, contentType, 600, contentLength);
  revalidateTag(SHIRT_PHOTO_TAG);
  return NextResponse.json({ ok: true, key, url });
}
