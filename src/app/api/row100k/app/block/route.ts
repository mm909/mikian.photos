import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { relation } from "@/lib/rowSocial";
import { asRower, no, rowerByNum, yes } from "../social";

/* BLOCKING, for the phone app (2026-11-21; owner, 2026-11-20: block
 * "just from the feed and profile"). POST { num, on }.
 *
 * A block cuts both ways and both of them stay on the board: neither sees
 * the other's rows in the feed or the other's profile. It also ends any
 * following between the two and clears what each had been told about the
 * other. The blocked rower is not told. Unblocking restores nothing: they
 * would have to follow again. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const who = await asRower();
  if ("denied" in who) return who.denied;
  const me = who.me;
  try {
    const body = (await req.json().catch(() => null)) as { num?: unknown; on?: unknown } | null;
    const them = await rowerByNum(body?.num);
    if (!them) return no("No such rower.", 404);
    if (them.id === me.id) return no("That is you.", 400);
    if (body?.on === false) {
      await db.rowBlock.deleteMany({ where: { blockerId: me.id, blockedId: them.id } });
    } else {
      await db.rowBlock.upsert({
        where: { blockerId_blockedId: { blockerId: me.id, blockedId: them.id } },
        create: { challenge: CHALLENGE, blockerId: me.id, blockedId: them.id },
        update: {},
      });
      await db.rowFollow.deleteMany({
        where: {
          OR: [
            { followerId: me.id, followeeId: them.id },
            { followerId: them.id, followeeId: me.id },
          ],
        },
      });
      await db.rowNotification.deleteMany({
        where: {
          OR: [
            { participantId: me.id, actorId: them.id },
            { participantId: them.id, actorId: me.id },
          ],
        },
      });
    }
    return yes({ rel: await relation(me.id, them.id) });
  } catch (err) {
    console.error("row app: block failed", err);
    return no("That did not go through. Try again.", 500);
  }
}
