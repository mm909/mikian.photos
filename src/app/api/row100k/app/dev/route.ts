import { NextResponse } from "next/server";
import { devPasswordSet, ensureDev, isDevAccount, resetDev, setDevPassword } from "@/lib/devAccount";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";

/* THE DEVELOPER ACCOUNT, from the app's settings (lib/devAccount.ts).
 *
 *   GET                    { isDev, isAdmin, passwordSet } for the two who may
 *                          use the rest: the Developer and an admin.
 *   POST { reset: true }   the Developer only: wipe its changes and copy
 *                          rower 001 again, now (owner, 2026-11-23: "Or we
 *                          can have a reset button for the dev account in
 *                          the settings").
 *   POST { password }      an admin only: the Developer's password, 8
 *                          characters or more, set from the phone so nobody
 *                          has to open the host's settings ("can we set one
 *                          up w/o me being in vercel?"). Only its digest is
 *                          kept. Making it also makes the account. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET() {
  const v = await resolveViewer();
  if (!v.actor) return no("Sign in first.", 401);
  const isDev = await isDevAccount(v.actor.photographerId);
  if (!isDev && !v.isAdmin) return no("Not yours.", 404);
  return NextResponse.json({ ok: true, isDev, isAdmin: v.isAdmin, passwordSet: v.isAdmin ? await devPasswordSet() : true }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const v = await resolveViewer();
  if (!v.actor) return no("Sign in first.", 401);
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return no("invalid JSON body", 400);
  }
  try {
    if (body.reset === true) {
      if (!(await isDevAccount(v.actor.photographerId))) return no("Only the Developer account resets.", 403);
      const rl = await rateLimit({ key: `row-dev-reset:${v.actor.photographerId}`, limit: 10, windowSec: 600 }).catch(() => null);
      if (rl && !rl.ok) return no("Too many resets. Try again in a few minutes.", 429);
      const done = await resetDev();
      return NextResponse.json({ ok: true, rows: done.rows }, { headers: NO_STORE });
    }
    if (typeof body.password === "string") {
      if (!v.isAdmin) return no("Not yours.", 404);
      const pass = body.password;
      if (pass.length < 8) return no("At least 8 characters.", 400);
      if (pass.length > 200) return no("That is too long.", 400);
      await setDevPassword(pass, v.actor.email ?? v.actor.photographerId);
      await ensureDev();
      return NextResponse.json({ ok: true }, { headers: NO_STORE });
    }
    return no("Nothing to do.", 400);
  } catch (err) {
    console.error("row app: the Developer account failed", err);
    return no("That did not work just now.", 500);
  }
}
