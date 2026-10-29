import { NextResponse } from "next/server";
import { sendOwnerNotification } from "@/lib/email";
import { ensureOwnerMember, getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor, memberDue } from "@/lib/lasd26/settle";
import { fmtUsd, wholeDollarsUp } from "@/lib/lasd26/money";

export const runtime = "nodejs";

/* I SENT IT — the route behind /lasd26/your-share (owner, 2026-10-29:
 * "Instead of collecting payment through PayPal, add my Venmo and Zelle …
 * PayPal fees were too high"). Nothing is charged here any more: a member
 * sends their share by Venmo or Zelle themselves, taps I SENT IT, and this
 * route EMAILS THE OWNER what they say they sent (CLAUDE.md: every
 * submission emails the owner). The row is marked paid by the owner on the
 * team console (Mark paid) once the money lands — a claim here records
 * nothing.
 *
 *   POST { action: "sent", amountCents, via }   via: "venmo" | "zelle"
 *
 * The amount is checked against the share less what they fronted, rounded
 * up to the whole dollar (money.ts wholeDollarsUp), as the page shows it;
 * the pool (the owner) may claim up to his whole share, his test of the
 * page.
 *
 * Guards, in order: signed in, on the team, settling up open OR the owner,
 * and something still owed (the pool excepted). */

const MIN_CENTS = 100;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ensureOwnerMember(await getTeamViewer(TEAM));
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.member) return bad("Join the team through the invite link first.", 403);

  let body: { action?: unknown; amountCents?: unknown; via?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }
  if (body.action !== "sent") return bad("action must be sent.");
  const via = body.via === "venmo" ? "Venmo" : body.via === "zelle" ? "Zelle" : null;
  if (!via) return bad("via must be venmo or zelle.");

  const due = await dueFor(TEAM);
  if (!due.settleOpen && !viewer.owner) return bad("Settling up opens after the race — the crew will send the word.", 403);
  const mine = memberDue(viewer.member, due);
  const pool = mine.status === "pool";
  if (!pool && mine.status === "paid") return bad("Already paid — thank you.", 409);
  if (!pool && mine.status === "owed") return bad(`Nothing to pay — you fronted more than your share, Mikian owes you ${fmtUsd(mine.owedCents)}.`, 409);
  if (!pool && mine.status === "square") return bad("All square — nothing to pay.", 409);
  if (!pool && mine.outstandingCents <= 0) return bad("Nothing to pay yet — the cost sheet is empty.", 409);
  const ceiling = wholeDollarsUp(pool ? mine.shareCents : mine.outstandingCents);

  const cents = typeof body.amountCents === "number" && Number.isInteger(body.amountCents) ? body.amountCents : NaN;
  if (!Number.isFinite(cents) || cents < MIN_CENTS) return bad(`Pick an amount of at least ${fmtUsd(MIN_CENTS, { whole: true })}.`);
  if (cents > ceiling) return bad(`Your share is ${fmtUsd(ceiling, { whole: true })} — no need to send more than that.`);

  // Every claim emails the owner, whatever its size (CLAUDE.md; owner,
  // 2026-10-29: "Make sure I get an email when someone submits something").
  const who = `${viewer.member.name} <${viewer.member.email}>`;
  const sent = await sendOwnerNotification(
    pool ? `LASD26 — your own test: ${fmtUsd(cents)} by ${via}` : `LASD26 — ${viewer.member.name} sent ${fmtUsd(cents)} by ${via}`,
    `${who} says they sent ${fmtUsd(cents)} by ${via} on /lasd26/your-share.\n\n` +
      (pool
        ? "Your own test — nothing to mark.\n"
        : `Share ${fmtUsd(mine.shareCents)} · fronted ${fmtUsd(mine.frontedCents)} · owed ${fmtUsd(mine.outstandingCents)} · could send up to ${fmtUsd(ceiling, { whole: true })}\nOnce it lands, mark them paid on the team console: /lasd26/team\n`) +
      new Date().toISOString(),
    viewer.member.email,
  );
  if (!sent.ok) console.error("lasd26/your-share: owner email failed", sent.error);

  return NextResponse.json({ ok: true, amount: fmtUsd(cents), via });
}
