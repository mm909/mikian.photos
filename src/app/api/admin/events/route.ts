import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import {
  isAccessMode,
  isEventStatus,
  isEventType,
  isValidEventSlug,
  slugifyEventName,
  defaultsForType,
} from "@/lib/eventConfig";
import { adminEventShape, mintSecretLinkToken, MAX_PRICE_CENTS } from "@/lib/eventAdmin";

/**
 * Owner-only event management.
 *
 *   GET  /api/admin/events            → every event with full config + counts
 *   POST /api/admin/events            → create an event
 *
 * Event creation is OWNER-only for now (the capability is permission-gated so a
 * future role could be allowed by relaxing this one line). See per-event config
 * + photographer-access endpoints under /api/admin/events/[id].
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }
  const rows = await db.event.findMany({
    orderBy: { date: "desc" },
    include: { _count: { select: { photos: true, eventPhotographers: true } } },
  });
  return NextResponse.json({ events: rows.map(adminEventShape) });
}

export async function POST(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id =
    typeof body.id === "string" && body.id.trim() ? body.id.trim() : slugifyEventName(name);
  if (!isValidEventSlug(id)) {
    return NextResponse.json(
      { error: "slug must be lowercase letters, numbers, and hyphens" },
      { status: 400 }
    );
  }
  const existing = await db.event.findUnique({ where: { id }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: `An event with slug "${id}" already exists` }, { status: 409 });
  }

  const date = new Date(typeof body.date === "string" ? body.date : "");
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "valid date is required" }, { status: 400 });
  }

  // Event type drives the capability defaults; any explicitly-supplied toggle
  // still wins over the per-type default.
  const type = isEventType(body.type) ? body.type : "race";
  const defaults = defaultsForType(type);
  const status = isEventStatus(body.status) ? body.status : "draft";
  const accessMode = isAccessMode(body.accessMode) ? body.accessMode : defaults.accessMode;
  const isFree = typeof body.isFree === "boolean" ? body.isFree : defaults.isFree;
  const ocrEnabled =
    typeof body.ocrEnabled === "boolean" ? body.ocrEnabled : defaults.ocrEnabled;
  const faceRecEnabled =
    typeof body.faceRecEnabled === "boolean" ? body.faceRecEnabled : defaults.faceRecEnabled;
  const colorGroupEnabled =
    typeof body.colorGroupEnabled === "boolean"
      ? body.colorGroupEnabled
      : defaults.colorGroupEnabled;

  let bundlePriceCents: number | null = null;
  if (body.bundlePriceCents != null) {
    const cents = Number(body.bundlePriceCents);
    if (!Number.isInteger(cents) || cents < 0 || cents > MAX_PRICE_CENTS) {
      return NextResponse.json({ error: "bundlePriceCents out of range" }, { status: 400 });
    }
    bundlePriceCents = cents;
  }

  const ev = await db.event.create({
    data: {
      id,
      name,
      date,
      city: typeof body.city === "string" ? body.city : "",
      org: typeof body.org === "string" ? body.org : "",
      type,
      status,
      accessMode,
      isFree,
      ocrEnabled,
      faceRecEnabled,
      colorGroupEnabled,
      bundlePriceCents,
      // Creator owns the event (platform owner for now; clients later).
      ownerId: actor.photographerId,
      secretLinkToken:
        accessMode === "secure-link" || accessMode === "private"
          ? mintSecretLinkToken()
          : null,
    },
    include: { _count: { select: { photos: true, eventPhotographers: true } } },
  });

  return NextResponse.json({ event: adminEventShape(ev) }, { status: 201 });
}
