import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isDevAccount } from "@/lib/devAccount";
import { CHALLENGE, GOAL_METERS, MONTH, nowMs, pacificDay } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { monthOptIns } from "@/app/row100k/monthOptIn";
import { avatarsFor } from "@/lib/rowSocial";

/* WHO THE APP IS SIGNED IN AS (2026-11-20): the account, the rower it
 * rows as (null until they join), and the rower's own two running totals,
 * all time and this month, which only they are shown here. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/* THE STORE BUILDS COUNT TOO (owner, 2026-11-27: "Stuart Ho looks like
 * he's downloaded the app, but ... still shows him as invited"): the Play
 * and App Store builds were made before the app said when it opened
 * (app/seen), and an update never reaches them (it goes to the preview
 * builds only). Every build asks for this on opening, so an app's ask with
 * no x-row-client header (the builds before it) is counted here, the
 * platform read off the phone's own HTTP library: okhttp is Android,
 * CFNetwork / Darwin is an iPhone. A browser (Mozilla) is never counted. */
async function oldBuildOpened(req: Request, userId: string) {
  if (req.headers.get("x-row-client")) return;
  const ua = req.headers.get("user-agent") ?? "";
  const platform = /okhttp/i.test(ua) ? "android" : /CFNetwork|Darwin/i.test(ua) ? "ios" : null;
  if (!platform || /Mozilla/i.test(ua)) return;
  try {
    const day = pacificDay(nowMs());
    await db.rowAppSeen.upsert({
      where: { userId_day_platform: { userId, day, platform } },
      create: { userId, day, platform, version: "store build" },
      update: { opens: { increment: 1 } },
    });
  } catch (err) {
    console.error("row app: an old build's open was not counted", err);
  }
}

export async function GET(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return NextResponse.json({ ok: true, signedIn: false }, { headers: NO_STORE });
  await oldBuildOpened(req, viewer.actor.photographerId);
  const me = viewer.me;
  let totals = { meters: 0, seconds: 0, sessions: 0, monthMeters: 0, monthSessions: 0 };
  let optedIn = false;
  /* The dot on the bell: lines not yet read, and requests not yet answered. */
  let social = { unread: 0, requests: 0, isPrivate: false };
  let avatar: string | null = null;
  if (me) {
    try {
      const [unread, requests, setting] = await Promise.all([
        /* A request is counted once, by `requests` below, for as long as it
         * waits; its own line is left out here so it is not counted twice. */
        db.rowNotification.count({ where: { participantId: me.id, readAt: null, kind: { not: "request" } } }),
        db.rowFollow.count({ where: { followeeId: me.id, status: "pending" } }),
        db.rowSocialSetting.findUnique({ where: { participantId: me.id }, select: { isPrivate: true } }),
      ]);
      social = { unread, requests, isPrivate: setting?.isPrivate ?? false };
      avatar = (await avatarsFor([me.id])).get(me.id) ?? null;
    } catch (err) {
      console.error("row app: failed to read the viewer's notifications", err);
    }
  }
  if (me) {
    try {
      const [all, month, ins] = await Promise.all([
        db.rowEntry.aggregate({ where: { challenge: CHALLENGE, participantId: me.id }, _sum: { meters: true, seconds: true }, _count: true }),
        db.rowEntry.aggregate({ where: { challenge: CHALLENGE, participantId: me.id, day: { gte: MONTH.firstDay, lte: MONTH.lastDay } }, _sum: { meters: true }, _count: true }),
        monthOptIns(),
      ]);
      /* `monthSessions`: how many rows this month, for the title the app's
       * log form fills in ("November #12" is the twelfth; owner, 2026-11-23:
       * "fill in the title as like November number X"). The same count
       * rows/route.ts numbers an untitled row by. */
      totals = { meters: all._sum.meters ?? 0, seconds: all._sum.seconds ?? 0, sessions: all._count, monthMeters: month._sum.meters ?? 0, monthSessions: month._count };
      optedIn = ins.has(me.id);
    } catch (err) {
      console.error("row app: failed to read the viewer's totals", err);
    }
  }
  return NextResponse.json(
    {
      ok: true,
      signedIn: true,
      isAdmin: viewer.isAdmin,
      /* The Developer account, rower 000 (lib/devAccount.ts). */
      isDev: await isDevAccount(viewer.actor.photographerId).catch(() => false),
      name: viewer.actor.name,
      me: me ? { participantId: me.id, rowerNumber: me.rowerNumber, displayName: me.displayName, instagram: me.instagram, division: me.division } : null,
      totals,
      optedIn,
      social,
      avatar,
      month: { key: MONTH.key, label: MONTH.label, goal: GOAL_METERS },
    },
    { headers: NO_STORE },
  );
}
