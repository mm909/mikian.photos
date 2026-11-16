import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkBucket, checkPayer, expensesPayload, getExpense, parseExpenseInput, viewWithChildren } from "@/lib/lasd26/expenses";
import { bad, badJson, readJson, requireTsp, requireTspWrite } from "@/lib/tsp/guard";

/**
 * /api/tsp/[team]/expenses — the lasd26 expenses API (src/app/api/lasd26/
 * expenses/route.ts) for one TSP team: the team is the address, the gate is
 * lib/tsp/guard, and "the owner" of the shared rules is a captain.
 *   GET  → the tree + sums the page shows.
 *   POST → add a line: { title, amount, paidById?, estimate?, parentId? }.
 * Unlike lasd26 nobody gets a member row made on the way in: the platform
 * owner looking at someone else's team adds a line as nobody (addedById and
 * paidById null) until he joins through the link.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  const payload = await expensesPayload(gate.viewer, params.team);
  return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const team = params.team;
  const gate = await requireTspWrite(team, "expense");
  if (gate.res) return gate.res;
  const viewer = gate.viewer;
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body);
  if (!parsed.ok) return bad(parsed.error);
  const { title, amountCents, note, estimate, parentId } = parsed.data;
  // The round numbers are the captains' (the lasd26 rule: the estimate is the owner's business).
  if (estimate && !viewer.captain) return bad("Only a captain can add an estimate.", 403);

  if (parentId !== null) {
    const bucket = await checkBucket(parentId, { estimate, team });
    if (!bucket.ok) return bad(bucket.error);
  }

  let paidById: string | null = null;
  if (!estimate) {
    paidById = parsed.data.paidById ?? viewer.member?.id ?? null;
    if (paidById !== null && paidById !== viewer.member?.id) {
      const payer = await checkPayer(paidById, team);
      if (!payer.ok) return bad(payer.error);
    }
  }

  const created = await db.teamExpense.create({
    data: { team, title, amountCents, note, estimate, parentId, paidById, addedById: viewer.member?.id ?? null },
    select: { id: true },
  });
  const expense = await getExpense(created.id, team);
  if (!expense) return bad("Saved, but could not read it back.", 500);
  return NextResponse.json({ ok: true, expense: await viewWithChildren(expense, viewer) });
}
