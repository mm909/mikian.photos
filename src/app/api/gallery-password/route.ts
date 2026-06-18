import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeAccessMode, normalizeStatus } from "@/lib/eventConfig";
import {
  galleryPasswordCookieName,
  hashGalleryPassword,
} from "@/lib/eventAccess";

/**
 * POST /api/gallery-password — unlock a password-protected gallery.
 *
 * Body: { eventId, password }
 *
 * On a correct password we set an httpOnly unlock cookie (the keyed hash) that
 * both the event page and /api/photos read server-side via resolveEventAccess.
 * The cookie value IS the stored hash, so the access check is a plain string
 * compare — the only KDF runs here, once, at entry.
 *
 * Returns { ok: true } on success, 401 { ok: false } on a wrong password, and
 * 404 when the event isn't actually in password mode (don't confirm details).
 */
export const runtime = "nodejs";

type Body = { eventId?: string; password?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!eventId || !password) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, accessMode: true, galleryPasswordHash: true },
  });
  // Only published, password-mode events with a hash set can be unlocked.
  if (
    !ev ||
    normalizeStatus(ev.status) !== "published" ||
    normalizeAccessMode(ev.accessMode) !== "password" ||
    !ev.galleryPasswordHash
  ) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  const submitted = hashGalleryPassword(ev.id, password);
  if (submitted !== ev.galleryPasswordHash) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(galleryPasswordCookieName(ev.id), ev.galleryPasswordHash, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, mirrors the secure-link cookie
  });
  return res;
}
