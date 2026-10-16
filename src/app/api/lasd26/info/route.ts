import { NextResponse } from "next/server";
import { getTeamViewer } from "@/lib/lasd26/team";
import { MAX_VALUE, listInfoItems, parseKey, updateInfoValue, type InfoItem } from "@/lib/lasd26/info";

/**
 * /api/lasd26/info — the info sheet (owner, 2026-10-16: "make a info page
 * where we can fill out addresses for airbnb, start line, van pick up
 * etc.").
 *   GET   (team)  → { ok, items: [{ key, label, value, hint, sortOrder,
 *                   updatedAt, updatedById }] }, in sheet order, seeded
 *                   from DEFAULT_ITEMS on first read.
 *   PATCH (owner) → { key, value } saves one line's value. 404 when the
 *                   key is not on the sheet. Returns the line as saved.
 *
 * THE DEV GATE: the sheet is not live yet (owner: "put it behind a dev
 * gate for now"), so in production both methods answer the owner only —
 * the same 404 the page gives (CLAUDE.md: "any API route that only that
 * page writes through wears the same gate"). When the page goes live, the
 * production check on GET goes and the team reads it.
 */
export const runtime = "nodejs";

function wire(item: InfoItem) {
  return { ...item, updatedAt: item.updatedAt.toISOString() };
}

const devGate404 = () => NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

export async function GET() {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (process.env.NODE_ENV === "production" && !viewer.owner) return devGate404();
  if (!viewer.onTeam) return NextResponse.json({ ok: false, error: "Not on the team — you need the invite link from the group chat." }, { status: 403 });
  try {
    const items = await listInfoItems();
    return NextResponse.json({ ok: true, items: items.map(wire) });
  } catch (err) {
    console.error("lasd26/info GET failed (table pushed?)", err);
    return NextResponse.json({ ok: false, error: "Could not load the sheet." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (process.env.NODE_ENV === "production" && !viewer.owner) return devGate404();
  if (!viewer.owner) return NextResponse.json({ ok: false, error: "Only the owner fills in the sheet." }, { status: 403 });

  let body: { key?: unknown; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const key = parseKey(body.key);
  if (!key) return NextResponse.json({ ok: false, error: "key must be a slug like airbnb or van-pick-up." }, { status: 400 });
  if (typeof body.value !== "string") return NextResponse.json({ ok: false, error: "value must be text." }, { status: 400 });
  if (body.value.length > MAX_VALUE) {
    return NextResponse.json({ ok: false, error: `That is too long — ${MAX_VALUE} characters at most.` }, { status: 400 });
  }

  try {
    const item = await updateInfoValue({ key, value: body.value, updatedById: viewer.member?.id ?? null });
    if (!item) return NextResponse.json({ ok: false, error: "No such line on the sheet." }, { status: 404 });
    return NextResponse.json({ ok: true, item: wire(item) });
  } catch (err) {
    console.error("lasd26/info PATCH failed", err);
    return NextResponse.json({ ok: false, error: "Could not save." }, { status: 500 });
  }
}
