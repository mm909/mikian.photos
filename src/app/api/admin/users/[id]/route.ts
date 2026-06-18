import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ALL_ROLES,
  normalizeRoles,
  requireRole,
  type Role,
} from "@/lib/permissions";

/**
 * PATCH /api/admin/users/[id] — owner-only.
 *
 * Body: { roles: Role[] }
 *
 * Replaces the user's roles. Always ensures "runner" is present so any
 * signed-in user can buy photos. The owner can't strip their own "owner"
 * role (prevents accidental lockout).
 */
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { roles?: unknown };
  if (!Array.isArray(body.roles)) {
    return NextResponse.json({ error: "roles must be an array of role strings" }, { status: 400 });
  }

  // Filter to valid roles only, then ensure the "user" baseline
  const filtered = body.roles.filter(
    (r): r is Role => typeof r === "string" && (ALL_ROLES as readonly string[]).includes(r)
  );
  const rolesSet = new Set<Role>(filtered);
  rolesSet.add("user");
  const nextRoles = Array.from(rolesSet);

  const target = await db.photographer.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, roles: true },
  });
  if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Guard: owner can't demote themselves to non-owner.
  if (target.id === actor.photographerId) {
    const currentRoles = normalizeRoles(target.roles);
    if (currentRoles.includes("owner") && !rolesSet.has("owner")) {
      return NextResponse.json(
        { error: "you can't remove your own owner role" },
        { status: 400 }
      );
    }
  }

  const updated = await db.photographer.update({
    where: { id: params.id },
    data: {
      roles: nextRoles,
      isAdmin: rolesSet.has("owner"),
    },
    select: { id: true, email: true, name: true, roles: true, isAdmin: true },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      roles: normalizeRoles(updated.roles),
    },
  });
}
