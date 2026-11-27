import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/* THE SITE, FROM THE APP. Every screen reads the same routes the website
 * reads (api/row100k/app/* and the routes the site's own pages post to),
 * so a figure is computed once, on the server, for both.
 *
 * WHERE: EXPO_PUBLIC_API names the server when it is set (a laptop: the
 * site's dev server on another port; later, the demo copy). Otherwise the
 * web build talks to the host it is served from (rowtember.com/row100k/app),
 * and the phone talks to rowtember.com.
 *
 * WHO: a bearer token from /api/row100k/app/session (kept on the device),
 * or, for the web build on the site itself, the site's own session cookie. */

/* A laptop's dev server opened from a PHONE on the same Wi-Fi: the page came
 * from the laptop's network address, and "localhost" there would be the
 * phone. So a localhost server address follows the host the page came from. */
function onThisHost(url: string): string {
  if (Platform.OS !== "web" || typeof location === "undefined") return url;
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return url;
  return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${location.hostname}`);
}
const ENV_API = onThisHost((process.env.EXPO_PUBLIC_API ?? "").replace(/\/+$/, ""));
export const API = ENV_API || (Platform.OS === "web" ? "" : "https://www.rowtember.com");
/* The web build served by the site shares the site's session cookie. */
export const SAME_ORIGIN = Platform.OS === "web" && !ENV_API;
/* Where a link to a page of the site goes. */
export const SITE = API || "https://www.rowtember.com";

const TOKEN = "session/1";
let token: string | null = null;
let loaded = false;

export async function loadToken(): Promise<string | null> {
  if (!loaded) {
    token = await AsyncStorage.getItem(TOKEN).catch(() => null);
    loaded = true;
  }
  return token;
}

export async function setToken(t: string | null): Promise<void> {
  /* Another account, or none: nothing the last one read is theirs. */
  seen.clear();
  token = t;
  loaded = true;
  if (t) await AsyncStorage.setItem(TOKEN, t).catch(() => null);
  else await AsyncStorage.removeItem(TOKEN).catch(() => null);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/* WHAT HAS BEEN READ ONCE IS KEPT (owner, 2026-11-21: "why is there a
 * loading screen, especially after we've seen it once? ... we've already
 * loaded this data"). The last good answer to every GET, by its path, for
 * as long as the app is open. A screen draws what is here at once and reads
 * again behind it (ui.tsx useLoad), so a spinner is seen the first time a
 * thing is ever opened and never again. Emptied when the account changes. */
const seen = new Map<string, unknown>();
export const peek = <T,>(path: string | null | undefined): T | null => (path ? ((seen.get(path) as T | undefined) ?? null) : null);
export const forget = (): void => seen.clear();
/* Counts what the rower has changed about themselves (the photo, the bio),
 * so their own profile, mounted under the settings, reads again. */
export const edits = { n: 0 };
/* Read these now, quietly, so they are there when their screen is opened. */
export function warm(paths: string[]): void {
  for (const p of paths) api(p).catch(() => null);
}

/* One request. Answers the parsed body of an { ok: true, ... } reply and
 * throws ApiError with the server's own sentence otherwise. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = await loadToken();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { ...(init.body === undefined ? {} : { "content-type": "application/json" }), ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: SAME_ORIGIN ? "include" : "omit",
    });
  } catch {
    throw new ApiError("No connection. Check the signal and try again.", 0);
  }
  let json: { ok?: boolean; error?: string } | null = null;
  try {
    json = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    json = null;
  }
  if (!res.ok || !json || json.ok === false) throw new ApiError(json?.error || `That did not work (${res.status}).`, res.status);
  if (init.body === undefined && (init.method ?? "GET") === "GET") seen.set(path, json);
  return json as T;
}

/* ---- what the routes answer ------------------------------------------- */

export type Me = {
  signedIn: boolean;
  isAdmin?: boolean;
  /* The Developer account, rower 000. */
  isDev?: boolean;
  name?: string;
  me?: { participantId: string; rowerNumber: number; displayName: string; instagram: string; division: string } | null;
  totals?: { meters: number; seconds: number; sessions: number; monthMeters: number; /* Rows this month; an older site does not say. */ monthSessions?: number };
  optedIn?: boolean;
  /* The bell: lines not read, follow requests not answered. */
  social?: { unread: number; requests: number; isPrivate: boolean };
  /* The viewer's profile photo, or null for initials. */
  avatar?: string | null;
  month?: { key: string; label: string; goal: number };
};

/* ---- following, privacy, the notification centre ----------------------- */

export type FollowState = "none" | "pending" | "accepted";
/* How the viewer and one rower stand (lib/rowSocial.ts on the server). */
export type Rel = { following: FollowState; bell: boolean; /* The bell is on by "every row" (2026-11-23). */ bellAll?: boolean; followsYou: FollowState; isPrivate: boolean; muted?: boolean; locked?: boolean; blockedByMe?: boolean; blockedMe?: boolean; access?: "open" | "private" | "blocked" };
export type Counts = { followers: number; following: number };
export type Person = { rowerNumber: number; numStr: string; name: string; instagram: string; isPrivate: boolean; following: FollowState; followsYou: FollowState; me: boolean; meters: number | null; avatar?: string | null };
export type Notice = { avatar?: string | null; id: string; kind: "follow" | "request" | "accepted" | "rowed" | "passed" | "liked" | "commented" | "replied" | "mentioned" | "likedComment"; rowerNumber: number; numStr: string; name: string; text: string; entryId: string | null; open: boolean; unread: boolean; absIso: string; dayKey: string; dayStr: string; clockStr: string };
export type SocialSettings = { isPrivate: boolean; notifyOff: string[]; kinds: string[]; notifyOn?: string[]; optIn?: string[]; avatar?: string | null; bio?: string; heightCm?: number | null; weightKg?: number | null; birthday?: string | null };
/* The two questions behind the stats (api/row100k/app/stories). */
export type Stories = {
  weekly?: { weeks: { start: string; rowers: number; live: boolean }[]; avg4: number; prev4: number | null; goal: number };
  rowers: { today: number; todayDay: string; weeks: number[]; days: { day: string; rowers: number }[]; months: { key: string; label: string; year: string; rowers: number; rows: number; meters: number }[]; everyone: number };
  when: { hours: number[]; weekdays: number[]; rows: number };
  /* Three more (2026-11-21): who makes the 100K, how far a row is, how
   * long a 5K takes. Absent from a server that has not been updated. */
  club?: { months: { key: string; label: string; year: string; rowers: number; made: number; rowsToMake: number; live: boolean }[]; everMade: number; goal: number };
  length?: { bins: number[]; median: number; rows: number; fives: number; tens: number; longest: number };
  fivek?: { bins: number[]; from: number; step: number; median: number; rows: number; rowers: number; under20: number };
};
/* What the profile route answers in place of a profile across a block. */
export type Blocked = { rowerNumber: number; displayName: string; byMe: boolean };

export type Photo = { full: string; thumb: string | null };

export type FeedItem = {
  id: string;
  absIso: string;
  dayKey: string;
  dayStr: string;
  clockStr: string;
  /* A row off a monitor that was rowed on another day than it was sent:
   * the day and the clock it was ROWED, which is what a card says. */
  rowed?: { dayKey: string; dayStr: string; clockStr: string };
  rowerNumber: number;
  numStr: string;
  name: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  title: string;
  photos: Photo[];
  masked?: boolean;
  digits?: number;
  elite?: boolean;
  erg: { id: string; watts: number | null; spm: number | null; hr: number | null; drag: number | null } | null;
  mine: boolean;
  /* How the viewer stands to the row's rower, for the menu on the row. */
  rel: { following: FollowState; bell: boolean };
  avatar?: string | null;
  /* Under the row: how many likes, whether one is the viewer's, how many comments. */
  likes?: number;
  liked?: boolean;
  comments?: number;
  /* What the rower wrote under the photos. */
  caption?: string;
  /* The rower wears the black check (lib/rowPlus.ts). */
  plus?: boolean;
};
export type FeedPage = { items: FeedItem[]; older: string | null; lead?: number };

export type BoardRow = { rowerNumber: number; name: string; meters: number; blocks?: number; shape?: string; unranked: boolean; me: boolean };
export type BoardData = {
  signedIn: boolean;
  month: { key: string; label: string; name: string; word: string; days: number; day: number };
  rows: BoardRow[];
  tiers: { key: string; title: string; floor: number }[];
  me: { rowerNumber: number; name: string; meters: number; in: boolean; unranked: boolean; blocks?: number; shape?: string } | null;
  unreadable: boolean;
  /* The seven days before today and today ("YYYY-MM-DD"), and each listed
   * rower's meters on them, by rower number. */
  week?: { days: string[]; meters: Record<number, number[]> } | null;
};

export type Kde = { xs: number[]; ys: number[]; xMin: number; xMax: number; ticks: number[]; mean: number; sd: number; median: number; rug: number[]; take: string };
export type KdeYou = { rug: number[]; median: number; best: number; tag: string; bestTag: string; ys?: number[] };
export type FieldModel = { sessions: number; rowers: number; lengthKde: Kde; paceKde: Kde };
export type DistanceKde = { meters: number; label: string; field: Kde; you: KdeYou | null; fieldN: number; fieldRowers: number; youN: number; take: string };

export type Best = { key: string; label: string; value: string; sub: string; place: number | null; shape?: string; digits?: number };
export type LogRow = { id: string; day: string; dayStr: string; title: string; meters?: number; seconds?: number; metersStr: string; durationStr: string; splitStr: string; photos: Photo[]; masked: boolean; digits?: number; timeShape?: string };
export type ErgRow = { id: string; when: string; device: string; simulated: boolean; meters: string; time: string; split: string; title: string; entryId?: string | null };

export type Profile = {
  rower: { rowerNumber: number; displayName: string; instagram: string; division: string };
  /* `locked`: a private account the viewer has not been accepted by; the
   * rows, bests, calendar and charts below arrive empty. */
  rel: Rel;
  counts: Counts;
  avatar?: string | null;
  /* What the rower wrote about themselves. */
  bio?: string;
  /* The rower wears the black check (lib/rowPlus.ts). */
  plus?: boolean;
  /* On the viewer's own profile: follow requests waiting on them. */
  requests: number;
  /* For an admin looking at somebody else: the id the delete-a-rower route takes. */
  adminId: string | null;
  isMe: boolean;
  masked: boolean;
  blackoutNote: string;
  until: string | null;
  club: boolean;
  paceTag: string | null;
  elite: boolean;
  sessions: number;
  bests: Best[];
  logRows: LogRow[];
  period: { key: string; kind: "month" | "all"; label: string };
  month: { key: string; firstDow: number; days: number } | null;
  periodOptions: { key: string; label: string }[];
  thisMonthKey: string;
  days: number;
  totals: { meters: number; sessions: number; seconds: number; longest: number } | null;
  lifetime: { meters: number; seconds: number; sessions: number } | null;
  rank: { place: number; of: number } | null;
  byDay: Record<string, number>;
  paceCurve: { m: number; s: number; dayStr: string }[];
  paceDots: { m: number; s: number; rowM: number; dayStr: string }[];
  field: { field: FieldModel; you: { sessions: number; avgLen: number; avgPace: number; lenPct: number; pacePct: number; lengthYou: KdeYou; paceYou: KdeYou }; distances: DistanceKde[] } | null;
  ergRows: ErgRow[];
  ownTag: { until?: string } | null;
  /* The rower's 5Ks over all months, for the RATINGS tab (2026-11-24): how
   * many, the average pace (s a 500 m), the standard deviation of the paces
   * (null under two), and each pace, oldest first. Null on a masked or
   * locked page; missing from a server before it. */
  fiveK?: FiveK | null;
};
export type FiveK = { n: number; meanPace: number; sdPace: number | null; paces: number[] };

export type RecordRow = { participantId: string; entryId?: string; name: string; rowerNumber: number; division: string; value: number; day?: string; sessions?: number; masked?: boolean; digits?: number; hideLow?: number; unranked?: boolean; paceTag?: string };
export type PeriodRow = { participantId: string; name: string; division: string; rowerNumber: number; meters: number; sessions: number; masked?: boolean; digits?: number };
export type Stats = {
  period: { key: string; kind: "month" | "all"; label: string };
  month: { key: string; label: string; short: string; firstDow: number; days: number };
  liveMonth: boolean;
  weeks: { key: string; label: string; first: string; last: string }[];
  meId: string | null;
  periods: { key: string; label: string }[];
  records: Record<"total" | "5000" | "10000" | "longest" | "bigday", RecordRow[]>;
  weekly: PeriodRow[][];
  daily: PeriodRow[][];
  dayTotals: { meters: number; sessions: number; rowers: number }[];
  weekTotals: { meters: number; sessions: number; rowers: number }[];
  todayDay: number;
  defaultWeek: number;
  community: { meters: number; rowers: number; sessions: number };
  communityByDay: Record<string, number>;
  hourGrid: number[][];
  gridDayCount: number;
  field: FieldModel | null;
  hours: { counts: number[]; start: number; yMax: number } | null;
  distances: DistanceKde[];
  attendance: { rows: PeriodRow[]; note: string } | null;
  blackout: { active: boolean; endsAt?: string };
};
