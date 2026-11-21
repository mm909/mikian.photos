import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { CHALLENGE, fmtDay, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { ROWTEMBER_ORIGIN } from "@/lib/rowSegments";
import { rateLimit } from "@/lib/rateLimit";
import { asRower, no, rowerByNum, yes } from "../social";

/* REPORT, for the phone app (2026-11-21; owner, 2026-11-20: "we will need
 * a report func to comply w/ apple"). POST { num, entryId?, reason, note? }:
 * a rower, or one of their rows with its photos.
 *
 * The report is kept (RowReport) and mailed to the owner at once with what
 * was reported, so he can act without being let into a private account.
 * The reported rower is never told, and nothing is hidden by a report
 * alone: taking a row down is the owner's call, on the moderation page. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["photo", "fake", "abuse", "spam", "other"] as const;
const LABEL: Record<(typeof REASONS)[number], string> = {
  photo: "A photo that should not be here",
  fake: "A row that was not rowed",
  abuse: "Harassment or hate",
  spam: "Spam",
  other: "Something else",
};

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { num?: unknown; entryId?: unknown; reason?: unknown; note?: unknown } | null;
    const reason = REASONS.find((r) => r === body?.reason);
    if (!reason) return no("Say what is wrong with it.", 400);
    const them = await rowerByNum(body?.num);
    if (!them) return no("No such rower.", 404);
    if (them.id === me.id) return no("That is you.", 400);
    const rl = await rateLimit({ key: `row-app-report:${me.id}`, limit: 20, windowSec: 3600 });
    if (!rl.ok) return no("That is a lot of reports. Try again in a bit.", 429);

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    const entryId = typeof body?.entryId === "string" && /^[a-z0-9]{1,40}$/i.test(body.entryId) ? body.entryId : null;
    const entry = entryId
      ? await db.rowEntry.findFirst({ where: { id: entryId, challenge: CHALLENGE, participantId: them.id }, select: { id: true, day: true, meters: true, title: true, photos: true } })
      : null;
    if (entryId && !entry) return no("No such row.", 404);

    await db.rowReport.create({
      data: { challenge: CHALLENGE, reporterId: me.id, subjectId: them.id, subjectNumber: them.rowerNumber, subjectName: them.displayName, entryId: entry?.id ?? null, reason, note },
    });

    /* Every report mails the owner; a failed send is logged, never shown. */
    try {
      const lines = [
        `Reported: ${fmtRowerNumber(them.rowerNumber)} · ${them.displayName}`,
        `By: ${fmtRowerNumber(me.rowerNumber)} · ${me.displayName}`,
        `Why: ${LABEL[reason]}`,
        note ? `Note: ${note}` : null,
        entry ? `Row: ${fmtDay(entry.day)} · ${fmtMeters(entry.meters)} m · "${entry.title}" · ${entry.photos.length} photo${entry.photos.length === 1 ? "" : "s"} (${entry.id})` : "The rower, not one row.",
        "",
        `Their page: ${ROWTEMBER_ORIGIN}/r/${them.rowerNumber}`,
        `Moderation: ${ROWTEMBER_ORIGIN}/moderation`,
      ].filter((l): l is string => l !== null);
      await sendOwnerNotification(`ROW report: ${fmtRowerNumber(them.rowerNumber)} ${them.displayName} (${LABEL[reason]})`, lines.join("\n"));
    } catch (err) {
      console.error("row app: report mail failed", err);
    }
    return yes();
  } catch (err) {
    console.error("row app: report failed", err);
    return no("That report did not go through. Try again.", 500);
  }
}
