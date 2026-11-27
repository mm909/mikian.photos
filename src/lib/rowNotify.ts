import { db, rawDb } from "@/lib/db";
import { devIds } from "@/lib/devHide";
import { activeBlackout } from "@/lib/blackout";
import { CHALLENGE, MONTH, fmtMeters, nowMs, pacificDay, splitSeconds } from "@/lib/row100k";
import { monthOptIns } from "@/app/row100k/monthOptIn";
import { blockedIds, notifyOff } from "@/lib/rowSocial";
import { OWNER_ALWAYS_EMAILS, isOwnerEmail, ownerEmail } from "@/lib/permissions";

/* NOTIFICATIONS (2026-11-21). The owner's rules, 2026-11-20:
 *
 *   "notifications only for people you follow"
 *   one when I get passed on the board, and only when the person passing is
 *   someone I follow; at most once a day, OR whenever someone I follow rows.
 *
 * First built as two kinds. Then (owner, 2026-11-21, of the switch for a
 * line every time a followed rower rows: "let's just remove that top one.
 * You can't get notified when someone logs a row. That's fine") cut to
 * one: PASSED, ONE line a day that collects everybody I follow who passed
 * me that day, from the rowers whose bell is on. Plus the three a follow
 * makes: FOLLOW, REQUEST, ACCEPTED.
 *
 * Every line is a RowNotification row, which is what the app's notification
 * centre lists. A phone that has registered a push token (RowPushToken) is
 * also sent the line through Expo's push service, which costs nothing.
 *
 * Nothing here may fail the thing that caused it: every caller wraps it,
 * and it wraps itself. SERVER ONLY. */

export type NoteKind = "follow" | "request" | "accepted" | "rowed" | "passed" | "liked" | "commented" | "replied" | "mentioned" | "likedComment";
/* The kinds a rower can switch off. A request and its answer always land:
 * they are things the rower has to act on or asked for. */
export const SWITCHABLE: readonly NoteKind[] = ["passed", "follow", "liked", "commented"];
/* The kinds that are off until a rower turns them on (RowSocialSetting.
 * notifyOn; owner, 2026-11-21): a line whenever a rower I follow logs a
 * row, and one whenever anybody does. Beside them, the bell on one rower
 * (RowFollow.notify) asks for that rower's rows whatever these say. */
export const OPT_IN = ["rowed", "rowedAll"] as const;

/* ---- push ------------------------------------------------------------ */

type Push = { participantId: string; title: string; body: string; data: Record<string, string> };

/* Out through Expo's push service to every phone the recipients have
 * registered. Never from a dev server: a sandbox must not buzz a real
 * phone. A failed send is logged and dropped; the line is in the centre. */
async function push(notes: Push[]): Promise<void> {
  if (notes.length === 0 || process.env.NODE_ENV !== "production") return;
  try {
    const people = await db.rowParticipant.findMany({ where: { id: { in: notes.map((n) => n.participantId) } }, select: { id: true, userId: true } });
    const userOf = new Map(people.map((p) => [p.id, p.userId]));
    const tokens = await db.rowPushToken.findMany({ where: { userId: { in: people.map((p) => p.userId) } }, select: { userId: true, token: true } });
    if (tokens.length === 0) return;
    const messages = notes.flatMap((n) =>
      tokens.filter((t) => t.userId === userOf.get(n.participantId)).map((t) => ({ to: t.token, title: n.title, body: n.body, data: n.data, sound: "default" })),
    );
    for (let i = 0; i < messages.length; i += 100) {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      if (!res.ok) console.error(`row notify: push service answered ${res.status}`);
    }
  } catch (err) {
    console.error("row notify: push failed", err);
  }
}

/* ---- the owner ------------------------------------------------------- */

/* A LINE FOR THE OWNER ALONE (owner, 2026-11-25, of the M2D sign-up email:
 * "Give me a push notification for this"): to every phone registered by
 * an account that is his (lib/permissions isOwnerEmail), nobody else's. No
 * line in the notification centre: it is an alert, the email is the record.
 * Never throws; a failed send is logged. Production only, like push(). */
/* PUSH, NOT EMAIL (owner, 2026-11-26: "anything that I get a
 * notification for, like a push notification for, I no longer need an
 * email for"): true when the push went out to his phone, so the caller
 * sends no email; false when it could not (no phone, the service down),
 * and the caller emails instead, so nothing is lost. */
export async function notifyOwner(body: string, data: Record<string, string>): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;
  try {
    const accounts = await db.photographer.findMany({
      where: { email: { in: [...new Set([ownerEmail(), ...OWNER_ALWAYS_EMAILS])] } },
      select: { id: true, email: true },
    });
    const mine = accounts.filter((a) => a.email && isOwnerEmail(a.email)).map((a) => a.id);
    if (mine.length === 0) return false;
    const tokens = await db.rowPushToken.findMany({ where: { userId: { in: mine } }, select: { token: true } });
    if (tokens.length === 0) {
      console.error("row notify: the owner has no phone registered for push");
      return false;
    }
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, title: "ROW", body, data, sound: "default" }))),
    });
    if (!res.ok) {
      console.error(`row notify: owner push answered ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("row notify: owner push failed", err);
    return false;
  }
}

/* ---- a follow, a request, an answer ---------------------------------- */

/* One line about one rower doing something to another. A second follow by
 * the same rower replaces the first line instead of stacking beside it. */
/* THE DEVELOPER (rower 000, lib/devAccount.ts) tells nobody anything: what
 * it does is seen by it alone, so no line and no push leaves it. */
async function fromDeveloper(participantId: string): Promise<boolean> {
  return (await devIds(rawDb).catch(() => null))?.pid === participantId;
}

export async function notifyPerson(kind: "follow" | "request" | "accepted", recipientId: string, actor: { id: string; displayName: string }): Promise<void> {
  try {
    if (await fromDeveloper(actor.id)) return;
    if (kind === "follow") {
      const off = await notifyOff([recipientId]);
      if (off.get(recipientId)?.has("follow")) return;
    }
    await db.rowNotification.deleteMany({ where: { participantId: recipientId, actorId: actor.id, kind: { in: ["follow", "request"] } } });
    await db.rowNotification.create({ data: { challenge: CHALLENGE, participantId: recipientId, kind, actorId: actor.id } });
    const body = kind === "follow" ? `${actor.displayName} started following you.` : kind === "request" ? `${actor.displayName} asked to follow you.` : `${actor.displayName} accepted your follow request.`;
    await push([{ participantId: recipientId, title: "ROW", body, data: { kind, actor: actor.id } }]);
  } catch (err) {
    console.error(`row notify: failed to write a ${kind} line`, err);
  }
}

/* SOMEBODY LIKED A ROW, COMMENTED ON IT, OR REPLIED TO A COMMENT (owner,
 * 2026-11-22: likes and comments "also allows us to give some more
 * notifications"). One line to the rower it is about; never for their own
 * doing; not across a block. A second like of the same row by the same
 * rower replaces the first line. "replied" and "mentioned" (tagged in a
 * comment) are switched off with "commented"; "likedComment" with
 * "liked". */
export async function notifyTouch(kind: "liked" | "commented" | "replied" | "mentioned" | "likedComment", recipientId: string, actor: { id: string; displayName: string }, entryId: string): Promise<void> {
  try {
    if (recipientId === actor.id) return;
    if (await fromDeveloper(actor.id)) return;
    const off = await notifyOff([recipientId]);
    if (off.get(recipientId)?.has(kind === "replied" || kind === "mentioned" ? "commented" : kind === "likedComment" ? "liked" : kind)) return;
    if ((await blockedIds(recipientId)).includes(actor.id)) return;
    if (kind === "liked" || kind === "likedComment") await db.rowNotification.deleteMany({ where: { participantId: recipientId, actorId: actor.id, kind, entryId } });
    await db.rowNotification.create({ data: { challenge: CHALLENGE, participantId: recipientId, kind, actorId: actor.id, entryId } });
    const body = kind === "liked" ? `${actor.displayName} liked your row.` : kind === "commented" ? `${actor.displayName} commented on your row.` : kind === "replied" ? `${actor.displayName} replied to your comment.` : kind === "mentioned" ? `${actor.displayName} mentioned you in a comment.` : `${actor.displayName} liked your comment.`;
    await push([{ participantId: recipientId, title: "ROW", body, data: { kind, row: entryId } }]);
  } catch (err) {
    console.error(`row notify: failed to write a ${kind} line`, err);
  }
}

/* A request that was withdrawn, declined or answered: its line goes. */
export async function clearRequest(recipientId: string, actorId: string): Promise<void> {
  await db.rowNotification.deleteMany({ where: { participantId: recipientId, actorId, kind: "request" } }).catch(() => null);
}

/* ---- a row was logged ------------------------------------------------ */

/* Tell the followers this row carried the rower past, on this month's
 * board, that they were passed (one line a day each; only followers whose
 * bell for this rower is on).
 *
 * No metres in the PASSED line: the line leads to the board. PASSED is not
 * sent at all while a lights-out window is open, since who passed whom is
 * exactly what the window hides. */
export async function notifyRowLogged(rower: { id: string; displayName: string }, entry: { id: string; day: string; meters: number; seconds?: number }): Promise<void> {
  if (await fromDeveloper(rower.id)) return;
  await notifyRowed(rower, entry);
  try {
    const follows = await db.rowFollow.findMany({ where: { challenge: CHALLENGE, followeeId: rower.id, status: "accepted", notify: true }, select: { followerId: true } });
    if (follows.length === 0) return;
    const blocked = new Set(await blockedIds(rower.id));
    const followers = follows.map((f) => f.followerId).filter((id) => !blocked.has(id));
    if (followers.length === 0) return;
    const off = await notifyOff(followers);
    const wants = (id: string, kind: NoteKind) => !off.get(id)?.has(kind);

    const pushes: Push[] = [];

    /* PASSED: this month's board only, both rowers on it, and no window open. */
    const inThisMonth = entry.day >= MONTH.firstDay && entry.day <= MONTH.lastDay;
    if (inThisMonth && !(await activeBlackout()).active) {
      const [ins, sums] = await Promise.all([
        monthOptIns(),
        db.rowEntry.groupBy({ by: ["participantId"], where: { challenge: CHALLENGE, participantId: { in: [rower.id, ...followers] }, day: { gte: MONTH.firstDay, lte: MONTH.lastDay } }, _sum: { meters: true } }),
      ]);
      const total = new Map(sums.map((s) => [s.participantId, s._sum.meters ?? 0]));
      const after = total.get(rower.id) ?? 0;
      const before = after - entry.meters;
      const passed = ins.has(rower.id)
        ? followers.filter((id) => {
            const t = total.get(id) ?? 0;
            return ins.has(id) && wants(id, "passed") && t > 0 && t >= before && t < after;
          })
        : [];
      const day = pacificDay(nowMs());
      for (const participantId of passed) {
        const have = await db.rowNotification.findFirst({ where: { participantId, kind: "passed", day }, select: { id: true, actors: true } });
        if (!have) {
          await db.rowNotification.create({ data: { challenge: CHALLENGE, participantId, kind: "passed", day, actorId: rower.id, actors: [rower.id] } });
          /* The once-a-day push goes with the first pass of the day. */
          pushes.push({ participantId, title: "ROW", body: `${rower.displayName} passed you on the board.`, data: { kind: "passed" } });
        } else if (!have.actors.includes(rower.id)) {
          await db.rowNotification.update({ where: { id: have.id }, data: { actors: [...have.actors, rower.id], actorId: rower.id, readAt: null, createdAt: new Date() } });
        }
      }
    }
    await push(pushes);
  } catch (err) {
    console.error("row notify: failed to tell the followers about a row", err);
  }
}

/* A ROW WAS LOGGED, and who asked to be told (owner, 2026-11-21: "include
 * ... rowers that I follow do a row as one of the notifications. Let's
 * leave that as off for now"; "there's anytime someone submits a row.
 * There's just from rowers that I follow, and then there's just from
 * rowers that I have notifications turned on for"). Three ways in, all off
 * until asked for:
 *
 *   the bell on this rower (RowFollow.notify), from a follower;
 *   "rowed" in a follower's notifyOn: every rower they follow;
 *   "rowedAll" in anybody's notifyOn: every rower there is.
 *
 * One line each, leading to the row. Never across a block, never to
 * somebody who muted the rower, and a private rower's row is told only to
 * the followers they accepted.
 *
 * THE LINE SAYS HOW FAR AND HOW FAST (owner, 2026-11-22: "on the push
 * notifications for ... logged a row, we should include the distance that
 * they rowed and the pace ... just this rower rowed this many meters at
 * this pace ... That's probably the cleanest version"): "Ada Lovelace rowed
 * 5,000 m at 1:57.0." It used to carry no metres, so that a rower hidden
 * by lights out stayed hidden. That still holds: while a lights-out window
 * is open, or its run-up is covering digits, the line is the old one,
 * "logged a row.", for everybody (rowedWords, numbersHidden).
 *
 * THE PACE DROPS ITS TENTHS, NOT ROUNDED (owner, 2026-11-23: "we want to
 * drop the decimal place for the pace. We don't want to round it ... if it
 * was 221.7, it just becomes 221"): 2:21.7 reads 2:21. Only this line; the
 * row's own page keeps the tenths. */
export function rowedWords(meters: number, seconds: number): string {
  if (!(meters > 0)) return "logged a row.";
  return seconds > 0 ? `rowed ${fmtMeters(meters)} at ${paceNoTenths(meters, seconds)}.` : `rowed ${fmtMeters(meters)}.`;
}
function paceNoTenths(meters: number, seconds: number): string {
  /* The tiny nudge keeps a split of exactly 2:21 from reading 2:20 when
   * the division lands a hair under. */
  const s = Math.floor(splitSeconds(meters, seconds) + 1e-6);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* Whether a line about a row may say its numbers right now. */
export async function numbersHidden(): Promise<boolean> {
  const b = await activeBlackout();
  return b.active || (b.hideLow ?? 0) > 0;
}

async function notifyRowed(rower: { id: string; displayName: string }, entry: { id: string; meters: number; seconds?: number }): Promise<void> {
  const entryId = entry.id;
  try {
    const [follows, opted, priv, blocked, muters] = await Promise.all([
      db.rowFollow.findMany({ where: { challenge: CHALLENGE, followeeId: rower.id, status: "accepted" }, select: { followerId: true, notify: true } }),
      db.rowSocialSetting.findMany({ where: { challenge: CHALLENGE, notifyOn: { hasSome: [...OPT_IN] } }, select: { participantId: true, notifyOn: true, quiet: true } }),
      db.rowSocialSetting.findUnique({ where: { participantId: rower.id }, select: { isPrivate: true } }),
      blockedIds(rower.id),
      db.rowMute.findMany({ where: { mutedId: rower.id }, select: { muterId: true } }),
    ]);
    /* A blanket setting leaves out the rowers its owner turned the bell off
     * for (RowSocialSetting.quiet); a bell turned on still tells. */
    const on = new Map(opted.filter((s) => !s.quiet.includes(rower.id)).map((s) => [s.participantId, s.notifyOn]));
    const follower = new Set(follows.map((f) => f.followerId));
    const to = new Set<string>();
    for (const f of follows) if (f.notify || on.get(f.followerId)?.includes("rowed")) to.add(f.followerId);
    for (const s of opted) if (s.notifyOn.includes("rowedAll") && !s.quiet.includes(rower.id) && (!priv?.isPrivate || follower.has(s.participantId))) to.add(s.participantId);
    to.delete(rower.id);
    for (const id of blocked) to.delete(id);
    for (const m of muters) to.delete(m.muterId);
    if (to.size === 0) return;
    const ids = [...to];
    await db.rowNotification.createMany({ data: ids.map((participantId) => ({ challenge: CHALLENGE, participantId, kind: "rowed", actorId: rower.id, entryId })) });
    const words = (await numbersHidden()) ? "logged a row." : rowedWords(entry.meters, entry.seconds ?? 0);
    await push(ids.map((participantId) => ({ participantId, title: "ROW", body: `${rower.displayName} ${words}`, data: { kind: "rowed", row: entryId } })));
  } catch (err) {
    console.error("row notify: failed to tell who asked about a row", err);
  }
}
