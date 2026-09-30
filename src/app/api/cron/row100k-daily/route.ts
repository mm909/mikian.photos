import { NextResponse } from "next/server";
import { mailEnvelope, sendPlainEmail } from "@/lib/email";
import { nowMs } from "@/lib/row100k";
import { loadDailyInput } from "@/app/row100k/dailyData";
import { dailySummaryMail, isDayKey, yesterdayKey } from "@/app/row100k/dailyMail";

/**
 * The owner's daily summary (Vercel Cron — see vercel.json, 13:15 UTC =
 * 6:15 AM Pacific).
 *
 *   GET /api/cron/row100k-daily            yesterday, on the challenge clock
 *   GET /api/cron/row100k-daily?day=2026-10-01   re-run a day
 *
 * Reads the day (src/app/row100k/dailyData.ts), builds the mail
 * (dailyMail.ts) and sends it to OWNER_EMAIL. The same mail is on the
 * emails page (/row100k/emails?e=daily) built from the same read.
 *
 * Auth: REQUIRES CRON_SECRET (Vercel sends it as a Bearer token). Fails
 * CLOSED — without CRON_SECRET the endpoint is disabled — same as the
 * backup next door. Never throws: a bad read is a 503, a failed send a
 * 500, both with the reason in the body for the cron log.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const asked = new URL(req.url).searchParams.get("day");
  const day = isDayKey(asked) ? asked : yesterdayKey(nowMs());

  let mail;
  let active = 0;
  try {
    const input = await loadDailyInput(day);
    active = input.active;
    mail = dailySummaryMail(input);
  } catch (err) {
    console.error("[row100k-daily] read failed", err);
    return NextResponse.json({ ok: false, day, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }

  const to = mailEnvelope().owner;
  const sent = await sendPlainEmail(to, mail.subject, mail.text, mail.html);
  if (!sent.ok) {
    console.error(`[row100k-daily] send failed for ${day}: ${sent.error}`);
    return NextResponse.json({ ok: false, day, subject: mail.subject, error: sent.error }, { status: 500 });
  }
  console.info(`[row100k-daily] ${day}: ${active} active, sent to ${to}${sent.id ? ` (${sent.id})` : ""}`);
  return NextResponse.json({ ok: true, day, to, subject: mail.subject, id: sent.id });
}
