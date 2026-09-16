import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  MAX_ENTRIES_PER_DAY,
  MAX_ENTRIES_TOTAL,
  daysElapsed,
  isRow100kAdmin,
  nowMs,
  validateEntry,
} from "@/lib/row100k";
import { siteSettings } from "@/lib/rowSettings";
import { boardDataRaw } from "@/app/row100k/boardData";
import {
  censorFor,
  crossedMilestones,
  freshPublicRow,
  milestoneMail,
  rowLoggedMail,
  type Censor,
  type RowLogged,
} from "@/app/row100k/rowMail";

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
  // guards on an honor-system board, not hard invariants. The meters BEFORE
  // this row ride along for the milestone note below (rowMail.ts): a
  // milestone is a line crossed, so it needs the total on both sides.
  const [dayCount, totalCount, before] = await Promise.all([
    db.rowEntry.count({ where: { participantId: participant.id, day: check.value.day } }),
    db.rowEntry.count({ where: { participantId: participant.id } }),
    db.rowEntry.aggregate({ where: { participantId: participant.id }, _sum: { meters: true } }),
  ]);
  const prevTotal = before._sum.meters ?? 0;
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

  /* Heads-up to the owner on every logged row (owner call, launch day), and
   * a second note when the row crossed a milestone (owner, 2026-09-16). The
   * wording lives in rowMail.ts. Awaited so serverless can't kill it
   * mid-send, but never allowed to fail the log — sendOwnerNotification
   * swallows transport errors itself, and a thrown surprise here is caught
   * and logged. */
  try {
    const totals = await db.rowEntry.aggregate({
      where: { participantId: participant.id },
      _sum: { meters: true },
      _count: true,
    });
    const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://mikianmusser.com").replace(/\/$/, "");
    const totalNow = totals._sum.meters ?? prevTotal + value.meters;
    const logged: RowLogged = {
      name: participant.displayName,
      rowerNumber: participant.rowerNumber,
      meters: value.meters,
      seconds: value.seconds,
      day: value.day,
      title: value.title,
      total: totalNow,
      sessions: totals._count,
      profileUrl: `${base}/row100k/r/${participant.rowerNumber}`,
    };
    // Same inbox as the signup emails (OWNER_EMAIL / mikian.photos@gmail.com)
    // unless explicitly rerouted — both notes go to the same place.
    const notifyTo = process.env.ROW100K_NOTIFY_EMAIL || undefined;

    // The owner is a rower himself, so his inbox is censored like the feed
    // (owner, 2026-09-16): while a window or its run-up is on, the PUBLIC
    // board says whether this rower is hidden. The tag revalidated above
    // lands only after this handler returns, so the cached board is still
    // the one from BEFORE this insert — freshPublicRow lays this row over
    // it and masks the result, so the row that lifts a rower into the
    // elite is judged elite (review, 2026-09-16). A board that cannot be
    // read while a window or run-up is on hides everything (fail closed) —
    // a hiccup must not print an elite rower's numbers. Outside a window
    // the mail is what it always was.
    const blackout = await activeBlackout();
    let censor: Censor = { kind: "none" };
    if (blackout.active || (blackout.hideLow ?? 0) > 0) {
      try {
        const [raw, settings] = await Promise.all([boardDataRaw(), siteSettings()]);
        const row = freshPublicRow(
          raw,
          {
            participantId: participant.id,
            name: participant.displayName,
            division: participant.division,
            rowerNumber: participant.rowerNumber,
            instagram: participant.instagram,
          },
          logged,
          blackout,
          settings.blackout,
        );
        censor = censorFor(row, totalNow, blackout);
      } catch (err) {
        console.error("row100k: board unreadable during a blackout — censoring the row-logged note", err);
        censor = { kind: "full", digits: digitCount(totalNow), why: "unknown" };
      }
    }
    const note = rowLoggedMail(logged, censor);
    await sendOwnerNotification(note.subject, note.text, undefined, notifyTo);

    // The milestone note: censored JUST FOR THE ELITE (owner, 2026-09-16,
    // second telling: "make emails censored just for the elite"). A rower
    // the board hides or rounds gets no milestone note while that lasts,
    // and neither does anybody when the board could not say (both leave
    // `censor` set); everyone else's rung is public on the board already,
    // so their note goes out window or no window. It prints every real
    // number, which is the point of it.
    const crossed = crossedMilestones(prevTotal, totalNow);
    if (crossed.length > 0 && censor.kind === "none") {
      const star = milestoneMail(logged, crossed, daysElapsed());
      await sendOwnerNotification(star.subject, star.text, undefined, notifyTo);
    }
  } catch (err) {
    console.error("row100k: row-logged notification failed", err);
  }

  return NextResponse.json({ ok: true, id: entry.id });
}
