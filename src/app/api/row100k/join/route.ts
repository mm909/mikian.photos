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
  parseDisplayName,
  parseDivision,
  parseInstagram,
} from "@/lib/row100k";

export const runtime = "nodejs";

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

  let body: { displayName?: unknown; instagram?: unknown; division?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const displayName = parseDisplayName(body.displayName);
  if (!displayName) {
    return NextResponse.json(
      { ok: false, error: "Add the name you want on the board (at least 2 characters)." },
      { status: 400 },
    );
  }
  const instagram = parseInstagram(body.instagram);
  if (!instagram) {
    return NextResponse.json(
      { ok: false, error: "Add your Instagram handle — letters, numbers, dots and underscores only." },
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
  // edit — with the same three fields it always took.
  {
    const created = await ensureParticipant({ userId: actor.photographerId, displayName, instagram, division });
    if (!created.created) {
      await db.rowParticipant.update({
        where: { id: created.id },
        data: { displayName, instagram, division },
      });
      revalidateTag("row100k-boards");
      return NextResponse.json({ ok: true, rowerNumber: created.rowerNumber, updated: true });
    }

    {
      // Every real signup lands in the owner's inbox. First joins only —
      // profile edits stay quiet — and never for the demo namespace. The
      // await is deliberate (Vercel can kill the lambda after the response),
      // but a failed send must never fail the join, so the result is logged
      // and dropped.
      if (CHALLENGE === CHALLENGE_LIVE) {
        const sent = await sendOwnerNotification(
          `Rowtember signup — ${fmtRowerNumber(created.rowerNumber)} ${displayName} (@${instagram})`,
          [
            `Rower ${fmtRowerNumber(created.rowerNumber)} just joined 100K September.`,
            ``,
            `Name on the board: ${displayName}`,
            `Instagram: @${instagram} — https://instagram.com/${instagram}`,
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
