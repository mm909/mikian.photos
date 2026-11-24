import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, api } from "./api";
import { dropPending, loadPending, loadPendingDoc, markPending, pendingSettled, type Pending } from "./store";

/* A ROW OFF THE MONITOR LOGS ITSELF (owner, 2026-11-23: "Strava does this
 * thing where it's like it automatically logs the row and then lets you add
 * the photos ... the intention is that every row gets logged"; 2026-11-24,
 * asked whether to build it: "Yes, build every single thing you need").
 *
 * Until that day a row did not exist until the rower had found two photos
 * and pressed LOG, and a row whose rower walked off, or whose phone was out
 * of signal in a gym, sat on the phone under "Rowed, not logged yet" for as
 * long as it took them to notice. Now the row is sent the moment the piece
 * is over, with no photos, and is on the board and the feed at once. The
 * photos, the title and the words go on afterwards: from the page that
 * comes up after the row, or any time later from the row's own page.
 *
 * WHAT IS SENT is the recording and nothing else (api/row100k/app/erg,
 * { doc, log }): the site reads the meters, the time and the day off it.
 *
 * WHICH ROWS. A piece of 500 m or more, or a set piece rowed to its end
 * however short (a 250 m sprint). A few warm-up pulls wait on the phone as
 * they always did, with LOG beside them. MINE, the 500: he was asked what
 * the shortest row worth logging by itself is and said to build it; this is
 * where a warm-up stops and a row starts on most plans.
 *
 * WHEN. A set piece: about a second and a half after the monitor says it is
 * finished (useErg.ts). A piece that was stopped short or just rowed: when
 * the monitor moves on to its next piece, or ten minutes after the phone
 * last heard from it, or the next time the app is opened; and at once if
 * the rower presses LOG.
 *
 * NO SIGNAL: the piece stays on the phone (store.ts Pending, where it has
 * been written every fifteen seconds since 2026-11-22) and is sent again by
 * itself, a little less often each time, until it lands.
 *
 * NEVER TWICE. The site knows a recording it has already made a row of (by
 * the instant it starts) and answers with that row. And a piece whose
 * connection dropped and came back is two recordings on the phone, a short
 * one and a whole one that start together: the whole one is the row, and
 * the short one is marked and left for the rower to delete.
 *
 * NEVER WHAT WAS THERE BEFORE. Pieces already waiting on a phone when this
 * arrived are not sent by themselves: a rower who left six of them there
 * did not ask for six rows on the feed one morning. They keep their LOG.
 *
 * NEVER A DEMO: the simulator's rows are not kept at all (useErg.ts), and
 * the site refuses a recording that says it is one. */

/* Under this, a piece that was not a finished set piece waits for LOG. */
export const AUTO_MIN_M = 500;
/* How long after the phone last wrote a piece it counts as over. */
const STALE_MS = 10 * 60_000;
/* Two recordings that start this close together are one piece on the
 * monitor: each start is worked out as now less the monitor's own clock. */
const SAME_PIECE_MS = 15_000;

export type Saved = { rowId: string; day: string; meters: number; seconds: number; title: string; recorded: boolean };
export type AutoState = { state: "saving" } | ({ state: "saved" } & Saved) | { state: "waiting"; error: string } | { state: "refused"; error: string };

/* Where each piece has got to, for as long as the app is open. */
const states = new Map<string, AutoState>();
const subs = new Set<(id: string, s: AutoState) => void>();
export const autoOf = (id: string): AutoState | null => states.get(id) ?? null;
export function onAuto(f: (id: string, s: AutoState) => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
const set = (id: string, s: AutoState): AutoState => {
  states.set(id, s);
  subs.forEach((f) => f(id, s));
  return s;
};

/* THE MOMENT THIS ARRIVED on the phone: pieces that began before it are the
 * rower's to log. Written the first time it is asked for. */
const SINCE = "autolog/since";
let sinceAt: number | null = null;
async function since(): Promise<number> {
  if (sinceAt !== null) return sinceAt;
  try {
    const raw = await AsyncStorage.getItem(SINCE);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return (sinceAt = n);
    const now = Date.now();
    await AsyncStorage.setItem(SINCE, String(now));
    return (sinceAt = now);
  } catch {
    /* A phone that cannot say: nothing before this run of the app. */
    return (sinceAt = Date.now());
  }
}
/* Asked as the app opens, so the mark is down before any row is rowed. */
export const armAuto = (): void => void since();

/* WHAT HAS BEEN LOGGED from this phone lately, by when it started and how
 * far it went: what a short half of the same piece is known by. */
const DONE = "autolog/done";
type Done = { at: number; meters: number };
async function loadDone(): Promise<Done[]> {
  try {
    const raw = await AsyncStorage.getItem(DONE);
    const list = raw ? (JSON.parse(raw) as Done[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
async function remember(p: Pending): Promise<void> {
  try {
    const list = await loadDone();
    await AsyncStorage.setItem(DONE, JSON.stringify([...list, { at: p.at, meters: p.meters }].slice(-30)));
  } catch {
    /* Best effort: the site refuses the same recording twice anyway. */
  }
}

/* May this piece be sent without being asked. */
export function logsItself(p: Pick<Pending, "meters" | "full">): boolean {
  return !!p.full || p.meters >= AUTO_MIN_M;
}

/* How long before a piece that did not land is tried again: half a minute,
 * then twice as long each time, never more than a quarter of an hour. */
const tries = new Map<string, { n: number; next: number }>();

const flying = new Map<string, Promise<AutoState>>();

/* SEND ONE PIECE, by its id among the pieces kept on the phone. Answers
 * where it got to; never throws. Asked twice at once, it is sent once. */
export function sendPiece(id: string): Promise<AutoState> {
  const going = flying.get(id);
  if (going) return going;
  const job = (async (): Promise<AutoState> => {
    set(id, { state: "saving" });
    await pendingSettled();
    const p = (await loadPending()).find((x) => x.id === id);
    const doc = p?.hasDoc ? await loadPendingDoc(id) : null;
    if (!p || !doc) return set(id, { state: "refused", error: "This phone has no recording of that row. Log it by hand." });
    try {
      const r = await api<{ entryId: string; day: string; meters: number; seconds: number; title: string; recorded: boolean }>("/api/row100k/app/erg", { body: { doc, log: {} } });
      await remember(p);
      await dropPending(id);
      tries.delete(id);
      return set(id, { state: "saved", rowId: r.entryId, day: r.day, meters: r.meters, seconds: r.seconds, title: r.title, recorded: r.recorded });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const error = err instanceof Error ? err.message : "That did not work.";
      /* Logged once and deleted since: it stays deleted, and the copy on
       * the phone goes with it. */
      if (status === 410) {
        await dropPending(id).catch(() => null);
        return set(id, { state: "refused", error });
      }
      /* No signal, signed out, too many at once, or the site is away: it
       * is kept and tried again. And 404: a site from before this was
       * built does not know a row sent this way (it looks for a row to
       * tie the recording to and finds none), which is a site that has
       * not caught up yet, not a row that was refused. */
      if (status === 0 || status === 401 || status === 404 || status === 429 || status >= 500) {
        const n = (tries.get(id)?.n ?? 0) + 1;
        tries.set(id, { n, next: Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** (n - 1)) });
        return set(id, { state: "waiting", error });
      }
      /* The site would not take it (the day's cap, a day outside the
       * month): kept, with the site's words against it, and not sent again
       * unless the rower asks. */
      await markPending(id, { refused: error }).catch(() => null);
      return set(id, { state: "refused", error });
    }
  })();
  flying.set(id, job);
  void job.finally(() => flying.delete(id));
  return job;
}

/* GO THROUGH WHAT IS KEPT and send what is over. `current` is the piece the
 * monitor is still on, which is not over. Asked for as the app opens, as it
 * comes back to the front, as the monitor moves on to another piece, and
 * every so often while it is open. */
let sweeping = false;
export async function sweep(current?: string | null): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    await pendingSettled();
    const [list, from, done] = await Promise.all([loadPending(), since(), loadDone()]);
    const now = Date.now();
    for (const p of list) {
      if (p.id === current || flying.has(p.id)) continue;
      if (p.at < from || !p.hasDoc || p.refused || p.dup || !logsItself(p)) continue;
      /* The short half of a piece whose connection dropped and came back. */
      if (!p.ended && !p.over) {
        const whole = [...list.filter((q) => q.id !== p.id), ...done].some((q) => Math.abs(q.at - p.at) < SAME_PIECE_MS && q.meters >= p.meters);
        if (whole) {
          await markPending(p.id, { dup: true }).catch(() => null);
          continue;
        }
        if (now - p.savedAt < STALE_MS) continue;
      }
      const t = tries.get(p.id);
      if (t && now < t.next) continue;
      await sendPiece(p.id);
    }
  } catch {
    /* The next pass tries again. */
  } finally {
    sweeping = false;
  }
}
