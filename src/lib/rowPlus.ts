import { db } from "@/lib/db";

/* WHO WEARS THE BLACK CHECK (owner, 2026-11-22: "we should denote
 * somewhere here if they are a telemetry subscriber ... definitely never
 * say subscriber ... it's a black verified check mark"). The app draws it
 * after a rower's name, on their page and on their rows in the feed.
 *
 * NOBODY HAS PAID FOR ANYTHING YET: there is no checkout. Until there is,
 * the check is worn by the site's own admins and nobody else, so the owner
 * can see it where it will go. When Telemetry is on sale, this is the one
 * function to change: answer the accounts that hold it.
 *
 * Takes account ids (RowParticipant.userId) and answers the ones that wear
 * it. Never throws: a failed read is nobody. */
export async function plusUsers(userIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Set();
  try {
    const rows = await db.photographer.findMany({ where: { id: { in: ids }, isAdmin: true }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  } catch (err) {
    console.error("rowPlus: failed to read who wears the check", err);
    return new Set();
  }
}
