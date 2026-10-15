/**
 * The simulator's HTTP side: turns Deliveries into the real requests of the
 * URL contract (Traccar webhook, web adapter, crew handoffs), tallies what
 * the server said about each one, and fails loudly on what will not fix
 * itself: a wrong secret or crew key, a route that is not there, a wall of
 * 5xx. The dry-run poster records instead of sending, so the plan can be
 * checked without a server.
 *
 * Nothing in here writes to the database. That is the point of the
 * simulator: what the pages show after a run is what they would show on
 * race day, because the data went in through the same doors.
 */

import type { DeviceSource, HandoffDto, HandoffRequest } from "../../src/lib/tracker/types";

/** Traccar reports speed in knots (research/traccar.md); 1 kn = 0.514444 m/s. */
const KNOT_MPS = 0.514444;

export interface FixDelivery {
  kind: "fix";
  source: DeviceSource;
  externalId: string;
  fixTimeMs: number;
  lat: number;
  lon: number;
  accuracyM: number;
  speedMps: number;
  batteryPct: number;
  altitudeM: number;
  /** Where along the route the sim put this fix — for the log only, never sent. */
  routeM: number;
  /** "A · A3 runner", "B van", "A · A1 in van" — for the log and the dry run. */
  label: string;
}

export interface HandoffDelivery {
  kind: "handoff";
  entryShort: string;
  legNo: number;
  /** When the tap happened on the sim clock (the true instant, before any skew). */
  tapMs: number;
  req: HandoffRequest;
  label: string;
}

export type Delivery = FixDelivery | HandoffDelivery;

/** Thrown for failures that retrying cannot cure; main prints it and exits 2. */
export class SimFatal extends Error {
  body?: string;
  constructor(message: string, body?: string) {
    super(message);
    this.body = body;
  }
}

/** Outcome counts, overall and since the last status line. */
export class Tally {
  readonly total = new Map<string, number>();
  private delta = new Map<string, number>();
  add(key: string, n = 1): void {
    this.total.set(key, (this.total.get(key) ?? 0) + n);
    this.delta.set(key, (this.delta.get(key) ?? 0) + n);
  }
  /** The counts since the previous call, formatted; resets the delta. */
  flushDelta(): string {
    const s = Tally.format(this.delta);
    this.delta = new Map();
    return s || "—";
  }
  static format(m: Map<string, number>): string {
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v.toLocaleString("en-US")}`)
      .join(" · ");
  }
}

export interface PosterOptions {
  base: string;
  slug: string;
  secret: string;
  crewKey: string;
  dupes: boolean;
  /** Milliseconds the crew phone's clock is off (--skew); applied to client_now at send time. */
  skewMs: number;
  dryRun: boolean;
  /** Consecutive hard failures before giving up (default 8). */
  maxConsecutiveFailures?: number;
}

export function traccarBody(f: FixDelivery): unknown {
  const iso = new Date(f.fixTimeMs).toISOString();
  return {
    position: {
      protocol: "osmand",
      fixTime: iso,
      deviceTime: iso,
      serverTime: new Date().toISOString(),
      latitude: round(f.lat, 6),
      longitude: round(f.lon, 6),
      altitude: round(f.altitudeM, 1),
      speed: round(f.speedMps / KNOT_MPS, 2),
      course: 0,
      accuracy: round(f.accuracyM, 1),
      valid: true,
      attributes: { batteryLevel: Math.round(f.batteryPct) },
    },
    device: { uniqueId: f.externalId, name: f.externalId },
  };
}

export function webFix(f: FixDelivery): unknown {
  return {
    fix_time: new Date(f.fixTimeMs).toISOString(),
    lat: round(f.lat, 6),
    lon: round(f.lon, 6),
    accuracy_m: round(f.accuracyM, 1),
    speed_mps: round(f.speedMps, 2),
    battery_pct: Math.round(f.batteryPct),
    altitude_m: round(f.altitudeM, 1),
  };
}

function round(n: number, d: number): number {
  const k = 10 ** d;
  return Math.round(n * k) / k;
}

type Outcome = { ok?: boolean; stored?: boolean; reason?: string };

export class Poster {
  readonly tally = new Tally();
  /** Dry run: what would have gone out (fixes capped at 20, every handoff). */
  readonly recorded = { fixes: [] as FixDelivery[], handoffs: [] as HandoffDelivery[], fixCount: 0 };
  private consecutive = 0;
  private readonly maxFail: number;

  constructor(private readonly o: PosterOptions) {
    this.maxFail = o.maxConsecutiveFailures ?? 8;
  }

  /**
   * Send a batch. Deliveries are grouped per device (or per tap) and the
   * groups go out in parallel, while each group keeps its order — a phone
   * uploading a buffered burst sends oldest first, one request at a time.
   */
  async send(items: Delivery[]): Promise<void> {
    if (items.length === 0) return;
    if (this.o.dryRun) {
      for (const d of items) {
        if (d.kind === "fix") {
          this.recorded.fixCount++;
          if (this.recorded.fixes.length < 20) this.recorded.fixes.push(d);
          this.tally.add("dry fix");
        } else {
          this.recorded.handoffs.push(d);
          this.tally.add("dry handoff");
        }
      }
      return;
    }
    const groups = new Map<string, Delivery[]>();
    for (const d of items) {
      const key = d.kind === "fix" ? `${d.source}:${d.externalId}` : `handoff:${d.req.client_event_id}`;
      const g = groups.get(key);
      if (g) g.push(d);
      else groups.set(key, [d]);
    }
    await Promise.all([...groups.values()].map((g) => this.sendGroup(g)));
  }

  private async sendGroup(g: Delivery[]): Promise<void> {
    const first = g[0];
    if (first.kind === "handoff") {
      for (const d of g) await this.postHandoff(d as HandoffDelivery);
      return;
    }
    const fixes = g as FixDelivery[];
    switch (first.source) {
      case "traccar":
        for (const f of fixes) await this.postTraccar(f);
        return;
      case "web":
        await this.postWeb(fixes);
        return;
      default:
        // No satellite/manual adapter in v1 (spec §8): say so instead of pretending.
        this.tally.add(`skipped (${first.source}: no adapter yet)`, fixes.length);
    }
  }

  private async postTraccar(f: FixDelivery): Promise<void> {
    const path = `/api/track/ingest/traccar/${encodeURIComponent(this.o.secret)}`;
    for (let i = 0; i < (this.o.dupes ? 2 : 1); i++) {
      const r = await this.post(path, traccarBody(f), `traccar ${f.externalId}`);
      if (r.ok) this.tallyOutcome(r.json as Outcome);
    }
  }

  private async postWeb(fixes: FixDelivery[]): Promise<void> {
    const path = `/api/track/${this.o.slug}/ingest/web?k=${encodeURIComponent(this.o.crewKey)}`;
    const body = { external_id: fixes[0].externalId, fixes: fixes.map(webFix) };
    for (let i = 0; i < (this.o.dupes ? 2 : 1); i++) {
      const r = await this.post(path, body, `web ${fixes[0].externalId} ×${fixes.length}`);
      if (!r.ok) continue;
      const results = (r.json as { results?: Outcome[] } | null)?.results;
      if (Array.isArray(results)) for (const o of results) this.tallyOutcome(o);
      else this.tally.add("web: no results[] in reply");
    }
  }

  private async postHandoff(d: HandoffDelivery): Promise<void> {
    const path = `/api/track/${this.o.slug}/handoffs?k=${encodeURIComponent(this.o.crewKey)}`;
    for (let i = 0; i < (this.o.dupes ? 2 : 1); i++) {
      // client_now is the WALL clock at send time (plus the simulated skew):
      // the server compares it with ITS clock, not with the sim's.
      d.req.client_now = new Date(Date.now() + this.o.skewMs).toISOString();
      const r = await this.post(path, d.req, `handoff ${d.label}`);
      if (!r.ok) continue;
      const dto = (r.json as { handoffs?: HandoffDto[] } | null)?.handoffs?.[0];
      this.tally.add("handoff ok");
      if (dto && Math.abs(Date.parse(dto.time) - d.tapMs) > 1000) this.tally.add("handoff time ≠ tap (skew not corrected?)");
      else if (dto && this.o.skewMs !== 0) this.tally.add("handoff skew corrected");
      // Pairs: the server must store the slot the tap named (1 when none was sent).
      if (dto && dto.slot !== (d.req.slot ?? 1)) this.tally.add("handoff slot ≠ sent");
    }
  }

  private tallyOutcome(o: Outcome | null): void {
    if (!o || typeof o !== "object") return this.tally.add("unparsable reply");
    if (o.ok === true) return this.tally.add(o.stored === false ? (o.reason ?? "not stored") : "stored");
    this.tally.add(`rejected: ${o.reason ?? "?"}`);
  }

  private async post(path: string, body: unknown, what: string): Promise<{ ok: boolean; status: number; json: unknown }> {
    const url = this.o.base + path;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      this.failure(`${what}: ${(err as Error).message}`, undefined, "network error");
      return { ok: false, status: 0, json: null };
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON — kept as text for the error message */
    }
    if (res.status === 401 || res.status === 403) {
      throw new SimFatal(`${what} → ${res.status}: the server refused the secret / crew key (check TRACKER_TRACCAR_SECRET and the crew key)`, text);
    }
    if (res.status === 404) {
      throw new SimFatal(`${what} → 404 at ${url}: route not found (not built yet, or gated — the reset route is dev-only)`, text);
    }
    if (!res.ok) {
      this.failure(`${what} → HTTP ${res.status}`, text, `http ${res.status}`);
      return { ok: false, status: res.status, json };
    }
    this.consecutive = 0;
    return { ok: true, status: res.status, json };
  }

  private failure(msg: string, body: string | undefined, key: string): void {
    this.consecutive++;
    this.tally.add(key);
    const short = body ? body.slice(0, 300).replace(/\s+/g, " ") : "";
    console.error(`  ! ${msg}${short ? ` — ${short}` : ""}`);
    if (this.consecutive >= this.maxFail) {
      throw new SimFatal(`${this.consecutive} HTTP failures in a row; giving up. Last: ${msg}`, body);
    }
  }

  /** --reset: clear the event's positions, handoffs and snapshot (dev only). */
  async reset(): Promise<string> {
    const path = `/api/track/${this.o.slug}/reset?k=${encodeURIComponent(this.o.crewKey)}`;
    if (this.o.dryRun) return `would POST ${path}`;
    const r = await this.post(path, {}, "reset");
    if (!r.ok) throw new SimFatal(`reset failed (HTTP ${r.status})`);
    return `POST ${path} → ${JSON.stringify(r.json)}`;
  }
}
