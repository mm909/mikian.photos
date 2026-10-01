import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { preorderCounts, type Counts, type Mine, type PreorderLite } from "./shirtPreorder";

/* THE PRE-ORDERS as the server reads them (owner, 2026-09-30). Server
 * only — the page, the route and the owner's list all read through here;
 * a route file may export nothing but its handlers, which is why this
 * lives beside shirtOrders.ts rather than in the route. */

type Row = PreorderLite & { participantId: string };

async function listRows(): Promise<Row[]> {
  return db.rowShirtPreorder.findMany({
    where: { challenge: CHALLENGE },
    select: { participantId: true, color: true, size: true, cancelledAt: true },
  });
}

/* The public counts and, for a participant, their own live reservations by
 * colour (null where they have none). One read for both. */
export async function preorderState(participantId: string | null): Promise<{ counts: Counts; mine: Mine | null }> {
  const rows = await listRows();
  const counts = preorderCounts(rows);
  if (!participantId) return { counts, mine: null };
  const mine: Mine = { black: null, cream: null };
  for (const r of rows) {
    if (r.participantId !== participantId || r.cancelledAt) continue;
    if (r.color === "black" || r.color === "cream") mine[r.color] = r.size;
  }
  return { counts, mine };
}

/* The owner's list: every live reservation with who, which shirt, the
 * size and when it was made. Let-go rows are not on it — the list is what
 * gets ordered. Newest first. */
export type PreorderRow = {
  id: string;
  rowerNumber: number;
  name: string;
  email: string;
  color: string;
  size: string;
  createdAt: string;
  updatedAt: string;
};

export async function listPreorders(): Promise<PreorderRow[]> {
  const rows = await db.rowShirtPreorder.findMany({
    where: { challenge: CHALLENGE, cancelledAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return [];
  const pids = [...new Set(rows.map((r) => r.participantId))];
  const participants = await db.rowParticipant.findMany({
    where: { id: { in: pids } },
    select: { id: true, displayName: true, userId: true },
  });
  const accounts = await db.photographer.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true },
  });
  const byPid = new Map(participants.map((p) => [p.id, p]));
  const emailByUser = new Map(accounts.map((a) => [a.id, a.email]));
  return rows.map((r) => {
    const p = byPid.get(r.participantId);
    return {
      id: r.id,
      rowerNumber: r.rowerNumber,
      name: p?.displayName ?? `Rower ${r.rowerNumber}`,
      email: (p && emailByUser.get(p.userId)) || "",
      color: r.color,
      size: r.size,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}
