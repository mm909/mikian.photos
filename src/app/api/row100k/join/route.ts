import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { joinNote } from "@/app/row100k/joinMail";
import { parseJoinExtras } from "@/app/row100k/join/fields";
import { JOIN_PAGE_LIVE } from "@/app/row100k/join/live";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { ensureParticipant } from "@/lib/row100kJoin";
import {
  CHALLENGE,
  CHALLENGE_LIVE,
  MONTH,
  isRow100kAdmin,
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

/* THE SHIRT SIZE, written on its own and never fatal: the column is new
 * (2026-10-01) and may not be in the database when this code is — P2022 —
 * and a join, or a settings save of the name, must not fail for it. Null
 * clears. Logged and dropped on any miss; the rower can set it in settings
 * once the column is there. */
async function saveShirtSize(id: string, shirtSize: string | null): Promise<void> {
  try {
    await db.rowParticipant.update({ where: { id }, data: { shirtSize }, select: { id: true } });
  } catch (err) {
    console.error(
      isMissingColumn(err)
        ? "row100k join: shirtSize is not in the database yet — size not saved"
        : "row100k join: the shirt size was not saved",
      err,
    );
  }
}

/* Join the Row 100k challenge (or update your profile — same POST, upsert
 * semantics). Requires a Google session; the rower number is assigned once
 * at first join, in join order, and never changes.
 *
 * THE SIGN-UP PAGE (join/page.tsx, owner 2026-10-01) sends more in the same
 * request, and every key of it is optional, so the JoinPanel and the
 * settings form — which send the old shape — are untouched:
 *   shirtSize, heightCm, weightKg, homeGym   the third tier, checked by
 *     join/fields.ts parseJoinExtras (the participants PATCH readers);
 *   monthOptIn: true   put the NEW rower on this month's 100K board with
 *     the join (RowMonthOptIn, the row /api/row100k/month-optin writes).
 * A refusal now also names its field (`field`), which the page prints the
 * words under; an old client reads `error` and never sees it. A first join
 * answers with the new row's id (`participantId`) as well. */
export async function POST(req: Request) {
  /* No closing gate any more (rollover review, 2026-09-28): under the
   * monthly clock a join is a join in whatever month it lands, and the old
   * "the challenge is wrapped" check against the process month could only
   * ever fire on a stale instance across a month boundary, refusing the
   * first October joins. The log window is validateEntry's business. */

  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json(
      { ok: false, error: "Sign in with Google first." },
      { status: 401 },
    );
  }

  let body: {
    displayName?: unknown;
    instagram?: unknown;
    division?: unknown;
    birthday?: unknown;
    shirtSize?: unknown;
    heightCm?: unknown;
    weightKg?: unknown;
    homeGym?: unknown;
    monthOptIn?: unknown;
  };
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
      { ok: false, error: "Add the name you want on the board (at least 2 characters).", field: "name" },
      { status: 400 },
    );
  }
  // OPTIONAL (owner, 2026-09-24: "let users register without an Instagram
  // handle"): blank is fine and stored as ""; only a typed-but-wrong handle
  // is refused, so nobody loses what they meant to give.
  const instagram = parseInstagramOptional(body.instagram);
  if (instagram === null) {
    return NextResponse.json(
      {
        ok: false,
        error: "That Instagram handle does not look right — letters, numbers, dots and underscores only.",
        field: "instagram",
      },
      { status: 400 },
    );
  }
  const division = parseDivision(body.division);
  if (!division) {
    return NextResponse.json(
      { ok: false, error: "Pick which board you're competing on.", field: "division" },
      { status: 400 },
    );
  }
  // BIRTHDAY (owner, 2026-09-24): required to JOIN, and only then — this
  // same POST is the settings page's name/handle/board save, which does not
  // carry one (the settings form edits the birthday through the
  // participants API). So: absent means "leave it", present means "check
  // it", and a FIRST join with none is turned away below, once we know it
  // is a first join.
  let birthday: Date | undefined;
  if (body.birthday !== undefined && body.birthday !== null && body.birthday !== "") {
    const checked = parseBirthday(body.birthday, nowMs());
    if (!checked.ok) {
      return NextResponse.json({ ok: false, error: checked.error, field: "birthday" }, { status: 400 });
    }
    birthday = checked.value;
  }
  // THE THIRD TIER (owner, 2026-10-01: "their t-shirt size and their height
  // and their weight and their home gym — all of those should be there, not
  // as important"): absent is "leave it", null or "" is none, anything else
  // must read — the same readers the settings page saves through.
  const extras = parseJoinExtras(body);
  if (!extras.ok) {
    return NextResponse.json({ ok: false, error: extras.error, field: extras.field }, { status: 400 });
  }
  const { shirtSize, ...about } = extras.value;

  // THIRTY AN HOUR, up from ten (2026-09-25): the settings page saves each
  // field the moment it changes (owner: "no SAVE CHANGES button"), so one
  // sitting of edits is several of these where it used to be one. Still
  // one rower's own row, still nothing anyone else can spend.
  const limit = await rateLimit({
    key: `row100k-join:${actor.photographerId}`,
    limit: 30,
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
      if (!already) {
        return NextResponse.json({ ok: false, error: "Add your birthday.", field: "birthday" }, { status: 400 });
      }
    }

    // The birthday column may not be in the database yet (owner,
    // 2026-09-25: the first-join requirement must not 500 while it is
    // missing): the create and the update both write it only when one was
    // sent, so a P2022 here can only mean that column, and the answer is a
    // refusal in plain words, not a stack trace. Nothing was written: the
    // create is the statement that failed, so no rower number was spent.
    // (Height, weight and home gym ride in the same two statements when
    // the sign-up page sends them; their columns have been in the database
    // since 2026-09-25. The shirt size, the one column that may not be, is
    // written on its own — saveShirtSize.)
    let created;
    try {
      created = await ensureParticipant({ userId: actor.photographerId, displayName, instagram, division, birthday, about });
      if (!created.created) {
        // `select` is load-bearing: without one the update reads the whole
        // row back, the new shirtSize column with it, and every settings
        // save of the name would be a P2022 on a database the column has
        // not reached (found by hand, 2026-10-01).
        await db.rowParticipant.update({
          where: { id: created.id },
          data: { displayName, instagram, division, ...(birthday ? { birthday } : {}), ...about },
          select: { id: true },
        });
        if (shirtSize !== undefined) await saveShirtSize(created.id, shirtSize);
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

    // The row exists and the number is spent: from here nothing may fail
    // the join. A size, when one was picked, then the month.
    if (shirtSize) await saveShirtSize(created.id, shirtSize);

    // THE MONTH'S 100K WITH THE JOIN (owner, 2026-10-01: "welcome, rower
    // one twenty — choose to opt in"): the sign-up page's OPT IN is the
    // opt-in to this month's board as well, so the new rower gets the row
    // /api/row100k/month-optin would write, in the same request. Only when
    // the page asks (the JoinPanel does not, and joins as it always has),
    // and — while the page and the board are in development — only for an
    // admin in production, the gate that route wears; join/live.ts lifts
    // it with the page. In a try of its own: a table not pushed, or any
    // other miss, costs the rower the board row, never the join.
    let monthOptIn = false;
    if (
      body.monthOptIn === true &&
      (JOIN_PAGE_LIVE || process.env.NODE_ENV !== "production" || isRow100kAdmin(actor.email, actor.roles))
    ) {
      try {
        await db.rowMonthOptIn.upsert({
          where: {
            challenge_participantId_month: { challenge: CHALLENGE, participantId: created.id, month: MONTH.key },
          },
          create: { challenge: CHALLENGE, participantId: created.id, rowerNumber: created.rowerNumber, month: MONTH.key },
          update: { cancelledAt: null },
        });
        monthOptIn = true;
      } catch (err) {
        console.error("row100k join: the month opt-in was not written (table pushed?)", err);
      }
    }

    {
      // Every real signup lands in the owner's inbox. First joins only —
      // profile edits stay quiet — and never for the demo namespace. The
      // await is deliberate (Vercel can kill the lambda after the response),
      // but a failed send must never fail the join, so the result is logged
      // and dropped.
      if (CHALLENGE === CHALLENGE_LIVE) {
        // The words live in joinMail.ts (2026-09-27) so the emails page
        // shows exactly this mail.
        const note = joinNote({
          rowerNumber: created.rowerNumber,
          displayName,
          instagram,
          division,
          accountName: actor.name ?? "",
          accountEmail: actor.email,
        });
        const sent = await sendOwnerNotification(note.subject, note.text, actor.email);
        if (!sent.ok) console.error("row100k: signup email failed", sent.error);
      }

      return NextResponse.json({
        ok: true,
        rowerNumber: created.rowerNumber,
        updated: false,
        participantId: created.id,
        monthOptIn,
      });
    }
  }
}
