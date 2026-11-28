import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api } from "./api";

/* ROW CLUB, ON THE PHONE (owner, 2026-11-28: "I should have an option to
 * make a row club lobby and then be able to start row club ... it'll give
 * a 10-second timer or something, and then the row starts"; "When row
 * club's live, we probably put like an indicator on that where the log a
 * row button is"). The site keeps the one lobby (api/row100k/app/club);
 * this file keeps what it last said, for the plus at the top of the app,
 * the lobby screen (screens/RowClub.tsx) and the race page, whose live
 * lanes take the club's rowers while the club row is on (erg/liveRace.ts).
 *
 * THE START IS ON THIS PHONE'S CLOCK. The site says how many seconds there
 * are to the start; the phone adds that to its own clock once, and counts
 * down from there. No two phones' clocks are compared. */

export type ClubMember = { name: string; numStr: string; me: boolean };
export type ClubLobby = { id: string; title: string; meters: number; startsAt: number | null; startsIn: number | null; pretend: boolean; live: boolean; members: ClubMember[]; joined: boolean };
type Said = { lobby: ClubLobby | null; canHost: boolean; countdown?: number };

export type Club = { lobby: ClubLobby | null; canHost: boolean; countdown: number; /* The start on this phone's clock, ms; null until started. */ startAt: number | null; read: boolean; error: string };

let club: Club = { lobby: null, canHost: false, countdown: 10, startAt: null, read: false, error: "" };
const subs = new Set<() => void>();
function put(next: Club): void {
  club = next;
  subs.forEach((f) => f());
}
const listen = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
const get = () => club;
export const useClub = (): Club => useSyncExternalStore(listen, get, get);
export const clubNow = (): Club => club;

function take(r: Said): void {
  const l = r.lobby;
  let startAt: number | null = null;
  if (l && l.startsIn !== null) {
    const fresh = Date.now() + l.startsIn * 1000;
    const kept = club.lobby?.id === l.id ? club.startAt : null;
    startAt = kept !== null && Math.abs(kept - fresh) < 1500 ? kept : fresh;
  }
  put({ lobby: l, canHost: r.canHost, countdown: r.countdown ?? 10, startAt, read: true, error: "" });
}

export async function readClub(): Promise<void> {
  try {
    take(await api<Said>("/api/row100k/app/club"));
  } catch {
    /* Signed out, or no signal: what was last said stands. */
  }
}

export async function clubDo(action: "open" | "start" | "end" | "join" | "pretend", extra: Record<string, unknown> = {}): Promise<boolean> {
  try {
    take(await api<Said>("/api/row100k/app/club", { body: { action, ...extra } }));
    return true;
  } catch (err) {
    put({ ...club, error: err instanceof Error ? err.message : "Could not reach Row Club." });
    return false;
  }
}

/* The club row is on (or counting down) and this phone is in it. */
export const clubRowing = (c: Club): boolean => !!c.lobby?.joined && c.startAt !== null;

/* Held at the app's root: the lobby read now and then, faster while one is
 * open, so the plus lights as the host starts it. `fast` while the lobby
 * screen is in front. */
export function useClubFeed(signedIn: boolean, fast: boolean): void {
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (!alive) return;
      if (AppState.currentState === "active") await readClub();
      if (!alive) return;
      const c = club;
      const waiting = !!c.lobby && (c.startAt === null || c.startAt > Date.now() - 5000);
      timer = setTimeout(tick, fast ? 2000 : waiting ? 5000 : c.lobby ? 15000 : 30000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [signedIn, fast]);
}
