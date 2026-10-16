import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TEAM, ensureOwnerMember } from "@/lib/lasd26/team";
import { checkBucket, checkPayer, expensesPayload, getExpense, parseExpenseInput, viewWithChildren } from "@/lib/lasd26/expenses";
import { badJson, readJson, requireTeam, requireTeamWrite } from "./guard";

/**
 * GET  /api/lasd26/expenses — the tree + sums the page shows (team only):
 *      top-level lines newest first, each bucket with its children inside,
 *      the roster for the PAID BY select, and the viewer's own member id.
 * POST /api/lasd26/expenses — add a line: { title ≤ 80, amount,
 *      paidById?: string | null, estimate?: boolean, parentId?: string |
 *      null, note? ≤ 400 } → { ok, expense }.
 *      paidById is who fronted it (owner, 2026-10-16: "make it a 'paid
 *      by' and auto fill the name of the user logged in"): a member of
 *      this team, 400 otherwise; left out or null, it is the caller's own
 *      member — the owner gets his row made on the way in. parentId files
 *      the line under a bucket (owner: "add real expenses to the food/gas
 *      estimates"): it must be a live, top-level ESTIMATE of this team,
 *      and the new line cannot be an estimate itself — 400 otherwise
 *      (lib/lasd26/expenses checkBucket). Receipts come after, through
 *      /[id]/receipts/sign then /[id]/receipts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireTeam();
  if (gate.res) return gate.res;
  const viewer = await ensureOwnerMember(gate.viewer);
  const payload = await expensesPayload(viewer);
  return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  // The owner is on the crew: a line he adds before he has taken the
  // invite link gets him a TeamMember row first (the review, 2026-10-15,
  // finding #6), so the line is his and PAID BY can name him.
  const viewer = await ensureOwnerMember(gate.viewer);
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const { title, amountCents, note, estimate, parentId } = parsed.data;

  if (parentId !== null) {
    const bucket = await checkBucket(parentId, { estimate });
    if (!bucket.ok) return NextResponse.json({ ok: false, error: bucket.error }, { status: 400 });
  }

  // Who fronted it: the body's member, else the caller. An estimate is
  // nobody's — a round number has not been paid by anyone.
  let paidById: string | null = null;
  if (!estimate) {
    paidById = parsed.data.paidById ?? viewer.member?.id ?? null;
    if (paidById !== null && paidById !== viewer.member?.id) {
      const payer = await checkPayer(paidById);
      if (!payer.ok) return NextResponse.json({ ok: false, error: payer.error }, { status: 400 });
    }
  }

  const created = await db.teamExpense.create({
    data: {
      team: TEAM,
      title,
      amountCents,
      note,
      estimate,
      parentId,
      paidById,
      // Never null for a line added here: the owner gets his member row
      // on the way in (ensureOwnerMember), so "FROM THE COST SHEET" is
      // only ever a seeded line.
      addedById: viewer.member?.id ?? null,
    },
    select: { id: true },
  });
  const expense = await getExpense(created.id);
  if (!expense) return NextResponse.json({ ok: false, error: "Saved, but could not read it back." }, { status: 500 });
  return NextResponse.json({ ok: true, expense: await viewWithChildren(expense, viewer) });
}
