import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mintAppToken, verifyAppleIdToken, verifyGoogleIdToken } from "@/lib/appToken";
import { reviewAccountFor } from "@/lib/appReview";
import { upsertAppleAccount, upsertGoogleAccount } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

/* THE PHONE APP SIGNS IN (2026-11-20). POST { idToken } — the ID token
 * Google's own sign-in handed the app — and the answer is { ok, token }:
 * the bearer the app sends from then on (appToken.ts). The account is the
 * same one the site signs that Google identity into (upsertGoogleAccount),
 * so a rower is the same rower on both.
 *
 * DEVELOPMENT ONLY: POST { devEmail } signs in as an EXISTING account by
 * email, the way the mk_dev_actor cookie does for the site, so the app can
 * be walked on a laptop without a Google client. Inert in any production
 * build (Vercel production and preview both).
 *
 * THE DEVELOPER: POST { reviewPass } signs in as the one Developer
 * account, rower 000, when the password is the one the owner set
 * (lib/appReview.ts). With none set, nothing matches. A name sent beside it
 * (the app before 2026-11-23 asked for one) is ignored. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return no("invalid JSON body", 400);
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const rl = await rateLimit({ key: `row-app-session:${ip}`, limit: 30, windowSec: 600 }).catch(() => null);
  if (rl && !rl.ok) return no("Too many sign-ins. Try again in a few minutes.", 429);

  try {
    if (process.env.NODE_ENV !== "production" && typeof body.devEmail === "string") {
      const row = await db.photographer.findFirst({ where: { email: body.devEmail.trim().toLowerCase() }, select: { id: true } });
      if (!row) return no("No such account.", 404);
      return NextResponse.json({ ok: true, token: await mintAppToken(row.id) }, { headers: NO_STORE });
    }
    if (typeof body.reviewPass === "string") {
      /* A guess at the password is rarer than a sign-in, and is held to it. */
      const tries = await rateLimit({ key: `row-app-review:${ip}`, limit: 8, windowSec: 600 }).catch(() => null);
      if (tries && !tries.ok) return no("Too many sign-ins. Try again in a few minutes.", 429);
      const id = await reviewAccountFor(body.reviewPass);
      if (!id) return no("That is not the Developer password.", 401);
      return NextResponse.json({ ok: true, token: await mintAppToken(id) }, { headers: NO_STORE });
    }
    /* SIGN IN WITH APPLE: POST { appleToken, name? }. */
    if (typeof body.appleToken === "string") {
      const apple = await verifyAppleIdToken(body.appleToken, typeof body.name === "string" ? body.name : undefined);
      if (!apple) return no("Apple did not confirm that sign-in. Try again.", 401);
      return NextResponse.json({ ok: true, token: await mintAppToken(await upsertAppleAccount(apple)) }, { headers: NO_STORE });
    }
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    const who = idToken ? await verifyGoogleIdToken(idToken) : null;
    if (!who) return no("Google did not confirm that sign-in. Try again.", 401);
    const id = await upsertGoogleAccount(who);
    return NextResponse.json({ ok: true, token: await mintAppToken(id) }, { headers: NO_STORE });
  } catch (err) {
    console.error("row app: sign-in failed", err);
    return no("Sign-in could not be completed just now.", 500);
  }
}
