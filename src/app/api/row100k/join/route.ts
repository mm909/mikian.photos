import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { sendOwnerNotification } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import {
  CHALLENGE,
  CHALLENGE_LIVE,
  LOG_CLOSE_MS,
  fmtRowerNumber,
  nowMs,
  parseDisplayName,
  parseDivision,
  parseInstagram,
  parseShirtSize,
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

  let body: {
    displayName?: unknown;
    instagram?: unknown;
    division?: unknown;
    shirtSize?: unknown;
  };
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
  // Optional — "" means still unset; only a known size is stored.
  const shirtSize = parseShirtSize(body.shirtSize);
  if (shirtSize === null) {
    return NextResponse.json({ ok: false, error: "That's not a shirt size we print." }, { status: 400 });
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

  // Retry loop: two concurrent first-joins can race on the next rower number
  // (or on challenge_userId itself) — the @@unique constraints turn either
  // race into a P2002, and the next lap resolves it.
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    });
    if (existing) {
      await db.rowParticipant.update({
        where: { id: existing.id },
        // Only touch the stored size when the form actually sent the field —
        // a signup-shaped POST from an already-joined account must not wipe it.
        data: {
          displayName,
          instagram,
          division,
          ...(body.shirtSize !== undefined ? { shirtSize } : {}),
        },
      });
      revalidateTag("row100k-boards");
      return NextResponse.json({ ok: true, rowerNumber: existing.rowerNumber, updated: true });
    }

    const max = await db.rowParticipant.aggregate({
      where: { challenge: CHALLENGE },
      _max: { rowerNumber: true },
    });
    try {
      const created = await db.rowParticipant.create({
        data: {
          challenge: CHALLENGE,
          userId: actor.photographerId,
          rowerNumber: (max._max.rowerNumber ?? 0) + 1,
          displayName,
          instagram,
          division,
        },
      });
      revalidateTag("row100k-boards");

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
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err;
    }
  }
  return NextResponse.json(
    { ok: false, error: "Couldn't grab you a number — try again." },
    { status: 500 },
  );
}
