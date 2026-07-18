import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/lasd26/apply — the "Put your name in" form on /lasd26.
 * Body: { name, role }. Saves the application, then emails the crew captain
 * (name in the subject, role + the full pile-so-far in the body). The DB row
 * is the source of truth; a failed email is logged, not surfaced — the
 * applicant shouldn't retry (and duplicate) because Resend hiccuped.
 */
export const runtime = "nodejs";

const CREW_EMAIL = "mikianmusser@gmail.com";
const PAGE = "lasd26";
const ROLES = new Set(["Runner", "Wheels / crew", "Either"]);

export async function POST(req: Request) {
  let body: { name?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const role = typeof body.role === "string" && ROLES.has(body.role) ? body.role : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "Add your name first." }, { status: 400 });
  }
  if (!role) {
    return NextResponse.json({ ok: false, error: "Pick a role." }, { status: 400 });
  }

  // Public endpoint that writes rows + sends email — keep a coarse per-IP lid
  // on it. 5/hour is plenty for a human fixing a typo.
  const limit = await rateLimit({
    key: `lasd26-apply:${clientIp(req)}`,
    limit: 5,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } }
    );
  }

  await db.crewApplication.create({ data: { page: PAGE, name, role } });

  const all = await db.crewApplication.findMany({
    where: { page: PAGE },
    orderBy: { createdAt: "asc" },
    select: { name: true, role: true },
  });
  const pile = all.map((a, i) => `${i + 1}. ${a.name} — ${a.role}`).join("\n");

  const text =
    `${name} put their name in.\n` +
    `Role: ${role}\n\n` +
    `The pile so far (${all.length}):\n${pile}\n\n` +
    `— sent from the LASD26 crew call page`;

  const sent = await sendOwnerNotification(
    `LASD26 crew — ${name}`,
    text,
    undefined,
    CREW_EMAIL
  );
  if (!sent.ok) {
    console.warn(`[lasd26] application saved but email failed: ${sent.error}`);
  }

  return NextResponse.json({ ok: true });
}
