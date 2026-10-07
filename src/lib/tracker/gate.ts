import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";

/**
 * Who may see the tracker, in one place.
 *
 * IN DEVELOPMENT (owner, 2026-10-06: "push any pages once they are live but
 * gate them behind the admin", and the standing rule in CLAUDE.md): every
 * /track page and the read APIs it polls answer 404 in production to anyone
 * who is not an admin, and are open on a laptop. When the owner says the
 * tracker goes live, flip TRACKER_PUBLIC to true, drop the "(dev)" title tag
 * (devTitle) and move the account-menu link out of DEVELOPMENT.
 *
 * The write paths are NOT behind the admin: Traccar's webhook carries a
 * shared secret, the crew/van pages carry the event's crew key. Those are
 * the spec's own gates and they stay as they are when the pages go public.
 */
export const TRACKER_PUBLIC = false;

export async function trackerAdmin(): Promise<boolean> {
  try {
    const actor = await getEffectiveActor();
    return Boolean(actor && isAdmin(actor));
  } catch {
    return false;
  }
}

/** May this request read tracker pages and snapshots? */
export async function trackerReadAllowed(): Promise<{ allowed: boolean; admin: boolean }> {
  const admin = await trackerAdmin();
  if (TRACKER_PUBLIC || process.env.NODE_ENV !== "production") return { allowed: true, admin };
  return { allowed: admin, admin };
}

/** For pages: 404 (never a sign-in prompt) when the tracker is not for this viewer. */
export async function gateTrackerPage(): Promise<{ admin: boolean }> {
  const { allowed, admin } = await trackerReadAllowed();
  if (!allowed) notFound();
  return { admin };
}

/** For read API routes: a 404 Response to return, or null to proceed. */
export async function gateTrackerApi(): Promise<NextResponse | null> {
  const { allowed } = await trackerReadAllowed();
  return allowed ? null : new NextResponse(null, { status: 404 });
}

/** For admin-only API routes (sync, backfill, admin handoffs): 404 unless admin. */
export async function gateTrackerAdminApi(): Promise<NextResponse | null> {
  return (await trackerAdmin()) ? null : new NextResponse(null, { status: 404 });
}

/** "Live (dev) — …" while in development; plain once public. */
export function devTitle(title: string): string {
  return TRACKER_PUBLIC ? title : `${title} (dev)`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * The crew key check. An event whose key resolved to "" (env var unset in
 * production) accepts nothing — there is no empty-key door.
 */
export function crewKeyOk(expected: string | null | undefined, given: string | null | undefined): boolean {
  if (!expected || !given) return false;
  return safeEqual(expected, given.trim());
}

/** The crew key from a request: ?k=, X-Crew-Key, or a JSON body's `k`. */
export function crewKeyFrom(req: Request, body?: unknown): string | null {
  const url = new URL(req.url);
  const q = url.searchParams.get("k");
  if (q) return q;
  const h = req.headers.get("x-crew-key");
  if (h) return h;
  if (body && typeof body === "object" && typeof (body as { k?: unknown }).k === "string") {
    return (body as { k: string }).k;
  }
  return null;
}

/**
 * The Traccar webhook secret: TRACKER_TRACCAR_SECRET. Accepted either as the
 * path segment (/api/track/ingest/traccar/<secret>, the spec's shape) or as
 * `Authorization: Bearer <secret>` (Traccar's forward.header). Unset → the
 * webhook is disabled (fails closed), like the cron routes.
 */
export function traccarSecretOk(req: Request, pathSecret: string | null | undefined): boolean {
  const expected = (process.env.TRACKER_TRACCAR_SECRET ?? "").trim();
  if (!expected) return false;
  if (pathSecret && safeEqual(expected, pathSecret)) return true;
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return Boolean(m && safeEqual(expected, m[1].trim()));
}
