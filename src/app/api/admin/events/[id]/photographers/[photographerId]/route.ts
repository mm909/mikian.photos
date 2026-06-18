import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";

/**
 * DELETE /api/admin/events/[id]/photographers/[photographerId] — owner only.
 * Revoke a photographer's upload access to this event. Their already-uploaded
 * photos are untouched.
 */
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; photographerId: string } }
) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  await db.eventPhotographer
    .delete({
      where: {
        eventId_photographerId: {
          eventId: params.id,
          photographerId: params.photographerId,
        },
      },
    })
    .catch(() => {
      /* already gone — treat as success (idempotent) */
    });
  return NextResponse.json({ ok: true });
}
