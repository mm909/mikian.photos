import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { plusUsers } from "@/lib/rowPlus";
import { resolveViewer } from "@/lib/row100kViewer";
import { buildProfile } from "@/app/row100k/r/[num]/profileData";
import { avatarsFor, followCounts } from "@/lib/rowSocial";

/* ONE ROWER'S PROFILE for the phone app (2026-11-20): the view the /r/[num]
 * page lays out (profileData.ts), so who is hidden from whom is decided in
 * one place. GET ?num=7&m=YYYY-MM|all; with no num, the viewer's own.
 *
 * A MASKED view (one of the hidden elite, seen by anybody else while a
 * window is open) ships what the dog tag prints and nothing more: the
 * name, the number, the split, the count of sessions. The real totals and
 * the calendar are in the server's view object for the guarded pieces of
 * the page; they are dropped here, because everything in this answer
 * reaches the phone. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    let num = Number(q.get("num"));
    if (!q.get("num")) {
      const viewer = await resolveViewer();
      if (!viewer.me) return no(viewer.actor ? "Join first." : "Sign in first.", viewer.actor ? 404 : 401);
      num = viewer.me.rowerNumber;
    }
    if (!Number.isInteger(num) || num < 1 || num > 999999) return no("No such rower.", 404);
    const built = await buildProfile(num, q.get("m") ?? undefined);
    if (!built) return no("No such rower.", 404);
    const { view: v, viewer, until, lifetime, rel } = built;
    /* BLOCKED, either way: the name and the number, and how to undo it if
     * the block is the viewer's own. Nothing else of the rower. */
    if (rel.access === "blocked") {
      return NextResponse.json(
        { ok: true, blocked: { rowerNumber: v.rower.rowerNumber, displayName: v.rower.displayName, byMe: rel.blockedByMe } },
        { headers: NO_STORE },
      );
    }
    const counts = await followCounts(v.rower.id);
    const pendingIn = v.isMe ? await db.rowFollow.count({ where: { followeeId: v.rower.id, status: "pending" } }).catch(() => 0) : 0;
    /* Which logged row each erg piece belongs to, so a line of THE ERG can
     * open that row's page. */
    const ergEntry = new Map<string, string>();
    if (v.ergRows.length) {
      const tied = await db.rowTelemetry.findMany({ where: { id: { in: v.ergRows.map((r) => r.id) } }, select: { id: true, entryId: true } }).catch(() => []);
      for (const t of tied) if (t.entryId) ergEntry.set(t.id, t.entryId);
    }
    const base = {
      /* How the viewer and this rower stand, the counts anybody may see,
       * and (on the viewer's own page) the requests waiting on them. */
      rel: { following: rel.following, bell: rel.bell, followsYou: rel.followsYou, muted: rel.muted, isPrivate: rel.isPrivate, locked: rel.access === "private" },
      counts,
      avatar: (await avatarsFor([v.rower.id])).get(v.rower.id) ?? null,
      /* What the rower wrote about themselves; nobody's across a lock. */
      bio: rel.access === "private" ? "" : ((await db.rowParticipant.findUnique({ where: { id: v.rower.id }, select: { bio: true } }).catch(() => null))?.bio ?? ""),
      /* The black check after the name (lib/rowPlus.ts). */
      plus: (await plusUsers([(await db.rowParticipant.findUnique({ where: { id: v.rower.id }, select: { userId: true } }).catch(() => null))?.userId ?? ""])).size > 0,
      requests: pendingIn,
      /* For an admin only: the id the site's own delete-a-rower route takes. */
      adminId: viewer.isAdmin && !v.isMe ? v.rower.id : null,
      rower: { rowerNumber: v.rower.rowerNumber, displayName: v.rower.displayName, instagram: v.rower.instagram, division: v.rower.division },
      isMe: v.isMe,
      masked: v.masked,
      blackoutNote: v.blackoutNote,
      until: until ?? null,
      club: v.club,
      paceTag: v.paceTag ?? null,
      elite: v.elite,
      sessions: v.totals.sessions,
      bests: v.bests,
      logRows: v.logRows,
      period: v.period,
      month: v.month,
      periodOptions: v.periodOptions,
      thisMonthKey: v.thisMonthKey,
      days: v.days,
    };
    const profile = v.masked
      ? { ...base, totals: null, lifetime: null, rank: null, byDay: {}, paceCurve: [], paceDots: [], field: null, ergRows: [], ownTag: null }
      : {
          ...base,
          totals: v.totals,
          lifetime,
          rank: v.rank ?? null,
          byDay: v.byDay,
          paceCurve: v.paceCurve,
          paceDots: v.paceDots,
          field: v.field,
          ergRows: v.ergRows.map((r) => ({ ...r, entryId: ergEntry.get(r.id) ?? null })),
          ownTag: v.ownTag,
        };
    return NextResponse.json({ ok: true, profile }, { headers: NO_STORE });
  } catch (err) {
    console.error("row app: failed to build a profile", err);
    return no("That profile could not be read just now.", 500);
  }
}
