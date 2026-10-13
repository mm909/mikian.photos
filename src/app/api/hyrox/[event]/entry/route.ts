import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { categoryLabel, dayOf, eventBySlug, isClosed, partnersToColumns, readEntry, shortDay } from "@/app/hyrox/events";

/* /api/hyrox/<event>/entry — someone says what they are racing (owner,
 * 2026-10-13). Signed in with Google; the email on the row is the
 * account's. An account can hold several entries on one event (a singles
 * Saturday and a doubles Sunday), capped so the board cannot be flooded.
 *
 *   POST   { id?, name, instagram?, format, division, gender, day,
 *            partners?: [{ name, instagram? }], startTime? }
 *          With `id`, an update of that account's own entry; without, a
 *          new one. Every save emails the owner; the row is the truth and
 *          a failed email is logged, never surfaced.
 *   DELETE { id } — takes that account's own entry off the board.
 *
 * IN DEVELOPMENT (CLAUDE.md): admin-only in production, with the page. */
export const runtime = "nodejs";

const MAX_PER_ACCOUNT = 6;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function gate(slug: string) {
  const ev = eventBySlug(slug);
  if (!ev) return { res: new NextResponse(null, { status: 404 }) } as const;
  const actor = await getEffectiveActor();
  if (process.env.NODE_ENV === "production" && !(actor && isAdmin(actor))) {
    return { res: new NextResponse(null, { status: 404 }) } as const;
  }
  if (!actor) return { res: bad("Sign in with Google first.", 401) } as const;
  if (isClosed(ev)) return { res: bad("Sign-ups closed — the race has been run.", 410) } as const;
  const limit = await rateLimit({ key: `hyrox-entry:${actor.photographerId}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return { res: bad("Too many saves at once — try again in a bit.", 429) } as const;
  return { ev, actor } as const;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: { params: { event: string } }) {
  const g = await gate(params.event);
  if ("res" in g) return g.res;
  const { ev, actor } = g;

  const body = await readBody(req);
  if (!body) return bad("invalid JSON body");
  const read = readEntry(ev, body);
  if (!read.ok) return bad(read.error);
  const entry = read.entry;
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim().slice(0, 64) : null;
  const { partners, ...rest } = entry;
  const data = { ...rest, ...partnersToColumns(partners), email: actor.email };

  let created = false;
  let saved: { id: string } | null = null;
  try {
    if (id) {
      const own = await db.hyroxEntry.findFirst({ where: { id, event: ev.slug, userId: actor.photographerId }, select: { id: true } });
      if (!own) return bad("That entry is not yours to change.", 404);
      saved = await db.hyroxEntry.update({ where: { id }, data, select: { id: true } });
    } else {
      const count = await db.hyroxEntry.count({ where: { event: ev.slug, userId: actor.photographerId } });
      if (count >= MAX_PER_ACCOUNT) return bad(`That is ${MAX_PER_ACCOUNT} races on one weekend — edit one instead.`);
      created = true;
      saved = await db.hyroxEntry.create({ data: { event: ev.slug, userId: actor.photographerId, ...data }, select: { id: true } });
    }
  } catch (err) {
    console.error("hyrox: entry save failed (table pushed?)", err);
    return bad("Couldn't save that — has the table been pushed?", 503);
  }

  const d = dayOf(ev, entry.day);
  const count = await db.hyroxEntry.count({ where: { event: ev.slug } }).catch(() => 0);
  const withWho = partners.length ? partners.map((p) => p.name + (p.instagram ? ` (@${p.instagram})` : "")).join(", ") : "—";
  const text =
    `${entry.name} ${created ? "is racing" : "updated their entry"}: ${categoryLabel(entry)}, ${d ? shortDay(d) : entry.day}.\n` +
    `With: ${withWho}\n` +
    `Start: ${entry.startTime || "—"}\n` +
    `Instagram: ${entry.instagram ? "@" + entry.instagram : "—"}\n` +
    `Email: ${actor.email}\n\n` +
    `${count} ${count === 1 ? "entry" : "entries"} on the board.\n` +
    `— sent from the ${ev.name} page`;
  const sent = await sendOwnerNotification(`${ev.name} — ${entry.name}${created ? "" : " (updated)"}`, text, actor.email);
  if (!sent.ok) console.warn(`[hyrox] saved but email failed: ${sent.error}`);

  return NextResponse.json({ ok: true, created, entry: { id: saved.id, ...entry } });
}

export async function DELETE(req: Request, { params }: { params: { event: string } }) {
  const g = await gate(params.event);
  if ("res" in g) return g.res;
  const { ev, actor } = g;

  const body = await readBody(req);
  const id = body && typeof body.id === "string" ? body.id.trim().slice(0, 64) : "";
  if (!id) return bad("Which entry?");
  try {
    const gone = await db.hyroxEntry.deleteMany({ where: { id, event: ev.slug, userId: actor.photographerId } });
    if (gone.count === 0) return bad("That entry is not yours to remove.", 404);
  } catch (err) {
    console.error("hyrox: entry delete failed", err);
    return bad("Couldn't remove that — try again.", 503);
  }
  return NextResponse.json({ ok: true });
}
