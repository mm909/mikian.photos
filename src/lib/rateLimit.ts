import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Lightweight rate limiting for public, cost-bearing endpoints (face search in
 * particular, where every call runs a paid AWS Rekognition query).
 *
 * Three backends, tried in order so the limit is HARD by default — no extra
 * infra required:
 *
 *   1. Upstash Redis (shared, durable) — used when UPSTASH_REDIS_REST_URL and
 *      UPSTASH_REDIS_REST_TOKEN are set (the env vars Vercel's Upstash
 *      integration injects). Fastest shared store; we speak its REST API with
 *      plain fetch — no SDK, no new dependency.
 *
 *   2. Postgres (shared, durable) — the default when Redis isn't configured.
 *      Reuses the database this app already has, so the limit is real on
 *      Vercel's ephemeral instances out of the box (no Upstash account needed).
 *      One atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` per check, so
 *      concurrent requests can't undercount. Requires the `RateLimit` table
 *      (prisma db push); if it's missing we fail open to (3).
 *
 *   3. In-memory fixed window (per-instance) — last resort if BOTH shared
 *      stores error (or the table isn't migrated yet). Per-Lambda only, so it's
 *      best-effort, but it still trips a single attacker on a warm instance and
 *      keeps local dev working with zero infra.
 *
 * All implement a fixed-window counter: the Nth request inside a `windowSec`
 * window for a given key is allowed iff N <= limit. Fixed windows can admit up
 * to ~2x `limit` across a window boundary; that's fine here — we want a coarse
 * cost ceiling, not precise fairness.
 *
 * The limiter NEVER throws: any backend hiccup degrades to the next one so a
 * flaky store can't take the endpoint down.
 */

export type RateLimitResult = {
  /** True when this request is within the limit and should proceed. */
  ok: boolean;
  limit: number;
  /** Requests left in the current window (0 once over the limit). */
  remaining: number;
  /** Unix ms when the window resets (approximate for the in-memory backend). */
  resetAt: number;
  /** Seconds the caller should wait before retrying — feeds `Retry-After`. */
  retryAfterSec: number;
  backend: "redis" | "postgres" | "memory";
};

/** Parse a positive-integer env var, falling back when unset/garbage. */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Best-effort client IP for a request.
 *
 * Prefer `x-real-ip` — on Vercel the edge sets it to the true client IP. We do
 * NOT trust the leftmost `x-forwarded-for` first: a client can prepend a forged
 * value there (Vercel appends the real IP rather than replacing the chain), so
 * keying on the leftmost would let an attacker rotate it and mint a fresh
 * limiter bucket per request. XFF's leftmost is only a fallback for
 * environments (local/dev, other proxies) that don't set `x-real-ip`.
 *
 * Unknown callers all share the `"unknown"` bucket — acceptable, since a client
 * that can suppress both headers is already past our trust boundary, and the
 * per-event daily cap (not IP-keyed) is the real cost ceiling regardless.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

async function redisFixedWindow(
  env: { url: string; token: string },
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  // One round-trip pipeline:
  //   INCR  — bump (and create) the per-window counter, returns the new count.
  //   EXPIRE … NX — anchor the TTL to the FIRST hit only, so the window can't
  //                 slide forever under sustained traffic (NX needs Redis 7+,
  //                 which Upstash is).
  //   PTTL  — read remaining ms so we can report an accurate Retry-After.
  const res = await fetch(`${env.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
    // Never let the limiter hang the request behind a slow cache call.
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);

  const data = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(data[0]?.result ?? 0);
  let pttl = Number(data[2]?.result ?? -1);
  // PTTL is -1 (no expiry) only in a tiny INCR/EXPIRE race — treat as a full
  // window so we still hand back a sane reset time.
  if (!Number.isFinite(pttl) || pttl < 0) pttl = windowSec * 1000;

  const ok = count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: Date.now() + pttl,
    retryAfterSec: ok ? 0 : Math.ceil(pttl / 1000),
    backend: "redis",
  };
}

/**
 * Postgres fixed-window counter. One row per (key, windowStart); the window is
 * floored from the wall clock so all instances agree on the same bucket. The
 * atomic upsert returns the post-increment count, so two concurrent requests
 * can never both see "0" — the second observes the first's bump.
 *
 * Throws (so `rateLimit` can fall through to memory) when the table is missing
 * or the DB is unreachable.
 */
async function pgFixedWindow(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const w = windowSec * 1000;
  const startMs = Math.floor(now / w) * w; // 86400s windows align to UTC midnight
  const windowStart = new Date(startMs);
  const expiresAt = new Date(startMs + w);

  const rows = await db.$queryRaw<{ count: number | bigint }[]>(Prisma.sql`
    INSERT INTO "RateLimit" ("key", "windowStart", "count", "expiresAt")
    VALUES (${key}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("key", "windowStart")
    DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count";
  `);
  const count = Number(rows[0]?.count ?? 1);

  // Sweep expired rows ~2% of the time so the table can't grow unbounded.
  if (Math.random() < 0.02) {
    void db.rateLimit
      .deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
      .catch(() => {
        /* best-effort */
      });
  }

  const ok = count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: expiresAt.getTime(),
    retryAfterSec: ok ? 0 : Math.ceil((expiresAt.getTime() - now) / 1000),
    backend: "postgres",
  };
}

type MemBucket = { count: number; resetAt: number };
const memStore = new Map<string, MemBucket>();
let lastPrune = 0;

function memFixedWindow(
  key: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  const now = Date.now();

  // Opportunistic prune so the Map can't grow without bound on a long-lived
  // warm instance — only when we cross a ~minute boundary, so it's cheap.
  if (now - lastPrune > 60_000) {
    for (const [k, b] of memStore) if (b.resetAt <= now) memStore.delete(k);
    lastPrune = now;
  }

  let bucket = memStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 };
    memStore.set(key, bucket);
  }
  bucket.count += 1;

  const ok = bucket.count <= limit;
  return {
    ok,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSec: ok ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
    backend: "memory",
  };
}

/**
 * Count one request against `key` and report whether it's within `limit` per
 * `windowSec`. Uses Redis when configured, the in-memory counter otherwise.
 */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const env = redisEnv();
  if (env) {
    try {
      return await redisFixedWindow(env, key, limit, windowSec);
    } catch (e) {
      // A cache hiccup must never take the endpoint down. Degrade to the next
      // shared store (Postgres) and note it once.
      console.warn(
        "rateLimit: redis backend failed, falling back to postgres:",
        e instanceof Error ? e.message : e
      );
    }
  }
  // Postgres is the durable default when Redis isn't configured (or just
  // failed): a real cross-instance limit using the DB we already have.
  try {
    return await pgFixedWindow(key, limit, windowSec);
  } catch (e) {
    // Table not migrated yet or DB unreachable — fail open to the per-instance
    // counter (still bounded) rather than block real buyers.
    console.warn(
      "rateLimit: postgres backend failed, falling back to memory:",
      e instanceof Error ? e.message : e
    );
  }
  return memFixedWindow(key, limit, windowSec);
}
