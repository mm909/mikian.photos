import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPlainEmail } from "@/lib/email";
import { resolveBaseUrl } from "@/lib/createOrder";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, fmtDay, isRow100kAdmin, nowMs } from "@/lib/row100k";
import { FIRST_MONTH_KEY, monthFromKey, type Month } from "@/lib/rowPeriod";
import { SHIRT_FREE_AT, SHIRT_PRICE_USD, settleMonthDefault } from "@/app/row100k/shirt";
import { settledEmail } from "@/app/row100k/shirtEmail";

export const runtime = "nodejs";

/* SETTLING A MONTH (owner, 2026-09-08: "build what I need to bill at the
 * end of the month if it applies"). Admin only, from /row100k/shop-admin.
 * For every shirt still "reserved": the rower's meters IN THAT MONTH
 * decide — at or past the 100K it becomes "free"; short of it, "owed",
 * with an email carrying a pay link to /row100k/shirt/pay (PayPal or
 * card, the photo shop's connection). Each rower is told either way, with
 * the pick-up reminder.
 *
 * WHICH MONTH (2026-09-28, the October rollover): ?m=YYYY-MM or body.m,
 * else the previous month (shirt.ts settleMonthDefault) — the site is in
 * October when September is settled, so gating on this month's end could
 * never run. Refuses while that month is still going, unless the caller
 * is testing outside production with { force: true }. Safe to run twice:
 * settled shirts are skipped. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) return bad("Sign in with Google first.", 401);
  if (!isRow100kAdmin(actor.email, actor.roles)) return bad("Not allowed.", 403);

  let body: { force?: unknown; dryRun?: unknown; m?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }
  const force = body.force === true && process.env.NODE_ENV !== "production";
  const dryRun = body.dryRun === true;

  const asked = new URL(req.url).searchParams.get("m") ?? (typeof body.m === "string" ? body.m : null);
  let m: Month;
  if (asked !== null) {
    const parsed = monthFromKey(asked.trim());
    if (!parsed || parsed.key < FIRST_MONTH_KEY) return bad("Not a month to settle — m=YYYY-MM.");
    m = parsed;
  } else {
    m = settleMonthDefault();
  }
  if (nowMs() < m.endMs && !force) {
    return bad(`The month has not ended — settle after ${fmtDay(m.lastDay)}.`, 409);
  }

  const payUrl = `${resolveBaseUrl(req)}/row100k/shirt/pay`;

  try {
    const open = await db.rowShirtOrder.findMany({
      where: { challenge: CHALLENGE, status: "reserved" },
      select: { id: true, participantId: true, rowerNumber: true, size: true, payerEmail: true },
    });
    const results: { rowerNumber: number; size: string; meters: number; outcome: "free" | "owed"; emailed: boolean }[] = [];

    for (const o of open) {
      const [rows, p] = await Promise.all([
        // That month's rows only: the deal is the month the shirt was
        // bought in, not everything ever rowed.
        db.rowEntry.findMany({
          where: { participantId: o.participantId, day: { gte: m.firstDay, lte: m.lastDay } },
          select: { meters: true },
        }),
        db.rowParticipant.findUnique({
          where: { id: o.participantId },
          select: { displayName: true, userId: true },
        }),
      ]);
      // The rower's address is on their account, not the participant row;
      // the order remembers the address it was bought under as a fallback.
      const account = p?.userId
        ? await db.photographer.findUnique({ where: { id: p.userId }, select: { email: true } })
        : null;
      const meters = rows.reduce((s, r) => s + r.meters, 0);
      const free = meters >= SHIRT_FREE_AT;
      const outcome = free ? "free" : "owed";

      if (!dryRun) {
        await db.rowShirtOrder.update({
          where: { id: o.id },
          data: { status: outcome, amountUsd: free ? 0 : SHIRT_PRICE_USD },
        });
      }

      let emailed = false;
      const to = account?.email || o.payerEmail;
      if (!dryRun && to) {
        const mail = settledEmail({
          name: p?.displayName ?? `Rower ${o.rowerNumber}`,
          rowerNumber: o.rowerNumber,
          size: o.size,
          meters,
          free,
          payUrl,
          month: m.label,
        });
        const sent = await sendPlainEmail(to, mail.subject, mail.text, mail.html);
        emailed = sent.ok;
        if (!sent.ok) console.error(`row100k shirt: settle email failed for rower ${o.rowerNumber}`, sent.error);
      }
      results.push({ rowerNumber: o.rowerNumber, size: o.size, meters, outcome, emailed });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      month: m.key,
      label: m.label,
      settled: results.length,
      free: results.filter((r) => r.outcome === "free").length,
      owed: results.filter((r) => r.outcome === "owed").length,
      results,
    });
  } catch (err) {
    console.error("row100k shirt: settle failed", err);
    return bad("Couldn't settle — try again.", 503);
  }
}
