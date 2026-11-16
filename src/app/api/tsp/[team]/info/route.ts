import { NextResponse } from "next/server";
import {
  MAX_LABEL,
  MAX_VALUE,
  addInfoNote,
  cleanLabel,
  isNoteKey,
  listInfoItems,
  parseKey,
  parseOrder,
  removeInfoItem,
  reorderInfoItems,
  updateInfoValue,
  type InfoItem,
} from "@/lib/lasd26/info";
import { bad, badJson, readJson, requireTsp, requireTspCaptain } from "@/lib/tsp/guard";

/**
 * /api/tsp/[team]/info — a TSP team's info sheet (owner, 2026-11-16: "let's
 * just make an info sheet per team … we should have this edit and remove.
 * We also need the add … I should also be able to reorder the notes"). The
 * lasd26 sheet (/api/lasd26/info) with the team read off the address; the
 * gate is lib/tsp/guard (dev gate, sign-in 401, on this team 403, and the
 * writes are a captain's, 403).
 *   GET    (team)    → { ok, items } — the live lines in order, seeded from
 *                      TSP_DEFAULT_ITEMS on first read.
 *   PATCH  (captain) { key, value, label? } → { ok, item }; `label` for a
 *                      note only (400 on a built-in line); 404 unknown/removed.
 *   POST   (captain) { label, value? } → 201 { ok, item }: a new note, last.
 *   PUT    (captain) { order: string[] } → { ok, items }: the order, top to
 *                      bottom; 400 for a key that is not a live line.
 *   DELETE (captain) { key } → { ok, key }: a soft delete.
 * updatedById is the captain's member row, or null for the platform owner
 * when he has not joined the team.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { team: string } };

const wire = (item: InfoItem) => ({ ...item, updatedAt: item.updatedAt.toISOString() });
const KEY_ERR = "key must be a slug like vans or van-pick-up.";

function checkValue(v: unknown, required: boolean): string | NextResponse {
  if (v === undefined && !required) return "";
  if (typeof v !== "string") return bad("value must be text.");
  if (v.length > MAX_VALUE) return bad(`That is too long — ${MAX_VALUE} characters at most.`);
  return v;
}

export async function GET(_req: Request, { params }: Ctx) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  try {
    const items = await listInfoItems(params.team);
    return NextResponse.json({ ok: true, items: items.map(wire) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("tsp/info GET failed (table pushed?)", err);
    return bad("Could not load the sheet.", 500);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireTspCaptain(params.team, "info");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();

  const key = parseKey(body.key);
  if (!key) return bad(KEY_ERR);
  const value = checkValue(body.value, true);
  if (value instanceof NextResponse) return value;

  let label: string | undefined;
  if (body.label !== undefined && body.label !== null) {
    if (!isNoteKey(key)) return bad("The name of a built-in line is fixed.");
    const clean = cleanLabel(body.label);
    if (clean === null) return bad(`The name needs 1 to ${MAX_LABEL} characters.`);
    label = clean;
  }

  try {
    const item = await updateInfoValue({ key, value, label, updatedById: gate.viewer.member?.id ?? null, team: params.team });
    if (!item) return bad("No such line on the sheet.", 404);
    return NextResponse.json({ ok: true, item: wire(item) });
  } catch (err) {
    console.error("tsp/info PATCH failed", err);
    return bad("Could not save.", 500);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const gate = await requireTspCaptain(params.team, "info");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();

  const label = cleanLabel(body.label);
  if (label === null) return bad(`The name needs 1 to ${MAX_LABEL} characters.`);
  const value = checkValue(body.value, false);
  if (value instanceof NextResponse) return value;

  try {
    const item = await addInfoNote({ label, value, updatedById: gate.viewer.member?.id ?? null, team: params.team });
    return NextResponse.json({ ok: true, item: wire(item) }, { status: 201 });
  } catch (err) {
    console.error("tsp/info POST failed", err);
    return bad("Could not add the note.", 500);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  const gate = await requireTspCaptain(params.team, "info");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const order = parseOrder(body.order);
  if (!order) return bad("order must be the list of keys, top to bottom.");

  try {
    const r = await reorderInfoItems({ order, team: params.team });
    if (!r.ok) return bad(`No such line on the sheet: ${r.badKey}.`);
    return NextResponse.json({ ok: true, items: r.items.map(wire) });
  } catch (err) {
    console.error("tsp/info PUT failed", err);
    return bad("Could not save the order.", 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const gate = await requireTspCaptain(params.team, "info");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const key = parseKey(body.key);
  if (!key) return bad(KEY_ERR);

  try {
    const item = await removeInfoItem({ key, team: params.team });
    if (!item) return bad("No such line on the sheet.", 404);
    return NextResponse.json({ ok: true, key: item.key });
  } catch (err) {
    console.error("tsp/info DELETE failed", err);
    return bad("Could not remove it.", 500);
  }
}
