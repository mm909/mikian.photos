import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPlainEmail } from "@/lib/email";
import { resolveBaseUrl } from "@/lib/createOrder";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, END_MS, isRow100kAdmin, nowMs } from "@/lib/row100k";
import { SHIRT_FREE_AT, SHIRT_PRICE_USD, settledEmail } from "@/app/row100k/shirt";

export const runtime = "nodejs";

/* SETTLING THE MONTH (owner, 2026-09-08: "build what I need to bill at the
 * end of the month if it applies"). Admin only. For every shirt still
 * "reserved": the rower's meters decide — at or past the 100K it becomes
 * "free"; short of it, "owed", with an email carrying a pay link to
 * /row100k/shirt/pay (PayPal or card, the photo shop's connection). Each
 * rower is told either way, with the pick-up reminder.
 *
 * Runs once the month has ended (END_MS). Before that it refuses, unless
 * the caller is testing outside production with { force: true }. Safe to
 * run twice: settled shirts are skipped. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) return bad("Sign in with Google first.", 401);
  if (!isRow100kAdmin(actor.email, actor.roles)) return bad("Not allowed.", 403);

  let body: { force?: unknown; dryRun?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body is fine */
  }
  const force = body.force === true && process.env.NODE_ENV !== "production";
  const dryRun = body.dryRun === true;
  if (nowMs() < END_MS && !force) {
    return bad("The month has not ended — settle after Sep 30.", 409);
  }

  const payUrl = `${resolveBaseUrl(req)}/row100k/shirt/pay`;

  try {
    const open = await db.rowShirtOrder.findMany({
      where: { challenge: CHALLENGE, status: "reserved" },
      select: { id: true, participantId: true, rowerNumber: true, size: true },
    });
    const results: { rowerNumber: number; size: string; meters: number; outcome: "free" | "owed"; emailed: boolean }[] = [];

    for (const o of open) {
      const [rows, p] = await Promise.all([
        db.rowEntry.findMany({ where: { participantId: o.participantId }, select: { meters: true } }),
        db.rowParticipant.findUnique({
          where: { id: o.participantId },
          select: { displayName: true, userId: true },
        }),
      ]);
      // The rower's address is on their account, not the participant row.
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
      const to = account?.email;
      if (!dryRun && to) {
        const mail = settledEmail({
          name: p?.displayName ?? `Rower ${o.rowerNumber}`,
          rowerNumber: o.rowerNumber,
          size: o.size,
          meters,
          free,
          payUrl,
        });
        const sent = await sendPlainEmail(to, mail.subject, mail.text);
        emailed = sent.ok;
        if (!sent.ok) console.error(`row100k shirt: settle email failed for rower ${o.rowerNumber}`, sent.error);
      }
      results.push({ rowerNumber: o.rowerNumber, size: o.size, meters, outcome, emailed });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
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
