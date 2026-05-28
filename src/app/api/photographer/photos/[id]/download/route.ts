import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2PresignGet, r2Keys } from "@/lib/r2";
import { getEffectiveActor, hasRole, isOwner } from "@/lib/permissions";

/**
 * Photographer / admin original-download endpoint.
 *
 * Distinct from /api/photos/[id]/download which is JWT-gated for paying
 * customers — this one is auth-gated for the photographer who owns the
 * photo (or any admin). 302s to a short-lived presigned R2 URL with a
 * Content-Disposition that prompts a download.
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, photographerId: true, r2OriginalKey: true },
  });
  if (!photo) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (photo.photographerId !== actor.photographerId && !isOwner(actor)) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  const key =
    photo.r2OriginalKey && photo.r2OriginalKey !== "pending"
      ? photo.r2OriginalKey
      : r2Keys.original(photo.id);

  // Presigned URL with a Content-Disposition so the browser triggers a save
  // rather than rendering the JPEG inline.
  const signed = await r2PresignGet(key, 900);
  // R2 honors response-content-disposition as a query-string override on
  // presigned URLs; we append it so the file lands with a nice name.
  const url = new URL(signed);
  url.searchParams.set(
    "response-content-disposition",
    `attachment; filename="${photo.id}.jpg"`
  );

  return NextResponse.redirect(url.toString(), 302);
}
