import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";

/* The sign-up page's two reads. SERVER ONLY. */

/* THE NUMBER THE NEXT ROWER IS HANDED: the highest there is, plus one —
 * the same sum lib/row100kJoin.ts does when it makes the row, so the head
 * of the page promises the number OPT IN gives (unless somebody else opts
 * in first, in which case it is one more). The landing prints the same
 * number off the board (landing/data.ts nextNumber). Null when it cannot
 * be read; the head then says ROWER and no number. */
export async function nextRowerNumber(): Promise<number | null> {
  try {
    const max = await db.rowParticipant.aggregate({
      where: { challenge: CHALLENGE },
      _max: { rowerNumber: true },
    });
    return (max._max.rowerNumber ?? 0) + 1;
  } catch (err) {
    console.error("row100k/join: the next rower number could not be read", err);
    return null;
  }
}

/* True only when the account was LOOKED UP and has no entry. A failed read
 * is false: the front page asks this before it sends an account to /join
 * (join/live.ts), and a database hiccup must not bounce a joined rower off
 * their own front page. */
export async function notJoined(userId: string): Promise<boolean> {
  try {
    const row = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId } },
      select: { id: true },
    });
    return row === null;
  } catch {
    return false;
  }
}
