import { db } from "@/lib/db";
import { resolveViewer } from "@/lib/row100kViewer";
import { no, socialClosedTo, yes } from "../social";

/* A PHONE THAT WANTS PUSH NOTIFICATIONS (2026-11-21). POST { token,
 * platform } after the phone has been given an Expo push token; DELETE
 * { token } when the account signs out. The token belongs to whoever
 * signed in on that phone last, so it moves with them.
 *
 * What is sent, and when, is lib/rowNotify.ts. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$/;

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return no("Sign in first.", 401);
  if (socialClosedTo(viewer)) return no("Not open yet.", 404);
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    if (!TOKEN.test(token)) return no("Not a push token.", 400);
    const platform = body?.platform === "android" ? "android" : "ios";
    await db.rowPushToken.upsert({ where: { token }, create: { token, platform, userId: viewer.actor.photographerId }, update: { userId: viewer.actor.photographerId, platform } });
    /* ONE PHONE, ONE TOKEN (owner, 2026-11-23, of two pushes for one row:
     * "2 notifications for the same row"). A phone that was set up again
     * (a new build, a reinstall) comes back with a new token while the old
     * one still reaches it, and every push went out twice. The token the
     * phone says now is the one kept: the account's other tokens of the
     * same kind go. An account on two iPhones is told on the one it opened
     * last. */
    await db.rowPushToken.deleteMany({ where: { userId: viewer.actor.photographerId, platform, token: { not: token } } });
    return yes();
  } catch (err) {
    console.error("row app: failed to save a push token", err);
    return no("That did not save.", 500);
  }
}

export async function DELETE(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return no("Sign in first.", 401);
  if (socialClosedTo(viewer)) return no("Not open yet.", 404);
  try {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    await db.rowPushToken.deleteMany({ where: { token, userId: viewer.actor.photographerId } });
    return yes();
  } catch (err) {
    console.error("row app: failed to drop a push token", err);
    return no("That did not save.", 500);
  }
}
