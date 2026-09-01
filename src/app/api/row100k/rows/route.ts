import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  MAX_ENTRIES_PER_DAY,
  MAX_ENTRIES_TOTAL,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  isRow100kAdmin,
  nowMs,
  validateEntry,
} from "@/lib/row100k";

export const runtime = "nodejs";

/* Log one rowing session. Requires a session AND a participant row (join
 * first). All the real rules live in validateEntry() in src/lib/row100k.ts. */
export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  const participant = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
  });
  if (!participant) {
    return NextResponse.json(
      { ok: false, error: "Join the challenge first — it takes 30 seconds." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // Challenge admins may log early (pre-Sep test rows on their own account);
  // everyone else gets the real window.
  const check = validateEntry(body, nowMs(), {
    admin: isRow100kAdmin(actor.email, actor.roles),
  });
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  // Photos: exactly two — the rower and the erg screen.
  // Keys must sit under this participant's own upload prefix — the sign
  // route only ever mints keys there, so a forged body can't attach someone
  // else's upload or point a card at an arbitrary object.
  const prefix = `row100k/${CHALLENGE}/${participant.id}/`;
  const rawPhotos = Array.isArray(body.photos) ? body.photos : [];
  const photos = rawPhotos.filter(
    (k): k is string =>
      typeof k === "string" && k.length < 200 && k.startsWith(prefix) && !k.includes(".."),
  );
  if (photos.length !== 2 || rawPhotos.length !== 2) {
    return NextResponse.json(
      { ok: false, error: "Two photos required — you and the screen." },
      { status: 400 },
    );
  }

  const limit = await rateLimit({
    key: `row100k-log:${participant.id}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many logs at once — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // Count-then-create is racy under concurrency, but the 40/hr rate limit
  // above bounds any overshoot to one window — these caps are anti-absurdity
  // guards on an honor-system board, not hard invariants.
  const [dayCount, totalCount] = await Promise.all([
    db.rowEntry.count({ where: { participantId: participant.id, day: check.value.day } }),
    db.rowEntry.count({ where: { participantId: participant.id } }),
  ]);
  if (dayCount >= MAX_ENTRIES_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: `That's already ${MAX_ENTRIES_PER_DAY} sessions on that day — the max.` },
      { status: 400 },
    );
  }
  if (totalCount >= MAX_ENTRIES_TOTAL) {
    return NextResponse.json(
      { ok: false, error: "You've hit the entry cap for the month." },
      { status: 400 },
    );
  }

  // No title typed → "Rowtember #7", numbered by how many rows they'll have.
  const value = check.value.title
    ? check.value
    : { ...check.value, title: `Rowtember #${totalCount + 1}` };

  const entry = await db.rowEntry.create({
    data: { challenge: CHALLENGE, participantId: participant.id, ...value, photos },
  });
  revalidateTag("row100k-boards");

  /* Heads-up to the owner on every logged row (owner call, launch day).
   * Awaited so serverless can't kill it mid-send, but never allowed to fail
   * the log — sendOwnerNotification swallows transport errors itself, and
   * a thrown surprise here is caught and logged. */
  try {
    const totals = await db.rowEntry.aggregate({
      where: { participantId: participant.id },
      _sum: { meters: true },
      _count: true,
    });
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mikianmusser.com").replace(/\/$/, "");
    const total = fmtMeters(totals._sum.meters ?? value.meters);
    // Subject deliberately parallels the join route's "Rowtember signup — …"
    // so rows and signups sort apart at a glance in the same inbox.
    await sendOwnerNotification(
      `Rowtember row — ${fmtRowerNumber(participant.rowerNumber)} ${participant.displayName} · ${fmtMeters(value.meters)} (total ${total})`,
      [
        `Rower ${fmtRowerNumber(participant.rowerNumber)} · ${participant.displayName} logged a row.`,
        ``,
        `This row:  ${fmtMeters(value.meters)} in ${fmtDuration(value.seconds)} (${fmtSplit(value.meters, value.seconds)} /500m)`,
        `Day:       ${value.day}`,
        `Title:     ${value.title}`,
        `New total: ${total} across ${totals._count} sessions`,
        ``,
        `Their page: ${base}/row100k/r/${participant.rowerNumber}`,
        `The feed:   ${base}/row100k/feed`,
        `The stats:  ${base}/row100k/stats`,
      ].join("\n"),
      undefined,
      // Same inbox as the signup emails (OWNER_EMAIL / mikian.photos@gmail.com)
      // unless explicitly rerouted.
      process.env.ROW100K_NOTIFY_EMAIL || undefined,
    );
  } catch (err) {
    console.error("row100k: row-logged notification failed", err);
  }

  return NextResponse.json({ ok: true, id: entry.id });
}
