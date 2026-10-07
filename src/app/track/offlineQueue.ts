import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The offline queue behind the crew and van pages (TRACKER_SPEC.md §8 rules
 * 5–6, §11 Crew/Van): taps and fixes are written to IndexedDB first, then
 * sent, and stay queued until the server acknowledges them. No dependency —
 * the whole thing is ~200 lines over the raw IndexedDB API.
 *
 * Safety choices worth knowing about:
 *  - every queue keeps an in-memory map BESIDE the IndexedDB store, and
 *    `all()` merges both. A write that fails (private mode, quota, a busy
 *    database) lands in memory and is still sent; it only dies with the tab.
 *  - ids are the caller's when they mean something (a handoff's
 *    client_event_id, a fix's "<device>:<fix_time>") so `add` is idempotent
 *    and the server's acknowledgement can name exactly what to drop.
 *  - every send gets an AbortController: 15 s without an answer is a
 *    retryable failure, and a forced flush cuts a stalled send off and
 *    resends (the server is idempotent on both ids above).
 *  - `retract` takes an item back only when no send can have read it; the
 *    crew page's Undo relies on that to know a void will find its tap.
 *
 * Queue names in use: "handoffs:<slug>" (crew page) and
 * "fixes:<slug>:<device external id>" (van page).
 */

export interface QueueItem<T> {
  id: string;
  /** Epoch ms when it was queued; `all()` is ordered by this. */
  at: number;
  item: T;
}

export interface Queue<T> {
  /** Returns the id (the given one or a fresh UUID). Idempotent on id. */
  add(item: T, id?: string): Promise<string>;
  /** Oldest first. */
  all(): Promise<QueueItem<T>[]>;
  remove(id: string): Promise<void>;
  count(): Promise<number>;
  /** Where items are going: "idb", or "memory" when IndexedDB refused to open. */
  backend(): "idb" | "memory" | "pending";
}

const DB_PREFIX = "trk-queue:";
const STORE = "items";

/** Module-level so every hook on a page that opens the same name shares it. */
const memoryStores = new Map<string, Map<string, QueueItem<unknown>>>();

function memoryStore<T>(name: string): Map<string, QueueItem<T>> {
  let m = memoryStores.get(name);
  if (!m) {
    m = new Map();
    memoryStores.set(name, m);
  }
  return m as Map<string, QueueItem<T>>;
}

/** crypto.randomUUID where it exists (secure contexts), a v4 by hand elsewhere. */
export function uuid(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_PREFIX + name, 1);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("at", "at");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema: let go so it is not blocked.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

function run<R>(db: IDBDatabase, mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try {
      t = db.transaction(STORE, mode);
    } catch (err) {
      reject(err);
      return;
    }
    const req = op(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
    t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/** Insert unless the id is already there — a retried `add` keeps the original row and its place in line. */
function putIfAbsent<T>(db: IDBDatabase, row: QueueItem<T>): Promise<void> {
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try {
      t = db.transaction(STORE, "readwrite");
    } catch (err) {
      reject(err);
      return;
    }
    const store = t.objectStore(STORE);
    const g = store.get(row.id);
    g.onsuccess = () => {
      if (g.result === undefined) store.add(row);
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error ?? new Error("IndexedDB write failed"));
    t.onabort = () => reject(t.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openQueue<T>(name: string): Queue<T> {
  const mem = memoryStore<T>(name);
  let dbp: Promise<IDBDatabase> | null = null;
  let backend: "idb" | "memory" | "pending" = "pending";

  const db = (): Promise<IDBDatabase> => {
    if (!dbp) {
      dbp = openDb(name).then(
        (d) => {
          backend = "idb";
          return d;
        },
        (err) => {
          backend = "memory";
          throw err;
        },
      );
    }
    return dbp;
  };

  return {
    async add(item, id) {
      const qid = id ?? uuid();
      if (mem.has(qid)) return qid;
      const row: QueueItem<T> = { id: qid, at: Date.now(), item };
      try {
        const d = await db();
        await putIfAbsent(d, row);
      } catch {
        mem.set(qid, row);
      }
      return qid;
    },
    async all() {
      const out = new Map<string, QueueItem<T>>();
      try {
        const d = await db();
        const rows = (await run(d, "readonly", (s) => s.getAll())) as QueueItem<T>[];
        for (const r of rows) out.set(r.id, r);
      } catch {
        /* memory only */
      }
      for (const r of mem.values()) out.set(r.id, r);
      return Array.from(out.values()).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
    async remove(id) {
      mem.delete(id);
      try {
        const d = await db();
        await run(d, "readwrite", (s) => s.delete(id));
      } catch {
        /* nothing in idb to remove */
      }
    },
    async count() {
      return (await this.all()).length;
    },
    backend() {
      return backend;
    },
  };
}

/* ─── React hook ──────────────────────────────────────────────────────────── */

export type QueueState = "idle" | "sending" | "waiting";

export interface SendItem<T> {
  id: string;
  item: T;
}

/**
 * Sends a batch and returns the ids to DROP from the queue: acknowledged by
 * the server, or permanently rejected (a tap for an unknown participant
 * must not block everything behind it forever). Throw for anything worth
 * retrying — no network, a 5xx, a rejected crew key.
 *
 * `signal` must reach every fetch the sender makes: the hook aborts it
 * after `sendTimeoutMs`, and when a forced flush (Send now, the 'online'
 * event, the tab shown again) wants to resend over a request that has
 * stalled. The review found a stalled POST "pins the queue in Sending…
 * and every later flush returns early" — the signal is what unpins it.
 */
export type Sender<T> = (items: SendItem<T>[], signal: AbortSignal) => Promise<string[]>;

export interface OfflineQueueOptions {
  /** Do not start a send sooner than this after the previous one (the van's "at most every 10 s"). */
  minIntervalMs?: number;
  /** Items per POST. */
  batchMax?: number;
  /** Backoff ceiling (spec: 1 s, 2 s, 4 s … max 60 s). */
  maxBackoffMs?: number;
  /** Abort a send that has not answered in this long and treat it as a retryable failure. */
  sendTimeoutMs?: number;
}

const DEFAULT_SEND_TIMEOUT_MS = 15_000;

export interface OfflineQueue<T> {
  pending: QueueItem<T>[];
  enqueue: (item: T, id?: string) => Promise<string>;
  /** Send now (ignores the throttle; cuts off a stalled send first). */
  flush: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /**
   * Take back an item that no send has read yet. Returns false — and leaves
   * the item queued — when a flush has already read the store or has this
   * item in the batch it is sending, because then the server may be about
   * to record it; it stays until acknowledged, so an undo queued behind it
   * is sure to find it on the server.
   */
  retract: (id: string) => Promise<boolean>;
  state: QueueState;
  lastError: string | null;
  /** Consecutive failed attempts; 0 after a success. */
  attempt: number;
  /** Epoch ms of the scheduled retry while waiting, else null. */
  nextRetryAt: number | null;
  backend: "idb" | "memory" | "pending";
}

export function useOfflineQueue<T>(name: string, send: Sender<T>, opts: OfflineQueueOptions = {}): OfflineQueue<T> {
  const queue = useMemo(() => openQueue<T>(name), [name]);
  const [pending, setPending] = useState<QueueItem<T>[]>([]);
  const [state, setState] = useState<QueueState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [backend, setBackend] = useState<"idb" | "memory" | "pending">("pending");

  const sendRef = useRef(send);
  sendRef.current = send;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const inFlight = useRef(false);
  /** True while a flush is reading the store — the moment before a batch is fixed. */
  const reading = useRef(false);
  /** The ids in the batch being sent right now (empty between sends). */
  const sendingIds = useRef<Set<string>>(new Set());
  /** The controller of the send in flight; abort() ends it early. */
  const abortRef = useRef<AbortController | null>(null);
  /** A forced flush asked us to cut the in-flight send off and go again at once. */
  const resendAsked = useRef(false);
  const again = useRef(false);
  const againForce = useRef(false);
  const timer = useRef<number | null>(null);
  const lastStart = useRef(0);
  const attemptRef = useRef(0);
  const alive = useRef(true);
  const flushRef = useRef<(o?: { force?: boolean }) => Promise<void>>(async () => {});

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const refresh = useCallback(async (): Promise<QueueItem<T>[]> => {
    const items = await queue.all();
    if (alive.current) {
      setPending(items);
      setBackend(queue.backend());
    }
    return items;
  }, [queue]);

  const schedule = useCallback(
    (ms: number) => {
      clearTimer();
      if (!alive.current) return;
      setNextRetryAt(Date.now() + ms);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        void flushRef.current();
      }, ms);
    },
    [clearTimer],
  );

  const flush = useCallback(
    async (o?: { force?: boolean }) => {
      if (typeof window === "undefined" || !alive.current) return;
      if (inFlight.current || reading.current) {
        again.current = true;
        if (o?.force) {
          againForce.current = true;
          if (abortRef.current) {
            // Send now, back online, tab shown again: a request that has not
            // answered is not worth waiting for. Cut it off and go again —
            // safe because the server is idempotent on client_event_id and
            // on (device, fix_time), so a request that did land costs
            // nothing to repeat.
            resendAsked.current = true;
            abortRef.current.abort();
          }
        }
        return;
      }
      reading.current = true;
      let items: QueueItem<T>[];
      try {
        items = await refresh();
      } finally {
        reading.current = false;
      }
      if (!alive.current) return;
      if (items.length === 0) {
        if (again.current) {
          // Something was enqueued while we were reading: read again.
          const f = againForce.current;
          again.current = false;
          againForce.current = false;
          void flush({ force: f });
          return;
        }
        clearTimer();
        attemptRef.current = 0;
        setAttempt(0);
        setNextRetryAt(null);
        setState("idle");
        return;
      }
      const { minIntervalMs = 0, batchMax = 200, maxBackoffMs = 60_000, sendTimeoutMs = DEFAULT_SEND_TIMEOUT_MS } = optsRef.current;
      const force = o?.force || againForce.current;
      againForce.current = false;
      const since = Date.now() - lastStart.current;
      if (!force && minIntervalMs > 0 && since < minIntervalMs) {
        // Not an error: batching. Show "waiting" with the moment it will go.
        // The timer reads the store afresh, so a wake-up asked for during
        // the read is already covered.
        again.current = false;
        setState("waiting");
        if (timer.current === null) schedule(minIntervalMs - since);
        return;
      }
      clearTimer();
      inFlight.current = true;
      lastStart.current = Date.now();
      setState("sending");
      setNextRetryAt(null);

      const batch = items.slice(0, batchMax);
      sendingIds.current = new Set(batch.map((q) => q.id));
      // One controller per send: the timeout and a forced resend both end
      // the request through it, and the sender hands it to every fetch.
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      resendAsked.current = false;
      const timeout = window.setTimeout(() => ctrl.abort(), sendTimeoutMs);
      let acked: string[] | null = null;
      let error: string | null = null;
      try {
        acked = await sendRef.current(
          batch.map((q) => ({ id: q.id, item: q.item })),
          ctrl.signal,
        );
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      window.clearTimeout(timeout);
      if (abortRef.current === ctrl) abortRef.current = null;
      sendingIds.current = new Set();
      inFlight.current = false;
      if (!alive.current) return;

      if (!acked || acked.length === 0) {
        if (ctrl.signal.aborted && resendAsked.current) {
          // Cut off on purpose for a resend: no backoff, go now.
          resendAsked.current = false;
          again.current = false;
          againForce.current = false;
          void flush({ force: true });
          return;
        }
        if (ctrl.signal.aborted) error = `No answer from the server in ${Math.round(sendTimeoutMs / 1000)} s`;
        attemptRef.current += 1;
        setAttempt(attemptRef.current);
        setLastError(error ?? "The server accepted nothing");
        setState("waiting");
        schedule(Math.min(maxBackoffMs, 1000 * 2 ** (attemptRef.current - 1)));
        return;
      }

      const drop = new Set(acked);
      await Promise.all(batch.filter((q) => drop.has(q.id)).map((q) => queue.remove(q.id)));
      const left = await refresh();
      setLastError(null);
      attemptRef.current = 0;
      setAttempt(0);
      if (left.length === 0) {
        setState("idle");
        again.current = false;
        againForce.current = false;
        return;
      }
      if (items.length > batch.length) {
        // A full batch went: the rest goes now, throttle or not.
        again.current = false;
        againForce.current = false;
        void flush({ force: true });
        return;
      }
      if (again.current || againForce.current) {
        // New items arrived while sending: ordinary (throttled) flush, or a
        // forced one if that is what was asked for meanwhile.
        const f = againForce.current;
        again.current = false;
        againForce.current = false;
        void flush({ force: f });
        return;
      }
      // Some of the batch were neither acknowledged nor dropped: back off.
      attemptRef.current += 1;
      setAttempt(attemptRef.current);
      setState("waiting");
      schedule(Math.min(maxBackoffMs, 1000 * 2 ** (attemptRef.current - 1)));
    },
    [queue, refresh, schedule, clearTimer],
  );
  flushRef.current = flush;

  const enqueue = useCallback(
    async (item: T, id?: string) => {
      const qid = await queue.add(item, id);
      await refresh();
      void flush();
      return qid;
    },
    [queue, refresh, flush],
  );

  const remove = useCallback(
    async (id: string) => {
      await queue.remove(id);
      const left = await refresh();
      if (left.length === 0) {
        clearTimer();
        setState("idle");
        setNextRetryAt(null);
      }
    },
    [queue, refresh, clearTimer],
  );

  const retract = useCallback(
    async (id: string): Promise<boolean> => {
      // A flush that is reading the store may be about to send this item;
      // a send that has it in its batch may be landing it right now. In
      // both cases it stays until the server answers for it. Otherwise no
      // send can pick it up before the delete below: the IndexedDB delete
      // transaction is created in this task (mem.delete is synchronous),
      // and a read-only transaction opened later waits for it.
      if (reading.current || sendingIds.current.has(id)) return false;
      await remove(id);
      return true;
    },
    [remove],
  );

  useEffect(() => {
    alive.current = true;
    attemptRef.current = 0;
    void flush();
    const onOnline = () => {
      attemptRef.current = 0;
      void flush({ force: true });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush({ force: true });
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      clearTimer();
      // Nothing waits for an answer once the page is gone; the item stays
      // queued in IndexedDB and goes next time.
      abortRef.current?.abort();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flush, clearTimer]);

  return { pending, enqueue, flush: () => flush({ force: true }), remove, retract, state, lastError, attempt, nextRetryAt, backend };
}

/** navigator.onLine, hydration-safe (true until mounted). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}
