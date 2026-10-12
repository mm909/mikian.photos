import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CLOSE_MS, PHOTO_KEY_RE, RACE, RACE_SHORT, cleanPhone, igHandle, isClosed } from "@/app/longhorn-lms/race";

/* POST /api/longhorn-lms/signup — a runner tells the owner they are running
 * (owner, 2026-10-12). Signed in with Google; one row per account per race,
 * so a second send is an update (the bib, usually, once they have one).
 * Body: { name, email, phone, instagram, bib?, expectedLoops?, photoKey }.
 * The photo is a key this account minted through ../photo/sign — the
 * prefix check is what stops one runner attaching another's upload. Every
 * save emails the owner; the row is the truth and a failed email is
 * logged, never surfaced.
 *
 * IN DEVELOPMENT (CLAUDE.md): owner-only in production, with the page. */
export const runtime = "nodejs";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (process.env.NODE_ENV === "production" && !(actor && isOwner(actor))) {
    return new NextResponse(null, { status: 404 });
  }
  if (!actor) return bad("Sign in with Google first.", 401);
  if (isClosed()) return bad("Sign-ups closed three days after the start.", 410);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("invalid JSON body");
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const phone = cleanPhone(body.phone);
  const instagram = igHandle(body.instagram);
  const bib = typeof body.bib === "string" ? body.bib.trim().replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) : "";
  const photoKey = typeof body.photoKey === "string" ? body.photoKey.trim() : "";
  const loopsRaw = body.expectedLoops;
  const expectedLoops =
    loopsRaw === null || loopsRaw === undefined || loopsRaw === ""
      ? null
      : Number.isInteger(Number(loopsRaw)) && Number(loopsRaw) >= 1 && Number(loopsRaw) <= 200
        ? Number(loopsRaw)
        : NaN;

  if (!name) return bad("Add your name first.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad("Add an email I can reach you at.");
  if (phone.replace(/\D/g, "").length < 7) return bad("Add a phone number.");
  if (!instagram) return bad("Add your Instagram — that is where the photos go.");
  if (Number.isNaN(expectedLoops)) return bad("Loops is a whole number, 1 to 200.");
  if (!PHOTO_KEY_RE.test(photoKey) || !photoKey.startsWith(`${RACE}/${actor.photographerId}/`)) {
    return bad("Add a photo of yourself so I know who to look for.");
  }

  const limit = await rateLimit({ key: `longhorn-signup:${actor.photographerId}`, limit: 20, windowSec: 3600 });
  if (!limit.ok) return bad("Too many saves at once — try again in a bit.", 429);

  let created = false;
  try {
    const existing = await db.raceRunnerSignup.findUnique({
      where: { race_userId: { race: RACE, userId: actor.photographerId } },
      select: { id: true },
    });
    created = !existing;
    await db.raceRunnerSignup.upsert({
      where: { race_userId: { race: RACE, userId: actor.photographerId } },
      create: { race: RACE, userId: actor.photographerId, name, email, phone, instagram, bib, photoKey, expectedLoops },
      update: { name, email, phone, instagram, bib, photoKey, expectedLoops },
    });
  } catch (err) {
    console.error("longhorn-lms: signup save failed (table pushed?)", err);
    return bad("Couldn't save that — has the table been pushed?", 503);
  }

  const count = await db.raceRunnerSignup.count({ where: { race: RACE } }).catch(() => 0);
  const text =
    `${name} ${created ? "is running" : "updated their entry"}.\n` +
    `Instagram: @${instagram}\n` +
    `Email: ${email}\n` +
    `Phone: ${phone}\n` +
    `Bib: ${bib || "—"}\n` +
    `Expected loops: ${expectedLoops ?? "—"}\n\n` +
    `${count} runner${count === 1 ? "" : "s"} on the list. Closes ${new Date(CLOSE_MS).toUTCString()}.\n` +
    `— sent from the ${RACE_SHORT} page`;
  const sent = await sendOwnerNotification(`${RACE_SHORT} — ${name}${created ? "" : " (updated)"}`, text, email);
  if (!sent.ok) console.warn(`[longhorn-lms] saved but email failed: ${sent.error}`);

  return NextResponse.json({ ok: true, created });
}
