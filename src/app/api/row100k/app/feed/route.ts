import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveViewer } from "@/lib/row100kViewer";
import { CHALLENGE } from "@/lib/row100k";
import { avatarsFor, followingIds } from "@/lib/rowSocial";
import { plusUsers } from "@/lib/rowPlus";
import { buildFeed, type FeedData } from "@/app/row100k/feed/feedData";

/* THE FEED for the phone app (2026-11-20; owner the same day: "a
 * chronological list of all rows so far. No month cutoff. It should include
 * the photos as well as the other info like name, meters, time, stats (if
 * hooked up to the erg)"). The rows are the /feed page's own (feedData.ts),
 * masked for whoever is asking by the same function.
 *
 * ONE LIST, THE ROWERS I FOLLOW FIRST (owner, 2026-11-21, of two buttons
 * for EVERYONE and FOLLOWING: "I think that's obnoxious ... I want one page
 * that can forever scroll just like every other social media site, and I
 * want it to consider my friends or who I'm following first, and then
 * everyone else"; "the algorithm should be dead simple on first pass").
 * So, with no likes or comments to rank by:
 *
 *   THE LEAD   what the rowers I follow, and I, logged in the last seven
 *              days, newest first;
 *   THE REST   every other row there is, newest first, back to the first.
 *
 * Seven days, because without a limit a rower who follows a few busy
 * people would scroll through months of them before meeting anybody new.
 * Somebody who follows nobody gets the rest alone, which is everybody.
 *
 * ?before= is the cursor each answer hands back as `older`:
 *   lead~<since>~<createdAt>~<id>    still in the lead
 *   rest~<since>[~<createdAt>~<id>]  in the rest (`since` is where the lead
 *                                    began, so the two never overlap)
 *
 * ?rower=<number> is ONE rower's rows and nobody else's, newest first,
 * for the ROWS tab of a profile (owner, 2026-11-21: "seeing the exact same
 * cards that are in the feed, but on an activities tab in your profile").
 * The same masking and the same privacy: buildFeed leaves out what this
 * viewer may not see.
 *
 * Beside each row that came off a connected erg ride the monitor's
 * averages, never for a hidden row; and how the viewer stands to the row's
 * rower, for the menu on the row. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const LEAD_DAYS = 7;

type Erg = { id: string; watts: number | null; spm: number | null; hr: number | null; drag: number | null };

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const raw = q.get("before") ?? "";
    const rowerNum = Number(q.get("rower"));
    const one = q.has("rower") && Number.isInteger(rowerNum) && rowerNum > 0 ? await db.rowParticipant.findFirst({ where: { challenge: CHALLENGE, rowerNumber: rowerNum }, select: { id: true } }) : null;
    if (q.has("rower") && !one) return NextResponse.json({ ok: true, items: [], older: null, lead: 0 }, { headers: NO_STORE });
    const viewer = await resolveViewer();
    const me = viewer.myParticipantId;
    const follows = me ? await followingIds(me) : [];
    const lead = me && follows.length ? [...follows, me] : null;

    const [phase, sinceRaw, at = "", id = ""] = raw.split("~");
    const sinceMs = Date.parse(sinceRaw ?? "");
    const since = new Date(Number.isFinite(sinceMs) ? sinceMs : Date.now() - LEAD_DAYS * 86_400_000);
    const inner = at && id ? `${at}~${id}` : "";

    let feed: FeedData;
    let older: string | null;
    let leadRows = 0;
    if (one) {
      feed = await buildFeed(viewer, phase === "one" ? inner : "", { lead: { ids: [one.id], since: new Date(0) } });
      older = feed.olderCursor ? `one~x~${feed.olderCursor}` : null;
    } else if (!lead) {
      /* Nobody followed: the whole river, on the plain cursor. */
      feed = await buildFeed(viewer, phase === "rest" ? inner : raw);
      older = feed.olderCursor ? `rest~${since.toISOString()}~${feed.olderCursor}` : null;
    } else if (phase === "rest") {
      feed = await buildFeed(viewer, inner, { after: { ids: lead, since } });
      older = feed.olderCursor ? `rest~${since.toISOString()}~${feed.olderCursor}` : null;
    } else {
      feed = await buildFeed(viewer, phase === "lead" ? inner : "", { lead: { ids: lead, since } });
      leadRows = feed.items.length;
      if (feed.olderCursor) older = `lead~${since.toISOString()}~${feed.olderCursor}`;
      else {
        /* The lead ran out on this page: the rest starts under it at once,
         * so a short lead never looks like the end of the feed. */
        const rest = await buildFeed(viewer, "", { after: { ids: lead, since } });
        feed = { ...feed, items: [...feed.items, ...rest.items] };
        older = rest.olderCursor ? `rest~${since.toISOString()}~${rest.olderCursor}` : null;
      }
    }

    const open = feed.items.filter((it) => !it.masked).map((it) => it.id);
    const erg: Record<string, Erg> = {};
    if (open.length) {
      try {
        const rows = await db.rowTelemetry.findMany({
          where: { entryId: { in: open } },
          select: { id: true, entryId: true, avgWatts: true, avgSpm: true, avgHr: true, dragFactor: true },
        });
        for (const r of rows) if (r.entryId) erg[r.entryId] = { id: r.id, watts: r.avgWatts, spm: r.avgSpm, hr: r.avgHr, drag: r.dragFactor };
      } catch (err) {
        console.error("row app: failed to read the erg figures for the feed", err);
      }
    }

    /* How the viewer stands to each row's rower: following or not, the bell. */
    const nums = [...new Set(feed.items.map((it) => it.rowerNumber))];
    const rel = new Map<number, { following: string; bell: boolean }>();
    if (me && nums.length) {
      try {
        const out = await db.rowFollow.findMany({ where: { followerId: me }, select: { followeeId: true, status: true, notify: true } });
        const who = await db.rowParticipant.findMany({ where: { id: { in: out.map((f) => f.followeeId) } }, select: { id: true, rowerNumber: true } });
        const numOf = new Map(who.map((p) => [p.id, p.rowerNumber]));
        for (const f of out) {
          const n = numOf.get(f.followeeId);
          if (n !== undefined) rel.set(n, { following: f.status === "accepted" ? "accepted" : "pending", bell: f.status === "accepted" && f.notify });
        }
      } catch (err) {
        console.error("row app: failed to read the viewer's follows for the feed", err);
      }
    }

    /* Likes and comments under each row: how many, and whether the viewer
     * has liked it. */
    const ids = feed.items.map((it) => it.id);
    const likes = new Map<string, number>();
    const comments = new Map<string, number>();
    const liked = new Set<string>();
    const captions = new Map<string, string>();
    if (ids.length) {
      try {
        for (const x of await db.rowEntry.findMany({ where: { id: { in: ids }, caption: { not: null } }, select: { id: true, caption: true } })) if (x.caption) captions.set(x.id, x.caption);
        const [l, c, mineL] = await Promise.all([
          db.rowLike.groupBy({ by: ["entryId"], where: { entryId: { in: ids } }, _count: true }),
          db.rowComment.groupBy({ by: ["entryId"], where: { entryId: { in: ids }, deletedAt: null }, _count: true }),
          me ? db.rowLike.findMany({ where: { entryId: { in: ids }, participantId: me }, select: { entryId: true } }) : Promise.resolve([]),
        ]);
        for (const x of l) likes.set(x.entryId, x._count);
        for (const x of c) comments.set(x.entryId, x._count);
        for (const x of mineL) liked.add(x.entryId);
      } catch (err) {
        console.error("row app: failed to read likes and comments for the feed", err);
      }
    }

    /* The face beside each name. */
    const faceOf = new Map<number, string>();
    /* And who wears the black check after it (lib/rowPlus.ts). */
    const plusNums = new Set<number>();
    if (nums.length) {
      const who = await db.rowParticipant.findMany({ where: { challenge: CHALLENGE, rowerNumber: { in: nums } }, select: { id: true, rowerNumber: true, userId: true } });
      const [faces, plus] = await Promise.all([avatarsFor(who.map((p) => p.id)), plusUsers(who.map((p) => p.userId))]);
      for (const p of who) {
        const f = faces.get(p.id);
        if (f) faceOf.set(p.rowerNumber, f);
        if (plus.has(p.userId)) plusNums.add(p.rowerNumber);
      }
    }

    const mine = viewer.me?.rowerNumber ?? null;
    return NextResponse.json(
      {
        ok: true,
        items: feed.items.map((it) => ({ ...it, erg: erg[it.id] ?? null, mine: it.rowerNumber === mine, avatar: faceOf.get(it.rowerNumber) ?? null, plus: plusNums.has(it.rowerNumber), likes: likes.get(it.id) ?? 0, liked: liked.has(it.id), comments: comments.get(it.id) ?? 0, caption: it.masked ? "" : (captions.get(it.id) ?? ""), rel: rel.get(it.rowerNumber) ?? { following: "none", bell: false } })),
        /* How many of these rows are the lead (the rowers the viewer follows). */
        lead: leadRows,
        older,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("row app: failed to build the feed", err);
    return NextResponse.json({ ok: false, error: "The feed could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
