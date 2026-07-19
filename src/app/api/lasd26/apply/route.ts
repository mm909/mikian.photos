import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { requireRole } from "@/lib/permissions";
import { clientIp, rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/lasd26/apply — the "Put your name in" form on /lasd26.
 * Body: { name, email, instagram?, role }. Saves the application, then emails
 * the crew captains (name in the subject, role + email + instagram + the full
 * pile-so-far in the body). The DB row is the source of truth; a failed email is logged, not
 * surfaced — the applicant shouldn't retry (and duplicate) because Resend
 * hiccuped.
 */
export const runtime = "nodejs";

const CREW_EMAILS = ["mikianmusser@gmail.com", "justfriends.lasvegas@gmail.com"];
const PAGE = "lasd26";
const ROLES = new Set(["Runner", "Crew", "Either"]);

/** Optional field: "@handle", "handle", or a pasted profile URL → bare handle. */
function igHandle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let h = raw.trim();
  const m = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) h = m[1];
  return h.replace(/^@+/, "").slice(0, 64);
}

export async function POST(req: Request) {
  let body: { name?: unknown; email?: unknown; instagram?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const instagram = igHandle(body.instagram);
  const role = typeof body.role === "string" && ROLES.has(body.role) ? body.role : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "Add your name first." }, { status: 400 });
  }
  if (email.length > 200 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Add an email so we can reach you." },
      { status: 400 }
    );
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

  await db.crewApplication.create({ data: { page: PAGE, name, email, instagram, role } });

  const all = await db.crewApplication.findMany({
    where: { page: PAGE },
    orderBy: { createdAt: "asc" },
    select: { name: true, role: true, email: true, instagram: true },
  });
  const pile = all
    .map(
      (a, i) =>
        `${i + 1}. ${a.name} — ${a.role}${a.email ? ` — ${a.email}` : ""}${
          a.instagram ? ` — @${a.instagram}` : ""
        }`
    )
    .join("\n");

  const text =
    `${name} put their name in.\n` +
    `Role: ${role}\n` +
    `Email: ${email}\n` +
    `Instagram: ${instagram ? `@${instagram}` : "—"}\n\n` +
    `The pile so far (${all.length}):\n${pile}\n\n` +
    `— sent from the LASD26 crew call page`;

  const sent = await sendOwnerNotification(
    `LASD26 crew — ${name}`,
    text,
    email,
    CREW_EMAILS
  );
  if (!sent.ok) {
    console.warn(`[lasd26] application saved but email failed: ${sent.error}`);
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/lasd26/apply — owner only: wipe the applicant list. */
export async function DELETE() {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }
  const res = await db.crewApplication.deleteMany({ where: { page: PAGE } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
