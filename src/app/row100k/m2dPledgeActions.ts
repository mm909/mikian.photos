import { db } from "@/lib/db";
import { sendOwnerNotification, sendPlainEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/rowNotify";
import { CHALLENGE } from "@/lib/row100k";
import { M2D_KEY, m2dOptIns, m2dWindow } from "./m2d";
import { doneMail, ownerPledgeText, welcomeMail } from "./m2dPledgeMail";
import { filledPledges, pledgeLine, pledgesWhere, type PledgeRow } from "./m2dPledges";

/* What the pledge routes and the cron do (m2dPledges.ts has the rules).
 * SERVER ONLY. */

/* A GIVER SAVES A PLEDGE. A pending one of theirs is changed in place (no
 * pile of drafts for the owner to wade through); otherwise a new one,
 * pending. Every save emails the owner (CLAUDE.md), logged, never
 * surfaced. */
export async function savePledge(
  actor: { photographerId: string; email: string },
  p: { centsPerKm: number; capDollars: number; name: string; note: string; anonymous: boolean },
): Promise<PledgeRow> {
  const pending = (await pledgesWhere({ accountId: actor.photographerId, status: "pending" }))[0];
  const data = { name: p.name, anonymous: p.anonymous, centsPerKm: p.centsPerKm, capDollars: p.capDollars, note: p.note, email: actor.email };
  const saved = pending
    ? await db.m2dPledge.update({ where: { id: pending.id }, data })
    : await db.m2dPledge.create({ data: { ...data, challenge: CHALLENGE, window: M2D_KEY, accountId: actor.photographerId } });
  const { subject, text } = ownerPledgeText({ ...saved }, !pending);
  /* The push is the alert; the email only when it could not go (owner,
   * 2026-11-26, rowNotify.ts notifyOwner). */
  if (!(await notifyOwner(subject, { kind: "m2d" }).catch(() => false))) {
    const sent = await sendOwnerNotification(subject, text, actor.email).catch((err) => ({ ok: false as const, error: String(err) }));
    if (!sent.ok) console.error("M2D pledge: owner email failed", sent.error);
  }
  return saved;
}

/* THE OWNER APPROVES OR DECLINES. Approval starts the pledge now (it fills
 * from the next kilometer logged) and sends the welcome; a failed send is
 * logged and left for the next sweep to retry. Only a pending pledge can be
 * decided; an approved one can still be declined (it then stops counting). */
export async function decidePledge(id: string, action: "approve" | "decline", by: string): Promise<PledgeRow | string> {
  const p = await db.m2dPledge.findUnique({ where: { id } });
  if (!p || p.challenge !== CHALLENGE) return "No such pledge.";
  if (action === "approve") {
    if (p.status === "approved") return "It is already approved.";
    const saved = await db.m2dPledge.update({ where: { id }, data: { status: "approved", decidedAt: new Date(), decidedBy: by } });
    await sendWelcome(saved);
    return (await db.m2dPledge.findUnique({ where: { id } })) ?? saved;
  }
  if (p.status === "declined") return "It is already declined.";
  return db.m2dPledge.update({ where: { id }, data: { status: "declined", decidedAt: new Date(), decidedBy: by } });
}

async function sendWelcome(p: PledgeRow): Promise<void> {
  const m = welcomeMail(p);
  const sent = await sendPlainEmail(p.email, m.subject, m.text, m.html).catch((err) => ({ ok: false as const, error: String(err) }));
  if (sent.ok) await db.m2dPledge.update({ where: { id: p.id }, data: { welcomeSentAt: new Date() } });
  else console.error("M2D pledge: welcome email failed", p.id, sent.error);
}

/* THE SWEEP (the daily cron, and every time the owner opens his list): a
 * welcome that did not go out is sent again; a pledge whose cap has filled
 * is marked claimed and gets its total and split; at the close every
 * approved pledge not yet told gets the same. Each send is stamped, so a
 * pledge is told once. */
export async function sweepPledges(): Promise<{ welcomed: number; done: number }> {
  const approved = await pledgesWhere({ status: "approved" });
  if (approved.length === 0) return { welcomed: 0, done: 0 };
  let welcomed = 0;
  let done = 0;
  for (const p of approved)
    if (!p.welcomeSentAt) {
      await sendWelcome(p);
      welcomed++;
    }
  const over = m2dWindow().over;
  const ins = await m2dOptIns();
  for (const p of await filledPledges(ins, approved)) {
    if (p.fill.filled && !p.claimedAt) await db.m2dPledge.update({ where: { id: p.id }, data: { claimedAt: p.fill.filledAt } });
    if (p.doneSentAt || !(p.fill.filled || over)) continue;
    const m = doneMail(p, p.fill);
    const sent = await sendPlainEmail(p.email, m.subject, m.text, m.html).catch((err) => ({ ok: false as const, error: String(err) }));
    if (sent.ok) {
      await db.m2dPledge.update({ where: { id: p.id }, data: { doneSentAt: new Date() } });
      done++;
    } else console.error("M2D pledge: done email failed", p.id, sent.error);
  }
  return { welcomed, done };
}

/* WHAT THE PAGES DRAW: pledges as plain JSON, each approved one with its
 * fill. `accountId` set: one giver's own; unset: all of them (the owner). */
export type PledgeView = {
  id: string;
  name: string;
  email: string;
  centsPerKm: number;
  capDollars: number;
  note: string;
  anonymous: boolean;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  welcomeSentAt: string | null;
  claimedAt: string | null;
  doneSentAt: string | null;
  line: string;
  fill: { km: number; capKm: number; dollars: number; filled: boolean; split: Record<string, number> } | null;
};
export async function pledgeViews(accountId?: string): Promise<PledgeView[]> {
  const all = await pledgesWhere(accountId ? { accountId } : {});
  const approved = all.filter((p) => p.status === "approved");
  const ins = approved.length ? await m2dOptIns() : new Map();
  const fills = new Map((await filledPledges(ins, approved)).map((p) => [p.id, p.fill]));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return all.map((p) => {
    const f = fills.get(p.id);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      centsPerKm: p.centsPerKm,
      capDollars: p.capDollars,
      note: p.note,
      anonymous: p.anonymous,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      decidedAt: iso(p.decidedAt),
      welcomeSentAt: iso(p.welcomeSentAt),
      claimedAt: iso(p.claimedAt),
      doneSentAt: iso(p.doneSentAt),
      line: pledgeLine(p),
      fill: f ? { km: f.km, capKm: f.capKm, dollars: f.dollars, filled: f.filled, split: f.split } : null,
    };
  });
}
