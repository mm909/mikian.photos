import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { ensureParticipant } from "@/lib/row100kJoin";
import {
  CHALLENGE,
  CHALLENGE_LIVE,
  LOG_CLOSE_MS,
  fmtRowerNumber,
  nowMs,
  parseBirthday,
  parseDisplayName,
  parseDivision,
  parseInstagramOptional,
} from "@/lib/row100k";

export const runtime = "nodejs";

/* Prisma's "column does not exist" (P2022): the schema knows a column the
 * database has not been pushed yet. */
function isMissingColumn(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "P2022";
}

/* Join the Row 100k challenge (or update your profile — same POST, upsert
 * semantics). Requires a Google session; the rower number is assigned once
 * at first join, in join order, and never changes. */
export async function POST(req: Request) {
  if (nowMs() >= LOG_CLOSE_MS) {
    return NextResponse.json(
      { ok: false, error: "The challenge is wrapped — the board is final." },
      { status: 400 },
    );
  }

  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  let body: { displayName?: unknown; instagram?: unknown; division?: unknown; birthday?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  // TWO ROWERS MAY SHARE A NAME (owner, 2026-09-24: "if two people have the
  // same name they go by the rower number, that's fine") — there is no
  // uniqueness check on displayName here and none in the schema, on purpose.
  const displayName = parseDisplayName(body.displayName);
  if (!displayName) {
    return NextResponse.json(
      { ok: false, error: "Add the name you want on the board (at least 2 characters)." },
      { status: 400 },
    );
  }
  // OPTIONAL (owner, 2026-09-24: "let users register without an Instagram
  // handle"): blank is fine and stored as ""; only a typed-but-wrong handle
  // is refused, so nobody loses what they meant to give.
  const instagram = parseInstagramOptional(body.instagram);
  if (instagram === null) {
    return NextResponse.json(
      { ok: false, error: "That Instagram handle does not look right — letters, numbers, dots and underscores only." },
      { status: 400 },
    );
  }
  const division = parseDivision(body.division);
  if (!division) {
    return NextResponse.json(
      { ok: false, error: "Pick which board you're competing on." },
      { status: 400 },
    );
  }
  // BIRTHDAY (owner, 2026-09-24): required to JOIN, and only then — this
  // same POST is the settings page's name/handle/board save, which does not
  // carry one (birthday is edited in the About you block through the
  // participants API). So: absent means "leave it", present means "check
  // it", and a FIRST join with none is turned away below, once we know it
  // is a first join.
  let birthday: Date | undefined;
  if (body.birthday !== undefined && body.birthday !== null && body.birthday !== "") {
    const checked = parseBirthday(body.birthday, nowMs());
    if (!checked.ok) return NextResponse.json({ ok: false, error: checked.error }, { status: 400 });
    birthday = checked.value;
  }

  const limit = await rateLimit({
    key: `row100k-join:${actor.photographerId}`,
    limit: 10,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many updates — try again in a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  // The row is created in ONE place for both doors into the challenge
  // (lib/row100kJoin.ts): here, and race day, which since 2026-09-21 takes
  // a name from somebody who is not in Rowtember. An existing row comes
  // back untouched and is updated here — this POST is also the profile
  // edit — with the same three fields it always took (plus the birthday
  // when one is sent).
  {
    // A FIRST JOIN NEEDS A BIRTHDAY, and only a read can tell a first join
    // from a settings save before the row exists. One extra findUnique;
    // the create itself stays race-safe inside ensureParticipant.
    if (birthday === undefined) {
      const already = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
      if (!already) return NextResponse.json({ ok: false, error: "Add your birthday." }, { status: 400 });
    }

    // The birthday column may not be in the database yet (owner,
    // 2026-09-25: the first-join requirement must not 500 while it is
    // missing): the create and the update both write it only when one was
    // sent, so a P2022 here can only mean that column, and the answer is a
    // refusal in plain words, not a stack trace. Nothing was written: the
    // create is the statement that failed, so no rower number was spent.
    let created;
    try {
      created = await ensureParticipant({ userId: actor.photographerId, displayName, instagram, division, birthday });
      if (!created.created) {
        await db.rowParticipant.update({
          where: { id: created.id },
          data: { displayName, instagram, division, ...(birthday ? { birthday } : {}) },
        });
        revalidateTag("row100k-boards");
        return NextResponse.json({ ok: true, rowerNumber: created.rowerNumber, updated: true });
      }
    } catch (err) {
      if (birthday && isMissingColumn(err)) {
        return NextResponse.json(
          { ok: false, error: "The birthday field is not ready yet — the site cannot take a join right now. Try again later." },
          { status: 503 },
        );
      }
      throw err;
    }

    {
      // Every real signup lands in the owner's inbox. First joins only —
      // profile edits stay quiet — and never for the demo namespace. The
      // await is deliberate (Vercel can kill the lambda after the response),
      // but a failed send must never fail the join, so the result is logged
      // and dropped.
      if (CHALLENGE === CHALLENGE_LIVE) {
        // No handle, no "@" (owner, 2026-09-24) — the subject and the line
        // both fall silent rather than print an empty one. The birthday is
        // deliberately NOT in this mail: nothing shows it anywhere yet.
        const sent = await sendOwnerNotification(
          `Rowtember signup — ${fmtRowerNumber(created.rowerNumber)} ${displayName}${instagram ? ` (@${instagram})` : ""}`,
          [
            `Rower ${fmtRowerNumber(created.rowerNumber)} just joined 100K September.`,
            ``,
            `Name on the board: ${displayName}`,
            instagram ? `Instagram: @${instagram} — https://instagram.com/${instagram}` : `Instagram: none given`,
            `Board: ${division === "F" ? "Women's" : "Men's"}`,
            `Account: ${actor.name} <${actor.email}>`,
            ``,
            `The board: https://mikianmusser.com/row100k#board`,
          ].join("\n"),
          actor.email,
        );
        if (!sent.ok) console.error("row100k: signup email failed", sent.error);
      }

      return NextResponse.json({ ok: true, rowerNumber: created.rowerNumber, updated: false });
    }
  }
}
