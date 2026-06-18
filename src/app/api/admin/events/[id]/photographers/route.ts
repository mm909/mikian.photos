import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";

/**
 * Per-event photographer access list (owner only).
 *
 *   GET  /api/admin/events/[id]/photographers
 *     → { members: [...], candidates: [...] }
 *       members    = photographers granted upload access to this event
 *       candidates = other photographer-role users you can add
 *   POST /api/admin/events/[id]/photographers  { photographerId? | email? }
 *     → grant access (idempotent on the [eventId, photographerId] unique)
 *
 * Owner + race_director may upload to ANY event implicitly; this list is what
 * lets a plain "photographer" upload to a specific event.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const event = await db.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  const memberships = await db.eventPhotographer.findMany({
    where: { eventId: params.id },
    select: {
      photographerId: true,
      createdAt: true,
      status: true,
      photographer: { select: { id: true, name: true, email: true, roles: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const memberIds = new Set(memberships.map((m) => m.photographerId));

  // How many photos each photographer has uploaded to this event (attribution).
  const counts = await db.photo.groupBy({
    by: ["photographerId"],
    where: { eventId: params.id },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.photographerId, c._count._all]));

  // Candidates: anyone holding the photographer role who isn't already a member.
  const photographers = await db.photographer.findMany({
    where: { roles: { has: "photographer" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const approved = memberships.filter((m) => m.status !== "pending");
  const pending = memberships.filter((m) => m.status === "pending");

  return NextResponse.json({
    members: approved.map((m) => ({
      id: m.photographer.id,
      name: m.photographer.name,
      email: m.photographer.email,
      addedAt: m.createdAt.toISOString(),
      photoCount: countById.get(m.photographerId) ?? 0,
    })),
    // Self-service upload requests awaiting the owner's approval.
    pending: pending.map((m) => ({
      id: m.photographer.id,
      name: m.photographer.name,
      email: m.photographer.email,
      requestedAt: m.createdAt.toISOString(),
    })),
    candidates: photographers
      .filter((p) => !memberIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, email: p.email })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const event = await db.event.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!event) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  let body: { photographerId?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // Resolve the photographer by id or email. Adding by email creates a
  // placeholder row when the person hasn't signed in yet (their first Google
  // sign-in claims it), and ensures the "photographer" role so they pass the
  // upload gate (getEffectivePhotographerId). Owner adds people by email — this
  // is the primary path.
  async function ensurePhotographerRole(id: string, roles: string[]) {
    if (!roles.includes("photographer")) {
      await db.photographer.update({
        where: { id },
        data: { roles: Array.from(new Set([...roles, "photographer"])) },
      });
    }
  }

  let photographerId: string | null = null;
  if (typeof body.photographerId === "string" && body.photographerId) {
    const p = await db.photographer.findUnique({
      where: { id: body.photographerId },
      select: { id: true, roles: true },
    });
    if (p) {
      photographerId = p.id;
      await ensurePhotographerRole(p.id, p.roles);
    }
  } else if (typeof body.email === "string" && body.email) {
    const email = body.email.toLowerCase().trim();
    const p = await db.photographer.upsert({
      where: { email },
      update: {},
      create: { email, name: email.split("@")[0], roles: ["user", "photographer"] },
      select: { id: true, roles: true },
    });
    photographerId = p.id;
    await ensurePhotographerRole(p.id, p.roles);
  }
  if (!photographerId) {
    return NextResponse.json({ error: "Provide a photographer or email" }, { status: 400 });
  }

  // Owner add OR owner approval — both land the membership as "approved" (this
  // is the endpoint the "Approve" button hits for a pending self-request too).
  await db.eventPhotographer.upsert({
    where: { eventId_photographerId: { eventId: params.id, photographerId } },
    update: { status: "approved" },
    create: { eventId: params.id, photographerId, addedBy: actor.email, status: "approved" },
  });
  return NextResponse.json({ ok: true });
}
