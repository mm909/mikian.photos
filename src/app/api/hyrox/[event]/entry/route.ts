import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { categoryLabel, dayOf, eventBySlug, isClosed, partnersToColumns, readCategory, readEntry, shortDay } from "@/app/hyrox/events";
import { ROW, type Row, refreshRecord, rowOut } from "@/app/hyrox/row";

/* /api/hyrox/<event>/entry — someone says what they are racing (owner,
 * 2026-10-13). Signed in with Google; the email on the row is the
 * account's. An account can hold several entries on one event (a singles
 * Saturday and a doubles Sunday), capped so the board cannot be flooded.
 *
 *   POST   { id?, name, instagram?, format, division, gender, day,
 *            partners?: [{ name, instagram? }], startTime?, confirmed? }
 *          With `id`, an update of that account's own entry; without, a
 *          new one. Every save emails the owner; the row is the truth and
 *          a failed email is logged, never surfaced.
 *          THE OWNER EDITS ANY ENTRY (owner, 2026-10-15: "on the list,
 *          give me an edit button"): with `id`, the admin may update
 *          anyone's row, and only he writes a start time before the
 *          event opens them (events.ts readEntry: Taken). A rower
 *          re-saving their own entry never blanks what the owner put on
 *          it, and the row's email stays the rower's.
 *          THE RECORD comes from hyresult.com on every save (record.ts:
 *          prior races in the category, the PR, the published wave, and
 *          after the race the finish) — fail-open: hyresult down means
 *          the row saves without it and REFRESH on the list tries again.
 *          THE SAME NAME TWICE (owner, 2026-10-14: "be prepped to handle
 *          cases where both partners fill it out ... just a confirm box
 *          that notices that racers with the same name were put on the
 *          list"): a name on the new entry — the racer's or a partner's
 *          — that another account's entry already carries comes back as
 *          409 { duplicate: [...] } until the form sends `confirmed`.
 *   DELETE { id } — takes that account's own entry off the board; the
 *          admin may take any entry off ("allow me, only me, to remove
 *          any entries").
 *
 * Public, with the page (owner, 2026-10-13: no gate). */
export const runtime = "nodejs";

const MAX_PER_ACCOUNT = 6;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function gate(slug: string) {
  const ev = eventBySlug(slug);
  if (!ev) return { res: new NextResponse(null, { status: 404 }) } as const;
  const actor = await getEffectiveActor();
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
  const admin = isAdmin(actor);
  const read = readEntry(ev, body, { admin });
  if (!read.ok) return bad(read.error);
  const entry = read.entry;
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim().slice(0, 64) : null;
  const { partners, startTime, ...rest } = entry;
  const data = {
    ...rest,
    ...partnersToColumns(partners),
    ...(read.taken.startTime ? { startTime } : {}),
  };

  /* The names this entry carries, against every other account's entries
   * on the event. A match is a reason to ask, not to refuse. Not on the
   * owner's edit of someone else's row: its own names would match. */
  if (body.confirmed !== true && !(admin && id)) {
    const norm = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim();
    const mine = new Set([entry.name, ...partners.map((p) => p.name)].map(norm).filter(Boolean));
    try {
      const others = await db.hyroxEntry.findMany({
        where: { event: ev.slug, userId: { not: actor.photographerId } },
        select: { id: true, name: true, partners: true, format: true, division: true, gender: true, day: true },
      });
      const duplicate = others
        .map((o) => {
          const hits = [o.name, ...o.partners].filter((n) => mine.has(norm(n)));
          if (hits.length === 0) return null;
          const cat = readCategory(o.format, o.division, o.gender);
          const d = dayOf(ev, o.day);
          return { names: hits, entry: [o.name, ...o.partners].join(" & "), category: cat ? categoryLabel(cat) : "", day: d ? shortDay(d) : o.day };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (duplicate.length > 0) return NextResponse.json({ ok: false, duplicate }, { status: 409 });
    } catch (err) {
      console.error("hyrox: duplicate check failed", err);
    }
  }

  let created = false;
  let own = true;
  let saved: Row | null = null;
  try {
    if (id) {
      const where = admin ? { id, event: ev.slug } : { id, event: ev.slug, userId: actor.photographerId };
      const found = await db.hyroxEntry.findFirst({ where, select: { id: true, userId: true } });
      if (!found) return bad("That entry is not yours to change.", 404);
      own = found.userId === actor.photographerId;
      saved = await db.hyroxEntry.update({ where: { id }, data: own ? { ...data, email: actor.email } : data, select: ROW });
    } else {
      const count = await db.hyroxEntry.count({ where: { event: ev.slug, userId: actor.photographerId } });
      if (count >= MAX_PER_ACCOUNT) return bad(`That is ${MAX_PER_ACCOUNT} races on one weekend — edit one instead.`);
      created = true;
      saved = await db.hyroxEntry.create({ data: { event: ev.slug, userId: actor.photographerId, ...data, email: actor.email }, select: ROW });
    }
  } catch (err) {
    console.error("hyrox: entry save failed (table pushed?)", err);
    return bad("Couldn't save that — has the table been pushed?", 503);
  }

  /* THE RECORD, from hyresult, on every save; the row is saved either way. */
  saved = (await refreshRecord(ev, saved)) ?? saved;
  const row = rowOut(saved, entry);

  const d = dayOf(ev, row.day);
  const count = await db.hyroxEntry.count({ where: { event: ev.slug } }).catch(() => 0);
  const withWho = row.partners.length ? row.partners.map((p) => p.name + (p.instagram ? ` (@${p.instagram})` : "")).join(", ") : "—";
  const did = created ? "is racing" : own ? "updated their entry" : "— entry edited by the owner";
  const record =
    saved.recordAt === null
      ? "not looked up (hyresult unreachable)"
      : [row.priorRaces === 0 ? "debut" : "not a debut", row.pr ? `PR ${row.pr}` : "", row.finishTime ? `finish ${row.finishTime}` : ""].filter(Boolean).join(", ") +
        ` (hyresult.com/athlete/${saved.hyresultSlug})`;
  const text =
    `${row.name} ${did}: ${categoryLabel(row)}, ${d ? shortDay(d) : row.day}.\n` +
    `With: ${withWho}\n` +
    `Start: ${row.startTime || "—"}\n` +
    `Record: ${record}\n` +
    `Instagram: ${row.instagram ? "@" + row.instagram : "—"}\n` +
    `Email: ${saved.email}\n\n` +
    `${count} ${count === 1 ? "entry" : "entries"} on the board.\n` +
    `— sent from the ${ev.name} page`;
  const sent = await sendOwnerNotification(`${ev.name} — ${row.name}${created ? "" : own ? " (updated)" : " (edited by you)"}`, text, saved.email);
  if (!sent.ok) console.warn(`[hyrox] saved but email failed: ${sent.error}`);

  return NextResponse.json({ ok: true, created, entry: row });
}

export async function DELETE(req: Request, { params }: { params: { event: string } }) {
  const g = await gate(params.event);
  if ("res" in g) return g.res;
  const { ev, actor } = g;

  const body = await readBody(req);
  const id = body && typeof body.id === "string" ? body.id.trim().slice(0, 64) : "";
  if (!id) return bad("Which entry?");
  try {
    const where = isAdmin(actor) ? { id, event: ev.slug } : { id, event: ev.slug, userId: actor.photographerId };
    const gone = await db.hyroxEntry.deleteMany({ where });
    if (gone.count === 0) return bad("That entry is not yours to remove.", 404);
  } catch (err) {
    console.error("hyrox: entry delete failed", err);
    return bad("Couldn't remove that — try again.", 503);
  }
  return NextResponse.json({ ok: true });
}
