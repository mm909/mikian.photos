import { NextResponse } from "next/server";
import { ensureOwnerMember, getTeamViewer, type TeamViewer } from "@/lib/lasd26/team";
import {
  MAX_LABEL,
  MAX_VALUE,
  addInfoNote,
  cleanLabel,
  isNoteKey,
  listInfoItems,
  parseKey,
  removeInfoItem,
  updateInfoValue,
  type InfoItem,
} from "@/lib/lasd26/info";

/**
 * /api/lasd26/info — the info sheet (owner, 2026-10-16: "make a info page
 * where we can fill out addresses for airbnb, start line, van pick up
 * etc."; that night: "Allow me to add / remove notes on the info page.
 * Make the info page live."). All JSON; every method wants a sign-in (401)
 * and a place on the team (403); the writes are the owner's (403).
 *   GET    (team)  → { ok, items: [{ key, label, value, hint, sortOrder,
 *                    updatedAt, updatedById }] } — the live lines, in sheet
 *                    order, seeded from DEFAULT_ITEMS on first read.
 *   PATCH  (owner) { key, value, label? } → { ok, item }: saves one line's
 *                    value. `label` is honoured for a NOTE only (key "n-…");
 *                    on a built-in line it is 400 — the list names those.
 *                    404 for a key unknown or removed.
 *   POST   (owner) { label, value? } → 201 { ok, item }: a new note, after
 *                    the built-in lines.
 *   DELETE (owner) { key } → { ok, key }: removes the line, built-in or
 *                    note alike (a soft delete — it is never seeded again).
 *                    404 unknown or already removed.
 *
 * LIVE since 2026-10-16 (night): the production owner-only check that
 * wore the dev gate is gone from every method, as it is from the page.
 */
export const runtime = "nodejs";

function wire(item: InfoItem) {
  return { ...item, updatedAt: item.updatedAt.toISOString() };
}

const signIn = () => NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
const notOnTeam = () => NextResponse.json({ ok: false, error: "Not on the team — you need the invite link from the group chat." }, { status: 403 });
const ownerOnly = () => NextResponse.json({ ok: false, error: "Only the owner fills in the sheet." }, { status: 403 });
const badJson = () => NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });

/**
 * The owner, with his TeamMember row made on the way in (ensureOwnerMember)
 * so updatedById can name him; or the response that turns anyone else away.
 */
async function ownerForWrite(): Promise<TeamViewer | NextResponse> {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return signIn();
  if (!viewer.owner) return viewer.onTeam ? ownerOnly() : notOnTeam();
  return ensureOwnerMember(viewer);
}

async function readJson<T extends object>(req: Request): Promise<T | null> {
  try {
    const body = (await req.json()) as unknown;
    return body !== null && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}

/** The value as the body carries it, or the 400 that says what is wrong with it. */
function checkValue(v: unknown, required: boolean): string | NextResponse {
  if (v === undefined && !required) return "";
  if (typeof v !== "string") return NextResponse.json({ ok: false, error: "value must be text." }, { status: 400 });
  if (v.length > MAX_VALUE) {
    return NextResponse.json({ ok: false, error: `That is too long — ${MAX_VALUE} characters at most.` }, { status: 400 });
  }
  return v;
}

export async function GET() {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return signIn();
  if (!viewer.onTeam) return notOnTeam();
  try {
    const items = await listInfoItems();
    return NextResponse.json({ ok: true, items: items.map(wire) });
  } catch (err) {
    console.error("lasd26/info GET failed (table pushed?)", err);
    return NextResponse.json({ ok: false, error: "Could not load the sheet." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const viewer = await ownerForWrite();
  if (viewer instanceof NextResponse) return viewer;

  const body = await readJson<{ key?: unknown; value?: unknown; label?: unknown }>(req);
  if (!body) return badJson();

  const key = parseKey(body.key);
  if (!key) return NextResponse.json({ ok: false, error: "key must be a slug like airbnb or van-pick-up." }, { status: 400 });
  const value = checkValue(body.value, true);
  if (value instanceof NextResponse) return value;

  // A note is named by the owner; a built-in line is named by the list.
  let label: string | undefined;
  if (body.label !== undefined && body.label !== null) {
    if (!isNoteKey(key)) return NextResponse.json({ ok: false, error: "The name of a built-in line is fixed." }, { status: 400 });
    const clean = cleanLabel(body.label);
    if (clean === null) return NextResponse.json({ ok: false, error: `The name needs 1 to ${MAX_LABEL} characters.` }, { status: 400 });
    label = clean;
  }

  try {
    const item = await updateInfoValue({ key, value, label, updatedById: viewer.member?.id ?? null });
    if (!item) return NextResponse.json({ ok: false, error: "No such line on the sheet." }, { status: 404 });
    return NextResponse.json({ ok: true, item: wire(item) });
  } catch (err) {
    console.error("lasd26/info PATCH failed", err);
    return NextResponse.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const viewer = await ownerForWrite();
  if (viewer instanceof NextResponse) return viewer;

  const body = await readJson<{ label?: unknown; value?: unknown }>(req);
  if (!body) return badJson();

  const label = cleanLabel(body.label);
  if (label === null) return NextResponse.json({ ok: false, error: `The name needs 1 to ${MAX_LABEL} characters.` }, { status: 400 });
  const value = checkValue(body.value, false);
  if (value instanceof NextResponse) return value;

  try {
    const item = await addInfoNote({ label, value, updatedById: viewer.member?.id ?? null });
    return NextResponse.json({ ok: true, item: wire(item) }, { status: 201 });
  } catch (err) {
    console.error("lasd26/info POST failed", err);
    return NextResponse.json({ ok: false, error: "Could not add the note." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const viewer = await ownerForWrite();
  if (viewer instanceof NextResponse) return viewer;

  const body = await readJson<{ key?: unknown }>(req);
  if (!body) return badJson();

  const key = parseKey(body.key);
  if (!key) return NextResponse.json({ ok: false, error: "key must be a slug like airbnb or van-pick-up." }, { status: 400 });

  try {
    const item = await removeInfoItem({ key });
    if (!item) return NextResponse.json({ ok: false, error: "No such line on the sheet." }, { status: 404 });
    return NextResponse.json({ ok: true, key: item.key });
  } catch (err) {
    console.error("lasd26/info DELETE failed", err);
    return NextResponse.json({ ok: false, error: "Could not remove it." }, { status: 500 });
  }
}
