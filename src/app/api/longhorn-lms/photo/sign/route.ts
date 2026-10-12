import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2PresignPut } from "@/lib/r2";
import { PHOTO_KEY_RE, RACE } from "@/app/longhorn-lms/race";
import { thumbKey } from "@/app/row100k/photoUrls";

/* Mint a presigned PUT for a runner's own photo (owner, 2026-10-12:
 * "require a photo upload of themselves"). The row-photo sign route's
 * twin: keys under longhorn-lms/<userId>/, the client downscales first,
 * jpeg / png / webp, 8 MB, the byte count in the signature, and a thumbFor
 * branch for the small jpeg beside it (PhotoPair uploadThumbForKey). A
 * runner can only mint under their own id, which is what the signup route
 * checks the key against. Owner-only in production with the page. */
export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 8_000_000;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (process.env.NODE_ENV === "production" && !(actor && isOwner(actor))) {
    return new NextResponse(null, { status: 404 });
  }
  if (!actor) return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
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
  if (!ext) return NextResponse.json({ ok: false, error: "Photos only — jpeg, png or webp." }, { status: 400 });
  const contentLength = typeof body.contentLength === "number" ? Math.round(body.contentLength) : NaN;
  if (!Number.isFinite(contentLength) || contentLength < 1 || contentLength > MAX_PHOTO_BYTES) {
    return NextResponse.json({ ok: false, error: "That photo is too big — 8 MB max." }, { status: 400 });
  }
  const limit = await rateLimit({ key: `longhorn-photo-sign:${actor.photographerId}`, limit: 40, windowSec: 3600 });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "Too many uploads at once — try again in a bit." }, { status: 429 });
  }

  const prefix = `${RACE}/${actor.photographerId}/`;
  const thumbFor = typeof body.thumbFor === "string" ? body.thumbFor : null;
  if (thumbFor) {
    if (!PHOTO_KEY_RE.test(thumbFor) || !thumbFor.startsWith(prefix) || /\.thumb\.[a-z0-9]+$/i.test(thumbFor)) {
      return NextResponse.json({ ok: false, error: "Not your photo." }, { status: 400 });
    }
    if (contentType !== "image/jpeg" || contentLength > 1_000_000) {
      return NextResponse.json({ ok: false, error: "Thumbs are small jpegs only." }, { status: 400 });
    }
    const key = thumbKey(thumbFor);
    const url = await r2PresignPut(key, contentType, 600, contentLength);
    return NextResponse.json({ ok: true, key, url });
  }

  const key = `${prefix}${randomUUID()}.${ext}`;
  const url = await r2PresignPut(key, contentType, 600, contentLength);
  return NextResponse.json({ ok: true, key, url });
}
