import "server-only";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getTspViewer, tspActor, tspGateOpen, type TspViewer } from "./team";

/**
 * The gate every /api/tsp/[team]/… route stands behind (the lasd26 guard,
 * src/app/api/lasd26/expenses/guard.ts, with the team read off the address):
 * the dev gate while the site is not live, signed in, on THIS team (a
 * captain and the platform owner count), and for writes a lid per account.
 * Returns the viewer, or the response to send back.
 */

export type TspGate = { viewer: TspViewer; res: null } | { viewer: null; res: NextResponse };

export type WriteKind = "expense" | "receipt" | "info" | "legs" | "position" | "team";

const WRITE_LIMITS: Record<WriteKind, number> = { expense: 60, receipt: 400, info: 120, legs: 240, position: 2000, team: 60 };
const WINDOW_SEC = 3600;

const deny = (error: string, status: number, headers?: Record<string, string>): TspGate => ({ viewer: null, res: NextResponse.json({ ok: false, error }, { status, headers }) });

export async function requireTsp(slug: string): Promise<TspGate> {
  const actor = await tspActor();
  // Behind the dev gate the API is as missing as the pages are.
  if (!tspGateOpen(actor)) return deny("Not found.", 404);
  const viewer = await getTspViewer(slug, actor);
  if (!viewer) return deny("No such team.", 404);
  if (!viewer.actor) return deny("Sign in first.", 401);
  if (!viewer.onTeam) return deny("Not on this team — you need the invite link from your captain.", 403);
  return { viewer, res: null };
}

export async function requireTspWrite(slug: string, kind: WriteKind): Promise<TspGate> {
  const gate = await requireTsp(slug);
  if (gate.res) return gate;
  const actor = gate.viewer.actor;
  if (!actor) return deny("Sign in first.", 401);
  const limit = await rateLimit({ key: `tsp-${kind}-write:${actor.photographerId}`, limit: WRITE_LIMITS[kind], windowSec: WINDOW_SEC });
  if (!limit.ok) {
    const sec = Math.max(1, limit.retryAfterSec);
    const min = Math.max(1, Math.ceil(sec / 60));
    return deny(`That's a lot at once — try again in ${min} minute${min === 1 ? "" : "s"}.`, 429, { "Retry-After": String(sec) });
  }
  return gate;
}

/** A captain's write: the invite link, the roster, the team's settings, the info sheet. */
export async function requireTspCaptain(slug: string, kind: WriteKind = "team"): Promise<TspGate> {
  const gate = await requireTspWrite(slug, kind);
  if (gate.res) return gate;
  if (!gate.viewer.captain) return deny("Only a team captain can do that.", 403);
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
export const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
