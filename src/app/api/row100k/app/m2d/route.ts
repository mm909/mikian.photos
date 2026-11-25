import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { m2dView, readM2dBody, saveM2d } from "@/app/row100k/m2d";
import { asRower, no, yes } from "../social";

/* M2D for the phone app (owner, 2026-11-25; the rules in row100k/m2d.ts).
 *
 * GET: the window, the totals (the dollars), the board and the viewer's
 * own line. Anybody may read it, as anybody may read the 100K board.
 *
 * POST { in }: the rower says they are registered for the Concept2 Holiday
 * Challenge (or takes it back: a mistaken press is undone here, as the
 * registration itself lives on Concept2's site). Every save emails the
 * owner (CLAUDE.md: every sign-up emails the owner); a failed send is
 * logged, never shown. Answers the view again. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await resolveViewer();
    return yes({ signedIn: viewer.actor !== null, ...(await m2dView(viewer)) });
  } catch (err) {
    console.error("row app: failed to read M2D", err);
    return no("M2D could not be read just now.", 500);
  }
}

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  const body = readM2dBody(await req.json().catch(() => null));
  if (typeof body === "string") return no(body, 400);
  const rl = await rateLimit({ key: `row-app-m2d:${me.id}`, limit: 30, windowSec: 3600 });
  if (!rl.ok) return no("Too many at once. Try again in a bit.", 429);
  try {
    await saveM2d(me, body.in, body.choice, who.viewer.actor?.email, "the ROW app");
  } catch (err) {
    console.error("row app: M2D opt-in not saved", err);
    return no("That did not save. Try again.", 500);
  }
  try {
    return yes(await m2dView(await resolveViewer()));
  } catch {
    return yes({});
  }
}
