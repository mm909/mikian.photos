import { db } from "@/lib/db";
import { fmtRowerNumber } from "@/lib/row100k";

/* ROW CLUB (owner, 2026-11-28: "I should have an option to make a row club
 * lobby and then be able to start row club ... whenever I click start row
 * club, it'll give a 10-second timer or something, and then the row
 * starts ... a bunch of other people have it open on their phone,
 * connected, and have started rowing"). The first cut. SERVER ONLY.
 *
 * NO NEW TABLE. One lobby at a time, kept as a RowSetting row under its own
 * challenge word (CLUB_SPACE), so the site's settings, which read every row
 * of the month's challenge, never see it. Each rower who joins is a row of
 * their own beside it (`m.<lobby>.<participant>`), so two joining at once
 * never write over each other. Where each one is on the water is their line
 * in RowLive, the table the live race already keeps (api/row100k/app/live).
 * Nothing is ever deleted: a new lobby is a new id, and the old rows stand.
 *
 * WHO: only an admin opens a lobby, starts it, or ends it. Any signed-in
 * rower reads it and joins it. With no lobby open nobody but an admin sees
 * any of it, so the whole of Row Club stays out of sight until he opens one.
 *
 * PRETEND ROWERS (admin, for seeing it work alone): a lobby can carry three
 * made-up rowers who row even splits from the start. They are worked out
 * from the clock at each read, kept nowhere, and named as pretend. */

export const CLUB_SPACE = "row-club";
const LOBBY_KEY = "lobby";
export const COUNTDOWN_S = 10;
/* A started row with nobody's word in this long is over. */
const STALE_S = 3 * 3600;

export type Lobby = {
  id: string;
  title: string;
  meters: number;
  openedAt: number;
  /* When the row starts, ms; null while the lobby waits. */
  startsAt: number | null;
  endedAt: number | null;
  pretend: boolean;
};

export type Member = { id: string; name: string; numStr: string; joinedAt: number };

export async function readLobby(): Promise<Lobby | null> {
  const row = await db.rowSetting.findUnique({ where: { challenge_key: { challenge: CLUB_SPACE, key: LOBBY_KEY } }, select: { value: true } });
  if (!row?.value) return null;
  try {
    const l = JSON.parse(row.value) as Lobby;
    if (!l || typeof l.id !== "string") return null;
    if (l.endedAt) return null;
    if (l.startsAt && Date.now() - l.startsAt > STALE_S * 1000) return null;
    return l;
  } catch {
    return null;
  }
}

export async function writeLobby(l: Lobby, by: string): Promise<void> {
  const value = JSON.stringify(l);
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CLUB_SPACE, key: LOBBY_KEY } },
    create: { challenge: CLUB_SPACE, key: LOBBY_KEY, value, updatedBy: by },
    update: { value, updatedBy: by },
  });
}

const memberKey = (lobby: string, pid: string) => `m.${lobby}.${pid}`;

export async function join(lobby: string, pid: string): Promise<void> {
  const key = memberKey(lobby, pid);
  await db.rowSetting.upsert({
    where: { challenge_key: { challenge: CLUB_SPACE, key } },
    create: { challenge: CLUB_SPACE, key, value: String(Date.now()), updatedBy: pid },
    update: {},
  });
}

export async function members(lobby: string): Promise<Member[]> {
  const rows = await db.rowSetting.findMany({ where: { challenge: CLUB_SPACE, key: { startsWith: `m.${lobby}.` } }, select: { key: true, value: true }, take: 200 });
  const at = new Map(rows.map((r) => [r.key.slice(`m.${lobby}.`.length), Number(r.value) || 0]));
  if (!at.size) return [];
  const ps = await db.rowParticipant.findMany({ where: { id: { in: [...at.keys()] } }, select: { id: true, displayName: true, rowerNumber: true } });
  return ps.map((p) => ({ id: p.id, name: p.displayName, numStr: fmtRowerNumber(p.rowerNumber), joinedAt: at.get(p.id) ?? 0 })).sort((a, b) => a.joinedAt - b.joinedAt);
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* A rower on the water as the app's live race takes one (mobile
 * erg/liveRace.ts): seconds rowed, meters, the second each 100 m line was
 * crossed, and how old that word is. */
export type Line = { id: string; name: string; numStr: string; t: number; m: number; spm: number; marks: number[]; ended: boolean; age: number; pretend?: boolean };

const PRETEND = [
  { id: "p1", name: "Pretend Rower A", pace: 112 },
  { id: "p2", name: "Pretend Rower B", pace: 118 },
  { id: "p3", name: "Pretend Rower C", pace: 125 },
];

/* The pretend rowers this second: an even split per 500 m from the start. */
export function pretendLines(l: Lobby, now = Date.now()): Line[] {
  if (!l.pretend || !l.startsAt || now < l.startsAt) return [];
  const t = (now - l.startsAt) / 1000;
  return PRETEND.map((p) => {
    const per = p.pace / 500;
    const full = l.meters * per;
    const ended = t >= full;
    const tt = ended ? full : t;
    const m = Math.min(l.meters, tt / per);
    const marks: number[] = [];
    for (let line = 100; line <= m; line += 100) marks.push(Math.round(line * per * 10) / 10);
    if (ended && l.meters % 100) marks.push(Math.round(full * 10) / 10);
    return { id: `pretend-${p.id}`, name: p.name, numStr: "", t: Math.round(tt * 10) / 10, m: Math.round(m * 10) / 10, spm: 24, marks, ended, age: 0, pretend: true };
  });
}

/* The lobby as the app is told it. */
export function lobbyOut(l: Lobby, list: Member[], meId: string | null) {
  const now = Date.now();
  return {
    id: l.id,
    title: l.title,
    meters: l.meters,
    startsAt: l.startsAt,
    /* Seconds to the start on the server's clock: the phone counts from its
     * own clock plus this, so no two phones' clocks are compared. */
    startsIn: l.startsAt ? (l.startsAt - now) / 1000 : null,
    pretend: l.pretend,
    live: !!l.startsAt && now >= l.startsAt,
    members: list.map((m) => ({ name: m.name, numStr: m.numStr, me: m.id === meId })),
    joined: !!meId && list.some((m) => m.id === meId),
  };
}
