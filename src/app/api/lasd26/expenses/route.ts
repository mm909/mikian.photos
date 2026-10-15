import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TEAM, type TeamViewer } from "@/lib/lasd26/team";
import { expensesPayload, getExpense, parseExpenseInput, toView } from "@/lib/lasd26/expenses";
import { badJson, readJson, requireTeam, requireTeamWrite } from "./guard";

/**
 * GET  /api/lasd26/expenses — the list + sums the page shows (team only).
 * POST /api/lasd26/expenses — add a line: { title ≤ 80, amount, note? ≤ 400,
 *      estimate?: boolean } → { ok, expense }. Receipts come after, through
 *      /[id]/receipts/sign then /[id]/receipts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The member id a new line is filed under. The owner is on the crew, so a
 * line he adds before he has taken the invite link gets him a TeamMember
 * row first (role "runner", name and email from the account) instead of
 * saving as nobody's and reading "FROM THE COST SHEET" (the review,
 * 2026-10-15, finding #6). joinTeam needs a token, so this is the same
 * upsert on {team, userId} without one; a later join through the link
 * only updates the row. Anyone else is already a member (requireTeam).
 */
async function addedByIdFor(viewer: TeamViewer): Promise<string | null> {
  if (viewer.member) return viewer.member.id;
  const actor = viewer.actor;
  if (!viewer.owner || !actor) return null;
  const name = actor.name.trim().slice(0, 80) || actor.email;
  const row = await db.teamMember.upsert({
    where: { team_userId: { team: TEAM, userId: actor.photographerId } },
    create: { team: TEAM, userId: actor.photographerId, email: actor.email, name, role: "runner" },
    update: {},
    select: { id: true },
  });
  return row.id;
}

export async function GET() {
  const gate = await requireTeam();
  if (gate.res) return gate.res;
  const payload = await expensesPayload(gate.viewer);
  return NextResponse.json({ ok: true, ...payload }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const gate = await requireTeamWrite();
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const parsed = parseExpenseInput(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const { title, amountCents, note, estimate } = parsed.data;

  const addedById = await addedByIdFor(gate.viewer);
  const created = await db.teamExpense.create({
    data: {
      team: TEAM,
      title,
      amountCents,
      note,
      estimate,
      // Never null for a line added here: the owner gets his member row
      // on the way in (addedByIdFor), so "FROM THE COST SHEET" is only
      // ever a seeded line.
      addedById,
    },
    select: { id: true },
  });
  const expense = await getExpense(created.id);
  if (!expense) return NextResponse.json({ ok: false, error: "Saved, but could not read it back." }, { status: 500 });
  return NextResponse.json({ ok: true, expense: toView(expense, gate.viewer) });
}
