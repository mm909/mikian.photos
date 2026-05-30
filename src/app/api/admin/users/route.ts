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

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

/**
 * POST /api/admin/users — owner-only. Add an email to an access list.
 *
 * Body: { email: string, role: "photographer" | "race_director" }
 *
 * Works whether or not the person has an account: if no Photographer row
 * exists for the email we create a placeholder (no googleSubject) that their
 * first Google sign-in will claim and inherit the role from (see auth.ts).
 */
export async function POST(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const role = body.role;
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (role !== "photographer" && role !== "race_director") {
    return NextResponse.json(
      { error: "role must be photographer or race_director" },
      { status: 400 }
    );
  }

  const existing = await db.photographer.findUnique({
    where: { email },
    select: { id: true, roles: true },
  });

  if (existing) {
    const roles = new Set(normalizeRoles(existing.roles));
    roles.add("runner");
    roles.add(role);
    await db.photographer.update({
      where: { id: existing.id },
      data: { roles: Array.from(roles), isAdmin: roles.has("owner") },
    });
  } else {
    await db.photographer.create({
      data: {
        email,
        name: email.split("@")[0],
        roles: ["runner", role],
        isAdmin: false,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/users — owner-only. Remove an email from an access list.
 *
 * Body: { email: string, role: "photographer" | "race_director" }
 *
 * Strips the role (back to a plain runner). A never-signed-in placeholder with
 * no photos and no remaining special role is deleted outright; real accounts
 * are kept, just downgraded.
 */
export async function DELETE(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; role?: unknown };
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const role = body.role;
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (role !== "photographer" && role !== "race_director") {
    return NextResponse.json(
      { error: "role must be photographer or race_director" },
      { status: 400 }
    );
  }

  const row = await db.photographer.findUnique({
    where: { email },
    select: {
      id: true,
      roles: true,
      googleSubject: true,
      _count: { select: { photos: true } },
    },
  });
  if (!row) return NextResponse.json({ ok: true }); // already gone

  // Owners hold every role implicitly — don't strip access off an owner here.
  if (normalizeRoles(row.roles).includes("owner")) {
    return NextResponse.json({ error: "Can't change an owner's access here" }, { status: 400 });
  }

  const roles = new Set(normalizeRoles(row.roles));
  roles.delete(role);
  roles.add("runner");
  const onlyRunner = roles.size === 1 && roles.has("runner");

  if (onlyRunner && !row.googleSubject && row._count.photos === 0) {
    await db.photographer.delete({ where: { id: row.id } });
  } else {
    await db.photographer.update({
      where: { id: row.id },
      data: { roles: Array.from(roles), isAdmin: false },
    });
  }

  return NextResponse.json({ ok: true });
}
