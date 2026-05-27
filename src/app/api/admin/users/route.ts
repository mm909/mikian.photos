import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeRoles, requireRole } from "@/lib/permissions";

/**
 * GET /api/admin/users — owner-only.
 *
 * Lists every Photographer row (which is really every signed-in user) with
 * their current roles + photo counts so the owner can see at a glance who
 * has uploaded what.
 */
export const runtime = "nodejs";

export async function GET() {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const rows = await db.photographer.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      googleSubject: true,
      roles: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
  });

  return NextResponse.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roles: normalizeRoles(u.roles),
      googleLinked: Boolean(u.googleSubject),
      photoCount: u._count.photos,
      createdAt: u.createdAt.toISOString(),
      isYou: u.id === actor.photographerId,
    })),
  });
}
