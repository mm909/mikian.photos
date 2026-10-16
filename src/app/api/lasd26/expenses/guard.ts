import "server-only";
import { NextResponse } from "next/server";
import { getTeamViewer, type TeamViewer } from "@/lib/lasd26/team";
import { rateLimit } from "@/lib/rateLimit";

/**
 * The gate every /api/lasd26/expenses route stands behind: signed in, on
 * the team (the owner counts), and for writes a lid per account — plenty
 * for a crew of 18 typing in gas receipts, a wall for a script. Returns
 * the viewer, or the response to send back.
 *
 * Two write lids, two keys (the review, 2026-10-15, finding #5: sign +
 * register counted twice per receipt against the 60/hour the expense
 * lines share, so a stack of receipts could lock a member out of adding
 * a line): "expense" is create / edit / delete of a line, 60 an hour;
 * "receipt" is sign / register / remove of a receipt, 400 an hour — two
 * calls per file, so that is ~200 receipts, which nobody in the van has.
 */

export type Gate = { viewer: TeamViewer; res: null } | { viewer: null; res: NextResponse };

export type WriteKind = "expense" | "receipt";

const WRITE_LIMITS: Record<WriteKind, { key: string; limit: number }> = {
  expense: { key: "lasd26-expense-write", limit: 60 },
  receipt: { key: "lasd26-receipt-write", limit: 400 },
};
const WRITE_WINDOW_SEC = 3600;

/** "try again in 1 minute" / "in 12 minutes" — the window is an hour, so never "a few minutes". */
function retryCopy(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `try again in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export async function requireTeam(): Promise<Gate> {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return { viewer: null, res: NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 }) };
  if (!viewer.onTeam) {
    return { viewer: null, res: NextResponse.json({ ok: false, error: "Not on the team — you need the invite link from the group chat." }, { status: 403 }) };
  }
  return { viewer, res: null };
}

export async function requireTeamWrite(kind: WriteKind = "expense"): Promise<Gate> {
  const gate = await requireTeam();
  if (gate.res) return gate;
  const actor = gate.viewer.actor;
  if (!actor) return { viewer: null, res: NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 }) };
  const lid = WRITE_LIMITS[kind];
  const limit = await rateLimit({ key: `${lid.key}:${actor.photographerId}`, limit: lid.limit, windowSec: WRITE_WINDOW_SEC });
  if (!limit.ok) {
    const retryAfterSec = Math.max(1, limit.retryAfterSec);
    return {
      viewer: null,
      res: NextResponse.json(
        { ok: false, error: `That's a lot at once — ${retryCopy(retryAfterSec)}.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
      ),
    };
  }
  return gate;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await req.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const badJson = () => NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
export const notFound = () => NextResponse.json({ ok: false, error: "No such expense." }, { status: 404 });
export const notYours = () => NextResponse.json({ ok: false, error: "Only the owner or whoever added it can change this line." }, { status: 403 });
// A receipt comes off by its attacher or the owner only (owner, 2026-10-16:
// "it's okay for them to delete their own but not other people's").
export const notYourReceipt = () => NextResponse.json({ ok: false, error: "Only the owner or whoever attached this receipt can remove it." }, { status: 403 });
// An estimate line is a category, not a cost (owner, 2026-10-16: "we don't
// need a receipt button for that category, just for the items added under it").
export const notOnEstimate = () => NextResponse.json({ ok: false, error: "Receipts go on the real costs under this category." }, { status: 400 });
