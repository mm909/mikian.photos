import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";

/* THE ORDERS as the owner reviews them (owner, 2026-09-08): every shirt on
 * the books with who, the size, where they stand on the meters, what the
 * month decided, whether it is paid and whether it was handed over. Server
 * only — read by the dev page and the admin route; a route file may export
 * nothing but its handlers, which is why this lives here. */
export type ShirtOrderRow = {
  id: string;
  rowerNumber: number;
  name: string;
  email: string;
  size: string;
  kind: string;
  status: string;
  amountUsd: number;
  meters: number;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export async function listShirtOrders(): Promise<ShirtOrderRow[]> {
  const orders = await db.rowShirtOrder.findMany({
    where: { challenge: CHALLENGE },
    orderBy: { createdAt: "desc" },
  });
  if (orders.length === 0) return [];
  const pids = [...new Set(orders.map((o) => o.participantId))];
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { id: { in: pids } },
      select: { id: true, displayName: true, userId: true },
    }),
    db.rowEntry.findMany({ where: { participantId: { in: pids } }, select: { participantId: true, meters: true } }),
  ]);
  const accounts = await db.photographer.findMany({
    where: { id: { in: participants.map((p) => p.userId) } },
    select: { id: true, email: true },
  });
  const byPid = new Map(participants.map((p) => [p.id, p]));
  const emailByUser = new Map(accounts.map((a) => [a.id, a.email]));
  const meters = new Map<string, number>();
  for (const e of entries) meters.set(e.participantId, (meters.get(e.participantId) ?? 0) + e.meters);
  return orders.map((o) => {
    const p = byPid.get(o.participantId);
    return {
      id: o.id,
      rowerNumber: o.rowerNumber,
      name: p?.displayName ?? `Rower ${o.rowerNumber}`,
      email: (p && emailByUser.get(p.userId)) ?? "",
      size: o.size,
      kind: o.kind,
      status: o.status,
      amountUsd: o.amountUsd,
      meters: meters.get(o.participantId) ?? 0,
      paidAt: o.paidAt?.toISOString() ?? null,
      deliveredAt: o.deliveredAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    };
  });
}
