import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { activeBlackout } from "@/lib/blackout";
import { digitCount } from "@/lib/blackoutRules";
import { sendOwnerNotification } from "@/lib/email";
import { notifyRowLogged, ownerWasPushed } from "@/lib/rowNotify";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, MAX_ENTRIES_PER_DAY, MAX_ENTRIES_TOTAL, daysElapsed, defaultRowTitle, type EntryInput } from "@/lib/row100k";
import { monthFromKey, type Month } from "@/lib/rowPeriod";
import { siteSettings } from "@/lib/rowSettings";
import { ROWTEMBER_ORIGIN } from "@/lib/rowSegments";
import { boardDataRaw } from "./boardData";
import { censorFor, crossedMilestones, freshPublicRow, milestoneMail, rowLoggedMail, type Censor, type RowLogged } from "./rowMail";

/* ONE ROW, SAVED. Everything that happens once a row has passed its checks:
 * the rate limit, the caps, the title it gets when none was typed, the row
 * itself, the note to the owner, the milestone note, the word to the
 * rower's followers.
 *
 * It was the second half of api/row100k/rows until 2026-11-24, and is here
 * so that TWO doors can save a row through the same rules:
 *
 *   api/row100k/rows      the form, on the site and in the app: a row typed
 *                         in or read off a monitor, WITH its two photos;
 *   api/row100k/app/erg   a row straight off a connected monitor, saved the
 *                         moment it ends with NO photos (owner, 2026-11-23:
 *                         "Strava does this thing where it's like it
 *                         automatically logs the row and then lets you add
 *                         the photos ... the intention is that every row
 *                         gets logged"). The photos go on afterwards
 *                         through the row's own edit (rows/[id] PATCH).
 *
 * WHO MAY SAVE and WHAT THE ROW IS are the caller's business: the caller
 * has the account, has run validateEntry, and has checked the photos it was
 * given. `photos` is the two keys, or none. */

export type SaveParticipant = { id: string; displayName: string; rowerNumber: number; division: string; instagram: string };

export type SavedRow = { ok: true; id: string; title: string } | { ok: false; error: string; status: number; retryAfterSec?: number };

export async function saveRow(participant: SaveParticipant, input: EntryInput, photos: string[]): Promise<SavedRow> {
  const limit = await rateLimit({
    key: `row100k-log:${participant.id}`,
    limit: 40,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return { ok: false, error: "Too many logs at once — try again in a bit.", status: 429, retryAfterSec: Math.max(1, limit.retryAfterSec) };
  }

  // Count-then-create is racy under concurrency, but the 40/hr rate limit
  // above bounds any overshoot to one window — these caps are anti-absurdity
  // guards on an honor-system board, not hard invariants. The meters BEFORE
  // this row ride along for the milestone note below (rowMail.ts): a
  // milestone is a line crossed, so it needs the total on both sides.
  // THE MONTH OF THE ROW bounds all of it (rollover review, 2026-09-28):
  // the boards are monthly, so the entry cap, the default title's number
  // and the milestone line are this row's month's, not all time's — a Sep
  // 30 row filed on Oct 1 counts among September's.
  const rowMonth = monthFromKey(input.day.slice(0, 7)) as Month;
  const inMonth = { participantId: participant.id, day: { gte: rowMonth.firstDay, lte: rowMonth.lastDay } };
  const [dayCount, totalCount, before] = await Promise.all([
    db.rowEntry.count({ where: { participantId: participant.id, day: input.day } }),
    db.rowEntry.count({ where: inMonth }),
    db.rowEntry.aggregate({ where: inMonth, _sum: { meters: true } }),
  ]);
  const prevTotal = before._sum.meters ?? 0;
  if (dayCount >= MAX_ENTRIES_PER_DAY) {
    return { ok: false, error: `That's already ${MAX_ENTRIES_PER_DAY} sessions on that day — the max.`, status: 400 };
  }
  if (totalCount >= MAX_ENTRIES_TOTAL) {
    return { ok: false, error: "You've hit the entry cap for the month.", status: 400 };
  }

  // No title typed → "Rowtember #7" ("October #7" outside September),
  // numbered by how many rows they'll have in the row's month.
  const value = input.title ? input : { ...input, title: defaultRowTitle(totalCount + 1, rowMonth) };

  /* The ROW app says so on every request (mobile/src/api.ts). */
  let via = "web";
  try {
    if (headers().get("x-row-client") === "app") via = "app";
  } catch {
    via = "";
  }
  const entry = await db.rowEntry.create({
    data: { challenge: CHALLENGE, participantId: participant.id, ...value, photos, via },
  });
  revalidateTag("row100k-boards");

  /* The rower's followers first (lib/rowNotify.ts), so the owner's email
   * below knows whether his phone was already told. Awaited, and it cannot
   * throw. */
  const told = await notifyRowLogged({ id: participant.id, displayName: participant.displayName }, { id: entry.id, day: entry.day, meters: entry.meters, seconds: entry.seconds });
  /* PUSH, NOT EMAIL (owner, 2026-11-26: "if I'm getting a notification when
   * someone rows, I don't need that notification through email"). The
   * milestone note is not pushed, so it still emails. */
  const pushedOwner = await ownerWasPushed(told);

  /* Heads-up to the owner on every logged row (owner call, launch day), and
   * a second note when the row crossed a milestone (owner, 2026-09-16). The
   * wording lives in rowMail.ts. Awaited so serverless can't kill it
   * mid-send, but never allowed to fail the log — sendOwnerNotification
   * swallows transport errors itself, and a thrown surprise here is caught
   * and logged. */
  try {
    const totals = await db.rowEntry.aggregate({
      where: inMonth,
      _sum: { meters: true },
      _count: true,
    });
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
      profileUrl: `${ROWTEMBER_ORIGIN}/r/${participant.rowerNumber}`,
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
    if (!pushedOwner) await sendOwnerNotification(note.subject, note.text, undefined, notifyTo);

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

  return { ok: true, id: entry.id, title: value.title };
}
