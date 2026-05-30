/**
 * Owner-only bundle pricing.
 *
 *   GET   /api/admin/pricing[?eventId=…]   → { eventId, priceCents, priceDollars, isDefault }
 *   PATCH /api/admin/pricing  { priceCents, eventId? }  → same shape after write
 *
 * Price is stored on Event.bundlePriceCents (whole cents). When unset the
 * resolver falls back to the static `prices.bundle` default — GET reports that
 * via `isDefault: true` so the editor can show it's not yet customized.
 *
 * This is the authoritative price the checkout charges (see
 * /api/paypal/create-order) and the runner UI displays (see /api/photos).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { currentEvent } from "@/lib/data";
import {
  resolveBundlePriceCents,
  centsToDollars,
  defaultBundlePriceCents,
} from "@/lib/pricing";

export const runtime = "nodejs";

// Sanity bounds so a fat-fingered entry can't set a $0 or absurd price.
const MIN_PRICE_CENTS = 0;
const MAX_PRICE_CENTS = 1_000_00; // $1,000

async function readPayload(eventId: string) {
  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { bundlePriceCents: true },
  });
  const explicit =
    typeof ev?.bundlePriceCents === "number" ? ev.bundlePriceCents : null;
  const priceCents = explicit ?? (await resolveBundlePriceCents(eventId));
  return {
    eventId,
    priceCents,
    priceDollars: centsToDollars(priceCents),
    isDefault: explicit == null,
    defaultDollars: centsToDollars(defaultBundlePriceCents()),
  };
}

export async function GET(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId") || currentEvent.id;
  return NextResponse.json(await readPayload(eventId));
}

export async function PATCH(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  let body: { priceCents?: unknown; eventId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const priceCents = Number(body.priceCents);
  if (!Number.isFinite(priceCents) || !Number.isInteger(priceCents)) {
    return NextResponse.json(
      { error: "priceCents must be a whole number of cents" },
      { status: 400 }
    );
  }
  if (priceCents < MIN_PRICE_CENTS || priceCents > MAX_PRICE_CENTS) {
    return NextResponse.json(
      { error: `priceCents out of range (0–${MAX_PRICE_CENTS})` },
      { status: 400 }
    );
  }

  const eventId =
    typeof body.eventId === "string" && body.eventId ? body.eventId : currentEvent.id;

  try {
    await db.event.update({
      where: { id: eventId },
      data: { bundlePriceCents: priceCents },
    });
  } catch {
    return NextResponse.json({ error: "Unknown eventId" }, { status: 404 });
  }

  return NextResponse.json(await readPayload(eventId));
}
