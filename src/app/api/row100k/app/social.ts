import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE, fmtRowerNumber } from "@/lib/row100k";
import { resolveViewer, type Viewer, type ViewerParticipant } from "@/lib/row100kViewer";
import { avatarsFor, relation, type FollowState } from "@/lib/rowSocial";

/* What the social routes beside this file share (2026-11-21): the answer
 * shapes, who is asking, the rower a request names, and one rower as a line
 * in a list of people. Not a route. */

export const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
export const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
export const yes = (body: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...body }, { headers: NO_STORE });

/* IN DEVELOPMENT (CLAUDE.md, "New pages start in development"; owner,
 * 2026-10-01). The phone app is not live, so in production the routes that
 * only it writes through (follow, block, report, settings, the notification
 * centre, push tokens) answer admins and nobody else, as the erg routes do.
 * Open on a laptop. When the owner says the app is live, this becomes true. */
export const SOCIAL_LIVE = false;
export const socialClosedTo = (v: Viewer) => !SOCIAL_LIVE && process.env.NODE_ENV === "production" && !v.isAdmin;

/* The signed-in rower, or the answer to send instead. */
export async function asRower(): Promise<{ viewer: Viewer; me: ViewerParticipant } | { denied: NextResponse }> {
  const viewer = await resolveViewer();
  if (!viewer.actor) return { denied: no("Sign in first.", 401) };
  if (socialClosedTo(viewer)) return { denied: no("Not open yet.", 404) };
  if (!viewer.me) return { denied: no("Join first.", 403) };
  return { viewer, me: viewer.me };
}

/* A row this viewer may see, to like it or read and write under it: not a
 * private rower's unless they accepted the viewer, and nobody's across a
 * block (lib/rowSocial.ts). Their own always. */
export async function seeEntry(viewerId: string | null, raw: unknown): Promise<{ id: string; participantId: string } | null> {
  const id = typeof raw === "string" && /^[a-z0-9]{1,40}$/i.test(raw) ? raw : "";
  if (!id) return null;
  const e = await db.rowEntry.findFirst({ where: { id, challenge: CHALLENGE }, select: { id: true, participantId: true } });
  if (!e) return null;
  if (e.participantId === viewerId) return e;
  return (await relation(viewerId, e.participantId)).access === "open" ? e : null;
}

export type Subject = { id: string; rowerNumber: number; displayName: string; instagram: string; userId: string };

export async function rowerByNum(raw: unknown): Promise<Subject | null> {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 999999) return null;
  return db.rowParticipant.findFirst({ where: { challenge: CHALLENGE, rowerNumber: num }, select: { id: true, rowerNumber: true, displayName: true, instagram: true, userId: true } });
}

export type Person = {
  rowerNumber: number;
  numStr: string;
  name: string;
  instagram: string;
  isPrivate: boolean;
  /* The viewer to them, and them to the viewer. */
  following: FollowState;
  followsYou: FollowState;
  me: boolean;
  /* Their profile photo, or null for initials. */
  avatar: string | null;
  /* Every metre the rower has logged, where the list asks for it (search).
   * Null where it was not asked for, and for a rower lights out hides. */
  meters: number | null;
};

/* Rowers as lines for a list, in the order given, each with how the viewer
 * stands to them. Three reads however long the list is. */
export async function people(viewerId: string | null, rowers: { id: string; rowerNumber: number; displayName: string; instagram: string }[], meters?: Map<string, number | null>): Promise<Person[]> {
  const ids = rowers.map((r) => r.id);
  if (ids.length === 0) return [];
  const [faces, settings, out, back] = await Promise.all([
    avatarsFor(ids),
    db.rowSocialSetting.findMany({ where: { participantId: { in: ids }, isPrivate: true }, select: { participantId: true } }),
    viewerId ? db.rowFollow.findMany({ where: { followerId: viewerId, followeeId: { in: ids } }, select: { followeeId: true, status: true } }) : Promise.resolve([]),
    viewerId ? db.rowFollow.findMany({ where: { followeeId: viewerId, followerId: { in: ids } }, select: { followerId: true, status: true } }) : Promise.resolve([]),
  ]);
  const priv = new Set(settings.map((s) => s.participantId));
  const st = (s: string | undefined): FollowState => (s === "accepted" ? "accepted" : s === "pending" ? "pending" : "none");
  const outBy = new Map(out.map((f) => [f.followeeId, f.status]));
  const backBy = new Map(back.map((f) => [f.followerId, f.status]));
  return rowers.map((r) => ({
    rowerNumber: r.rowerNumber,
    numStr: fmtRowerNumber(r.rowerNumber),
    name: r.displayName,
    instagram: r.instagram,
    isPrivate: priv.has(r.id),
    following: st(outBy.get(r.id)),
    followsYou: st(backBy.get(r.id)),
    me: r.id === viewerId,
    avatar: faces.get(r.id) ?? null,
    meters: meters?.get(r.id) ?? null,
  }));
}
