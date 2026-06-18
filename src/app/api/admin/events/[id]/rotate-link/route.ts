import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";
import { mintSecretLinkToken } from "@/lib/eventAdmin";

/**
 * POST /api/admin/events/[id]/rotate-link — owner only.
 *
 * Regenerate the secure-link token (invalidates any shared link). Only valid
 * for secure-link events; sets accessMode to secure-link if it wasn't already.
 */
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const existing = await db.event.findUnique({
    where: { id: params.id },
    select: { id: true, accessMode: true },
  });
  if (!existing) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  // Regenerate the token; keep "private" private (don't downgrade to secure-link).
  const mode = existing.accessMode === "private" ? "private" : "secure-link";
  const token = mintSecretLinkToken();
  await db.event.update({
    where: { id: params.id },
    data: { accessMode: mode, secretLinkToken: token },
  });
  return NextResponse.json({ secretLinkToken: token });
}
