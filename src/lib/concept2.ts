import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { validateTelemetryDoc, type TelemetryDoc } from "@/lib/pm5/session";
import { M2D_FIRST } from "@/app/row100k/m2d";

/* A ROW ROW, STRAIGHT INTO THE ROWER'S CONCEPT2 LOGBOOK (2026-11-26; owner,
 * of every M2D row being logged twice, once on ROW and once typed into
 * log.concept2.com: "is there a way for us to auto write to the log book?"
 * then "Def do this."). mobile/CONCEPT2-LOGBOOK.md is the plan; this is all
 * the talk with Concept2 there is.
 *
 * SET UP by four values in the environment, and nothing works without all
 * of them (c2Config answers null, every route says "not set up"):
 *   CONCEPT2_CLIENT_ID      the key's client id, from <base>/developers/keys
 *   CONCEPT2_CLIENT_SECRET  its secret; it stays on the server
 *   CONCEPT2_BASE           https://log-dev.concept2.com until Concept2
 *                           approves live writing, then https://log.concept2.com
 *   CONCEPT2_TOKEN_KEY      any long random string; the rowers' tokens are
 *                           encrypted under it. Never change it once rowers
 *                           have connected.
 * and, only if the address Concept2 was given differs from the one the
 * request came in on, CONCEPT2_REDIRECT_URI.
 *
 * WHAT IS SENT: rows with a recording behind them, rowed with ROW on the
 * monitor, from the first day of M2D on. The recording is what the result
 * is made of: the monitor's meters, time and end-of-workout stamp, its
 * splits and its strokes. A row typed into ROW is not sent: it was rowed
 * without ROW, often with ErgData, which already sent it.
 *
 * NEVER TWICE: one result per ROW row (Concept2Push.entryId is unique), and
 * before anything goes the rower's Logbook is read around that day; a
 * result of the same meters and time that ended about then (or a row
 * typed in by hand on that day) means it is already there, and nothing is
 * sent. Concept2 refuses an exact copy itself (409), which reads the same. */

export type C2Config = { base: string; clientId: string; secret: string; key: Buffer; redirect: string | null };

export function c2Config(): C2Config | null {
  const base = (process.env.CONCEPT2_BASE ?? "").trim().replace(/\/+$/, "");
  const clientId = (process.env.CONCEPT2_CLIENT_ID ?? "").trim();
  const secret = (process.env.CONCEPT2_CLIENT_SECRET ?? "").trim();
  const keyRaw = (process.env.CONCEPT2_TOKEN_KEY ?? "").trim();
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(base) || !clientId || !secret || keyRaw.length < 16) return null;
  const redirect = (process.env.CONCEPT2_REDIRECT_URI ?? "").trim() || null;
  return { base, clientId, secret, key: createHash("sha256").update(keyRaw).digest(), redirect };
}

/* Read only, then written to: "user:read" for the Logbook's name, and
 * "results:write", which carries "results:read" with it. Concept2 wants the
 * same string on every call. */
export const SCOPE = "user:read,results:write";
export const CALLBACK_PATH = "/api/row100k/app/concept2/callback";
export const APP_RETURN = "rowtember://concept2";
const DEFAULT_TZ = "America/Los_Angeles";

export const redirectUri = (cfg: C2Config, reqUrl: string): string => cfg.redirect ?? new URL(CALLBACK_PATH, reqUrl).toString();

/* ---- the tokens, encrypted at rest ---------------------------------- */

export function seal(cfg: C2Config, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cfg.key, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function unseal(cfg: C2Config, sealed: string): string | null {
  try {
    const [v, iv, tag, body] = sealed.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", cfg.key, Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---- the state that rides through Concept2's sign-in ---------------- */

/* Who pressed Connect, on which phone zone, good for ten minutes. Signed,
 * so the callback (reached from the phone's browser, with no ROW token)
 * knows whose link it is making. */
export function makeState(cfg: C2Config, userId: string, tz: string): string {
  const body = Buffer.from(JSON.stringify({ u: userId, z: tz, e: Date.now() + 10 * 60_000, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${createHmac("sha256", cfg.key).update(`state.${body}`).digest("base64url")}`;
}

export function readState(cfg: C2Config, state: string): { userId: string; tz: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", cfg.key).update(`state.${body}`).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u?: unknown; z?: unknown; e?: unknown };
    if (typeof s.u !== "string" || typeof s.e !== "number" || s.e < Date.now()) return null;
    return { userId: s.u, tz: cleanTz(s.z) };
  } catch {
    return null;
  }
}

export function cleanTz(v: unknown): string {
  if (typeof v !== "string" || v.length > 64) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return DEFAULT_TZ;
  }
}

/* ---- OAuth ----------------------------------------------------------- */

export function authorizeUrl(cfg: C2Config, redirect: string, state: string): string {
  const q = new URLSearchParams({ client_id: cfg.clientId, scope: SCOPE, response_type: "code", redirect_uri: redirect, state });
  return `${cfg.base}/oauth/authorize?${q.toString()}`;
}

type TokenAnswer = { access_token: string; refresh_token: string; expires_in: number };

async function tokenCall(cfg: C2Config, params: Record<string, string>): Promise<TokenAnswer> {
  const res = await fetch(`${cfg.base}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.secret, scope: SCOPE, ...params }).toString(),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => null)) as Partial<TokenAnswer> | null;
  if (!res.ok || !j?.access_token || !j.refresh_token) throw new C2Error(`Concept2 would not sign in (${res.status}).`, res.status);
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_in: Number(j.expires_in) || 7 * 86400 };
}

export class C2Error extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/* The code off the callback, for a link. Reads the Logbook's own user. */
export async function connect(cfg: C2Config, userId: string, code: string, redirect: string, tz: string): Promise<{ name: string }> {
  const t = await tokenCall(cfg, { grant_type: "authorization_code", code, redirect_uri: redirect });
  const res = await fetch(`${cfg.base}/api/users/me`, { headers: { authorization: `Bearer ${t.access_token}`, accept: "application/json" }, cache: "no-store" });
  const j = (await res.json().catch(() => null)) as { data?: { id?: number; username?: string; first_name?: string; last_name?: string } } | null;
  if (!res.ok || typeof j?.data?.id !== "number") throw new C2Error("Concept2 did not say whose Logbook it is.", res.status);
  const u = j.data;
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || "";
  const data = {
    c2UserId: u.id as number,
    c2Name: name.slice(0, 80),
    base: cfg.base,
    accessToken: seal(cfg, t.access_token),
    refreshToken: seal(cfg, t.refresh_token),
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
    timezone: tz,
    status: "ok",
  };
  await db.concept2Link.upsert({ where: { userId }, create: { userId, ...data }, update: { ...data, connectedAt: new Date() } });
  /* Rows Concept2 refused under the last link get another go. */
  await db.concept2Push.updateMany({ where: { userId, state: "failed" }, data: { state: "pending", tries: 0, nextAt: new Date(), error: "" } });
  return { name };
}

type Link = NonNullable<Awaited<ReturnType<typeof db.concept2Link.findUnique>>>;

class Revoked extends Error {}

/* A live access token for the link, refreshed when it has under a day left
 * (or `force`). Concept2 hands back a new refresh token every time and the
 * old one is spent, so two refreshes at once would have the slower one
 * fail: that one reads the link again and takes the token the faster one
 * saved. */
async function accessFor(cfg: C2Config, link: Link, force = false): Promise<{ token: string; link: Link }> {
  const cur = unseal(cfg, link.accessToken);
  if (cur && !force && link.expiresAt.getTime() - Date.now() > 86400_000) return { token: cur, link };
  const refresh = unseal(cfg, link.refreshToken);
  if (!refresh) throw new Revoked();
  try {
    const t = await tokenCall(cfg, { grant_type: "refresh_token", refresh_token: refresh });
    const next = await db.concept2Link.update({
      where: { id: link.id },
      data: { accessToken: seal(cfg, t.access_token), refreshToken: seal(cfg, t.refresh_token), expiresAt: new Date(Date.now() + t.expires_in * 1000) },
    });
    return { token: t.access_token, link: next };
  } catch (err) {
    const now = await db.concept2Link.findUnique({ where: { id: link.id } });
    if (now && now.refreshToken !== link.refreshToken) {
      const tok = unseal(cfg, now.accessToken);
      if (tok) return { token: tok, link: now };
    }
    if (err instanceof C2Error && (err.status === 400 || err.status === 401)) throw new Revoked();
    throw err;
  }
}

/* One call to the Logbook API as the rower; a 401 refreshes once. */
async function call(cfg: C2Config, ref: { link: Link }, path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; json: unknown }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const a = await accessFor(cfg, ref.link, attempt > 0);
    ref.link = a.link;
    const res = await fetch(`${cfg.base}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${a.token}`, accept: "application/json", ...(init.body === undefined ? {} : { "content-type": "application/json" }), "X-Client-Version": "ROW" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    if (res.status === 401 && attempt === 0) continue;
    if (res.status === 401) throw new Revoked();
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  throw new Revoked();
}

/* ---- the result a recording makes ----------------------------------- */

/* The PM5's workout types (pm5.ts WorkoutType) in Concept2's words. */
const WORKOUT_TYPE: Record<number, string> = {
  0: "JustRow",
  1: "JustRow",
  2: "FixedDistanceSplits",
  3: "FixedDistanceSplits",
  4: "FixedTimeSplits",
  5: "FixedTimeSplits",
  6: "FixedTimeInterval",
  7: "FixedDistanceInterval",
  8: "VariableInterval",
  9: "VariableIntervalUndefinedRest",
  10: "FixedCalorie",
  11: "FixedWattMinute",
  12: "FixedCalorieInterval",
};
const INTERVALS = new Set([6, 7, 8, 9, 12]);

const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

/* "2026-11-27 07:42:10" in `tz`. */
export function localStamp(ms: number, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/* The monitor's own end-of-workout stamp (the summary's log date and time,
 * the one ErgData sends), as "yyyy-mm-dd hh:mm:00" on the monitor's clock.
 * Date: month in bits 0-3, day 4-8, years since 2000 above; time: minutes
 * low byte, hours high. Null when it does not read as a date. */
export function monitorStamp(logDate: number, logTime: number): string | null {
  const month = logDate & 0x0f;
  const day = (logDate >> 4) & 0x1f;
  const year = 2000 + (logDate >> 9);
  const minute = logTime & 0xff;
  const hour = logTime >> 8;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)} ${p(hour)}:${p(minute)}:00`;
}

const stampMs = (s: string): number => Date.parse(s.replace(" ", "T") + "Z");

export type C2Result = Record<string, unknown> & { date: string; distance: number; time: number };

/* What goes to Concept2 for one recording. `full` adds the splits and the
 * strokes; without, the totals alone (the retry when Concept2 will not
 * take the detail). */
export function resultFrom(doc: TelemetryDoc, tz: string, weightClass: "H" | "L", full: boolean): C2Result {
  const s39 = doc.summary.s39;
  const distance = Math.floor(s39 && s39.distanceM > 0 ? s39.distanceM : doc.totals.meters);
  const time = Math.round(s39 && s39.elapsedHundredths > 0 ? s39.elapsedHundredths / 10 : doc.totals.tenths);
  const endMs = new Date(doc.startedAt).getTime() + time * 100;
  const ours = localStamp(Math.min(endMs, Date.now()), tz);
  /* The monitor's stamp when its clock agrees with the phone's to within
   * ten minutes (a PM5 whose clock was never set reads 2000 or the like). */
  const mon = s39 ? monitorStamp(s39.logDate, s39.logTime) : null;
  const date = mon && Math.abs(stampMs(mon) - stampMs(ours)) <= 10 * 60_000 ? mon : ours;
  const wt = s39?.workoutType ?? doc.workout.type;
  const r: C2Result = { type: "rower", date, timezone: tz, distance, time, weight_class: weightClass, workout_type: WORKOUT_TYPE[wt] ?? "unknown" };
  const spm = int(s39?.avgStrokeRate ?? doc.totals.avgSpm);
  if (spm && spm > 0) r.stroke_rate = spm;
  if (doc.totals.strokes > 0) r.stroke_count = Math.round(doc.totals.strokes);
  const drag = int(s39?.dragFactorAvg ?? doc.totals.dragFactor);
  if (drag && drag > 0) r.drag_factor = drag;
  const cal = int(doc.summary.s3a?.totalCalories ?? doc.totals.calories);
  if (cal && cal > 0) r.calories_total = cal;
  const hr = int(s39?.avgHeartRate ?? doc.totals.avgHr);
  if (hr && hr > 0) r.heart_rate = { average: hr };
  if (!full || INTERVALS.has(wt)) return r;

  /* The splits, when they add up to the row (within 1%): a set that does
   * not would fail the whole result. */
  const splits = doc.splits
    .filter((s) => s.a && s.a.splitDistanceM > 0 && s.a.splitTimeS > 0)
    .sort((x, y) => x.n - y.n)
    .map((s) => ({ distance: Math.round(s.a!.splitDistanceM), time: Math.round(s.a!.splitTimeS * 10), ...(s.b && s.b.avgStrokeRate > 0 ? { stroke_rate: Math.round(s.b.avgStrokeRate) } : {}) }));
  const sumD = splits.reduce((a, s) => a + s.distance, 0);
  const sumT = splits.reduce((a, s) => a + s.time, 0);
  if (splits.length > 1 && Math.abs(sumD - distance) <= distance * 0.01 && Math.abs(sumT - time) <= time * 0.01) r.workout = { splits };

  /* The strokes, when the recording is whole: a thinned one would draw a
   * part of the row as the whole of it. */
  if (!doc.notes.thinned && !doc.notes.headTrimmedFromS && doc.strokes.length >= 8) {
    let lastT = -1;
    let lastD = -1;
    const strokes: Record<string, number>[] = [];
    for (const s of [...doc.strokes].sort((a, b) => a.elapsedHundredths - b.elapsedHundredths)) {
      const t = Math.round(s.elapsedHundredths / 10);
      const d = Math.round(s.distanceTenths);
      if (t < lastT || d < lastD) continue;
      lastT = t;
      lastD = d;
      const pace = s.pace && s.pace > 0 ? Math.round(s.pace / 10) : s.watts > 0 ? Math.round(5000 * Math.cbrt(2.8 / s.watts)) : 0;
      strokes.push({ t, d, p: pace, spm: Math.round(s.spm), ...(s.hr && s.hr > 0 ? { hr: Math.round(s.hr) } : {}) });
    }
    if (strokes.length >= 8) r.stroke_data = strokes;
  }
  return r;
}

/* ---- is it already there -------------------------------------------- */

type Listed = { id: number; date?: string; date_utc?: string; distance?: number; time?: number; source?: string; type?: string };

/* The same piece: equal meters, the time within a second, and an end
 * within a quarter hour; or a row typed in by hand on the website (often
 * with no time of day) on the same day. */
export function samePiece(r: Listed, ours: C2Result): boolean {
  if (r.distance !== ours.distance || typeof r.time !== "number" || Math.abs(r.time - ours.time) > 10) return false;
  if (r.date && r.date.slice(0, 10) === ours.date.slice(0, 10) && (r.source ?? "").toLowerCase() === "web") return true;
  if (!r.date) return false;
  return Math.abs(stampMs(r.date) - stampMs(ours.date)) <= 15 * 60_000;
}

async function listResults(cfg: C2Config, ref: { link: Link }, from: string, to: string): Promise<Listed[]> {
  const out: Listed[] = [];
  for (let page = 1; page <= 10; page++) {
    const q = new URLSearchParams({ from, to, type: "rower", number: "250", page: String(page) });
    const r = await call(cfg, ref, `/api/users/me/results?${q.toString()}`);
    if (r.status !== 200) throw new C2Error(`Concept2 would not list the Logbook (${r.status}).`, r.status);
    const j = r.json as { data?: Listed[]; meta?: { pagination?: { total_pages?: number } } } | null;
    out.push(...(j?.data ?? []));
    if (page >= (j?.meta?.pagination?.total_pages ?? 1)) break;
  }
  return out;
}

const shiftDay = (day: string, n: number): string => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/* ---- the sync -------------------------------------------------------- */

export type C2Status = {
  configured: boolean;
  /* The server it talks to: "test" (log-dev) or "live". */
  server: "test" | "live" | null;
  connected: boolean;
  revoked: boolean;
  name: string;
  connectedAt: string | null;
  lastPushAt: string | null;
  counts: { sent: number; already: number; pending: number; failed: number };
  failed: { day: string; meters: number; error: string }[];
};

export async function statusFor(userId: string): Promise<C2Status> {
  const cfg = c2Config();
  const link = await db.concept2Link.findUnique({ where: { userId } });
  const live = !!link && !!cfg && link.base === cfg.base;
  const groups = await db.concept2Push.groupBy({ by: ["state"], where: { userId }, _count: true });
  const n = (s: string) => groups.find((g) => g.state === s)?._count ?? 0;
  const fails = await db.concept2Push.findMany({ where: { userId, state: "failed" }, orderBy: { updatedAt: "desc" }, take: 5, select: { entryId: true, error: true } });
  const entries = fails.length ? await db.rowEntry.findMany({ where: { id: { in: fails.map((f) => f.entryId) } }, select: { id: true, day: true, meters: true } }) : [];
  return {
    configured: !!cfg,
    server: cfg ? (/log-dev\./.test(cfg.base) ? "test" : "live") : null,
    connected: live && link!.status === "ok",
    revoked: live && link!.status === "revoked",
    name: live ? link!.c2Name : "",
    connectedAt: live ? link!.connectedAt.toISOString() : null,
    lastPushAt: live && link!.lastPushAt ? link!.lastPushAt.toISOString() : null,
    counts: { sent: n("sent"), already: n("already-there"), pending: n("pending"), failed: n("failed") },
    failed: fails.map((f) => {
      const e = entries.find((x) => x.id === f.entryId);
      return { day: e?.day ?? "", meters: e?.meters ?? 0, error: f.error };
    }),
  };
}

/* Pacific midnight of M2D's first day: the recordings from here on go. */
const FROM_MS = Date.parse(`${M2D_FIRST}T08:00:00Z`);
const MAX_TRIES = 12;
const backoff = (tries: number): number => Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, tries - 1));

/* Send what is due for one account: rows off the monitor since M2D began
 * that have not gone yet. Bounded by `budgetMs` so a route answers in time;
 * what is left goes on the next call. Never throws. */
export async function syncUser(userId: string, opts: { tz?: string; budgetMs?: number } = {}): Promise<C2Status> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 20_000;
  const cfg = c2Config();
  try {
    let link = await db.concept2Link.findUnique({ where: { userId } });
    if (!cfg || !link || link.status !== "ok" || link.base !== cfg.base) return await statusFor(userId);
    if (opts.tz && cleanTz(opts.tz) !== link.timezone) link = await db.concept2Link.update({ where: { id: link.id }, data: { timezone: cleanTz(opts.tz) } });
    const ref = { link };

    /* Every row off the monitor since M2D began gets its line. */
    const recs = await db.rowTelemetry.findMany({ where: { userId, simulated: false, entryId: { not: null }, startedAt: { gte: new Date(FROM_MS) } }, select: { entryId: true } });
    const ids = [...new Set(recs.map((r) => r.entryId as string))];
    if (ids.length) {
      const live = await db.rowEntry.findMany({ where: { id: { in: ids }, day: { gte: M2D_FIRST } }, select: { id: true } });
      if (live.length) await db.concept2Push.createMany({ data: live.map((e) => ({ entryId: e.id, userId })), skipDuplicates: true });
    }

    const due = await db.concept2Push.findMany({ where: { userId, state: "pending", nextAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: 40 });
    if (!due.length) return await statusFor(userId);
    const entries = await db.rowEntry.findMany({ where: { id: { in: due.map((d) => d.entryId) } }, select: { id: true, day: true, participant: { select: { weightKg: true, division: true } } } });
    const days = entries.map((e) => e.day).sort();
    const listed = days.length ? await listResults(cfg, ref, shiftDay(days[0], -1), shiftDay(days[days.length - 1], 1)) : [];

    for (const p of due) {
      if (Date.now() - started > budget) break;
      const entry = entries.find((e) => e.id === p.entryId);
      if (!entry) {
        /* Deleted on ROW before it went: nothing to send. */
        await db.concept2Push.delete({ where: { id: p.id } }).catch(() => null);
        continue;
      }
      /* Claimed, so a second sync at the same moment leaves it alone. */
      const claim = await db.concept2Push.updateMany({ where: { id: p.id, state: "pending", nextAt: { lte: new Date() } }, data: { nextAt: new Date(Date.now() + 5 * 60_000), tries: { increment: 1 } } });
      if (claim.count !== 1) continue;
      const tries = p.tries + 1;
      const rec = await db.rowTelemetry.findFirst({ where: { userId, entryId: entry.id, simulated: false }, orderBy: { createdAt: "asc" }, select: { data: true } });
      const doc = rec ? validateTelemetryDoc(rec.data) : "no recording";
      if (typeof doc === "string") {
        await db.concept2Push.update({ where: { id: p.id }, data: { state: "failed", error: "The recording behind this row could not be read." } });
        continue;
      }
      const w = entry.participant.weightKg;
      const light = typeof w === "number" && ((entry.participant.division === "M" && w < 75) || (entry.participant.division === "F" && w < 61.5));
      const result = resultFrom(doc, link.timezone, light ? "L" : "H", true);

      const there = listed.find((r) => samePiece(r, result));
      if (there) {
        await db.concept2Push.update({ where: { id: p.id }, data: { state: "already-there", c2ResultId: there.id, error: "" } });
        continue;
      }
      try {
        let r = await call(cfg, ref, "/api/users/me/results", { method: "POST", body: result });
        /* Concept2 would not take the detail: the totals alone. */
        if (r.status === 422 && (result.workout || result.stroke_data)) r = await call(cfg, ref, "/api/users/me/results", { method: "POST", body: resultFrom(doc, link.timezone, light ? "L" : "H", false) });
        const j = r.json as { data?: { id?: number }; message?: string; errors?: unknown } | null;
        if (r.status === 200 || r.status === 201) {
          const id = typeof j?.data?.id === "number" ? j.data.id : null;
          await db.concept2Push.update({ where: { id: p.id }, data: { state: "sent", c2ResultId: id, error: "" } });
          await db.concept2Link.update({ where: { id: link.id }, data: { lastPushAt: new Date() } });
          listed.push({ id: id ?? 0, date: result.date, distance: result.distance, time: result.time, source: "ROW" });
        } else if (r.status === 409) {
          await db.concept2Push.update({ where: { id: p.id }, data: { state: "already-there", error: "" } });
        } else if (r.status >= 500 || r.status === 429) {
          await db.concept2Push.update({ where: { id: p.id }, data: tries >= MAX_TRIES ? { state: "failed", error: `Concept2 was away (${r.status}).` } : { state: "pending", nextAt: new Date(Date.now() + backoff(tries)), error: `Concept2 was away (${r.status}).` } });
        } else {
          const why = typeof j?.message === "string" ? j.message : `Concept2 would not take it (${r.status}).`;
          console.error("concept2: a result was refused", r.status, JSON.stringify(j).slice(0, 500));
          await db.concept2Push.update({ where: { id: p.id }, data: { state: "failed", error: why.slice(0, 200) } });
        }
      } catch (err) {
        if (err instanceof Revoked) throw err;
        await db.concept2Push.update({ where: { id: p.id }, data: tries >= MAX_TRIES ? { state: "failed", error: "Concept2 could not be reached." } : { state: "pending", nextAt: new Date(Date.now() + backoff(tries)), error: "Concept2 could not be reached." } });
      }
    }
  } catch (err) {
    if (err instanceof Revoked) {
      await db.concept2Link.update({ where: { userId }, data: { status: "revoked" } }).catch(() => null);
      /* What was claimed goes back to waiting for the next Connect. */
      await db.concept2Push.updateMany({ where: { userId, state: "pending" }, data: { nextAt: new Date() } }).catch(() => null);
    } else {
      console.error("concept2: sync failed", err);
    }
  }
  return await statusFor(userId).catch(() => ({ configured: !!cfg, server: null, connected: false, revoked: false, name: "", connectedAt: null, lastPushAt: null, counts: { sent: 0, already: 0, pending: 0, failed: 0 }, failed: [] }));
}
