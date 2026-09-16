import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { isRow100kAdmin } from "@/lib/row100k";
import {
  LOOK_COOKIE,
  isSettingKey,
  parseLook,
  parseSetting,
  siteSettings,
  writeSetting,
} from "@/lib/rowSettings";
import { CARDS } from "@/app/row100k/share/cards";

export const runtime = "nodejs";

/* The site switches (src/lib/rowSettings.ts) — read and write. Admin only
 * on every verb, JSON 401/403 like the blackout route.
 *
 *   GET                                  → { ok, settings }
 *   POST { key, value }                  → write one switch (validated)
 *   POST { previewLook: "ink"|"paper"|null } → set or clear the admin's
 *        own-browser look cookie; nothing else changes for anybody else.
 *
 * A write revalidates the settings tag, so the very next request wears
 * the new switch. */

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) {
    return { res: NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 }) };
  }
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return { res: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  }
  const limit = await rateLimit({ key: `row100k-settings:${actor.photographerId}`, limit: 60, windowSec: 3600 });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const CARD_IDS = new Set(CARDS.map((c) => c.id));

export async function GET() {
  const g = await guard();
  if ("res" in g) return g.res;
  return NextResponse.json({ ok: true, settings: await siteSettings() });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  let body: { key?: unknown; value?: unknown; previewLook?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  /* ------------------------------------------------ the preview cookie */
  if ("previewLook" in body) {
    const look = body.previewLook === null ? null : parseLook(body.previewLook);
    if (body.previewLook !== null && !look) return bad("A look is paper or ink.");
    const res = NextResponse.json({ ok: true, previewLook: look });
    if (look) {
      res.cookies.set({
        name: LOOK_COOKIE,
        value: look,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      res.cookies.set({ name: LOOK_COOKIE, value: "", path: "/", maxAge: 0 });
    }
    return res;
  }

  /* ------------------------------------------------------- one switch */
  if (!isSettingKey(body.key)) return bad("Which setting?");
  const value = parseSetting(body.key, body.value);
  if (value === null) return bad(`That is not a valid value for ${body.key}.`);
  if (body.key === "cards.off") {
    const unknown = (value as string[]).filter((id) => !CARD_IDS.has(id));
    if (unknown.length > 0) return bad(`Unknown card: ${unknown.join(", ")}.`);
  }

  try {
    await writeSetting(body.key, value, g.actor.email);
    return NextResponse.json({ ok: true, key: body.key, value });
  } catch (err) {
    console.error("row100k settings: write failed", err);
    return bad("Couldn't save that — has the RowSetting table been pushed?", 503);
  }
}
