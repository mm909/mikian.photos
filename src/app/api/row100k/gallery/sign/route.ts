import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { r2Configured, r2PresignPut } from "@/lib/r2";
import { thumbKey } from "@/app/row100k/photoUrls";

export const runtime = "nodejs";

/* Mint a presigned PUT so the gallery page can push a finished export
 * straight to R2 — no deploy needed, unlike the legacy public/ batch. Keys
 * live under row100k/gallery/ and the gallery page lists that exact prefix,
 * so an upload appears on the next page load. Admin-only: this is the
 * owner's publish surface, not a community drop box. The owner uploads
 * full-resolution exports, hence the larger byte cap than the row-photo
 * route (whose clients downscale first). */

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
  // The exact byte count goes into the signature, so the URL can't be used
  // to park something bigger than the file the client measured.
  const contentLength =
    typeof body.contentLength === "number" ? Math.round(body.contentLength) : NaN;
  if (!Number.isFinite(contentLength) || contentLength < 1 || contentLength > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { ok: false, error: "That photo is too big — 12 MB max." },
      { status: 400 },
    );
  }

  // Generous — the caller is already an admin; this only stops a runaway
  // client loop from minting URLs forever.
  const limit = await rateLimit({
    key: `row100k-gallery-sign:${actor.photographerId}`,
    limit: 300,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many uploads at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  /* thumbFor: park a small jpeg preview beside a gallery photo the admin
   * just uploaded. The thumb key is derived from the main key, never
   * client-chosen, and must stay inside the gallery prefix. */
  const thumbFor = typeof body.thumbFor === "string" ? body.thumbFor : null;
  if (thumbFor) {
    const wellFormed = /^row100k\/gallery\/[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(thumbFor);
    if (!wellFormed || /\.thumb\.[a-z0-9]+$/i.test(thumbFor)) {
      return NextResponse.json({ ok: false, error: "Not a gallery photo." }, { status: 400 });
    }
    if (contentType !== "image/jpeg" || contentLength > 1_000_000) {
      return NextResponse.json(
        { ok: false, error: "Thumbs are small jpegs only." },
        { status: 400 },
      );
    }
    const key = thumbKey(thumbFor);
    const url = await r2PresignPut(key, contentType, 600, contentLength);
    return NextResponse.json({ ok: true, key, url });
  }

  const key = `row100k/gallery/${randomUUID()}.${ext}`;
  const url = await r2PresignPut(key, contentType, 600, contentLength);
  return NextResponse.json({ ok: true, key, url });
}
