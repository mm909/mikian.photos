"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INGEST_RULES, type IngestOutcome } from "@/lib/tracker/types";
import type { ClientShell } from "@/lib/tracker/eventData";
import { fmtAgo, fmtIn } from "@/lib/tracker/format";
import { haversineM } from "@/lib/tracker/routeIndex";
import { useOfflineQueue, useOnline, type SendItem } from "../../offlineQueue";
import { useServiceWorker } from "../../useServiceWorker";
import { HttpError, OnlinePill, TrackHeader, apiUrl, keyedStatusMessage, useStoredChoice, useTick } from "../crew/ui";

/**
 * The van page (TRACKER_SPEC.md §11 Van): the support van's phone becomes
 * the entry's fallback position source. navigator.geolocation.watchPosition
 * at the highest accuracy, fixes thinned to one per 10 s or 20 m of
 * movement (THIN_*), queued (offlineQueue.ts) and posted in batches to the
 * web adapter at most every 10 s, a Screen Wake Lock so the screen stays
 * on — and the one rule said plainly on screen, because a browser tab
 * cannot track from the background: keep this page open and the screen on.
 *
 * WHICH DEVICE (owner, 2026-10-15, "the van with the screen off"): an entry
 * may have several vehicle devices — LASD26 has the van phone on Traccar
 * Client (source traccar, "lasd26-van") AND this page's own device (source
 * web, "lasd26-van-web"). Only a WEB device can be driven from here: a
 * traccar vehicle device IS the app on the van phone, reporting on its
 * own. So the page lists every vehicle device, offers only the web ones to
 * broadcast from, and says so: the van phone can run Traccar Client
 * instead — then this page is not needed.
 */

interface Fix {
  fix_time: string;
  lat: number;
  lon: number;
  accuracy_m?: number;
  speed_mps?: number;
  battery_pct?: number;
  altitude_m?: number;
}

interface LastFix {
  at: number;
  fixTime: string;
  accuracyM: number;
  speedMps: number | null;
  lat: number;
  lon: number;
}

type LockState = "off" | "on" | "unsupported" | "denied";

const SEND_EVERY_MS = 10_000;
/**
 * Client-side thinning. watchPosition reports ≈ 1 Hz while moving; the
 * review found that "the server then stores ~86k van rows over a long day".
 * A fix is queued only when ≥ THIN_MIN_MS have passed OR the phone moved
 * ≥ THIN_MIN_M since the last fix QUEUED (not the last fix taken), plus
 * always the first fix after START. The accuracy filter still runs first.
 */
const THIN_MIN_MS = 10_000;
const THIN_MIN_M = 20;
/** Fixes per POST — small enough that one batch clears the queue's 15 s send timeout on a poor link. */
const BATCH_MAX = 200;

export function VanApp({ shell, crewKey, admin }: { shell: ClientShell; crewKey: string; admin: boolean }) {
  const slug = shell.id;
  const online = useOnline();
  useServiceWorker();
  const now = useTick(1000);

  /* Every vehicle device of every entry … */
  const vehicles = useMemo(
    () =>
      shell.entries.flatMap((e) =>
        e.vehicleDevices.map((d) => ({
          key: `${d.source}:${d.externalId}`,
          entry: e,
          device: d,
        })),
      ),
    [shell.entries],
  );
  /* … but only the WEB ones can be driven from this page (see the header). */
  const vans = useMemo(() => vehicles.filter((v) => v.device.source === "web"), [vehicles]);
  const appVans = useMemo(() => vehicles.filter((v) => v.device.source !== "web"), [vehicles]);
  const [vanKey, setVanKey, vanLoaded] = useStoredChoice(`trk:van:${slug}`);
  const van = useMemo(() => {
    if (vans.length === 1) return vans[0];
    return vans.find((v) => v.key === vanKey) ?? null;
  }, [vans, vanKey]);

  /* Battery, where the browser tells us (Chrome/Android; not Safari). */
  const batteryRef = useRef<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  useEffect(() => {
    type BatteryLike = { level: number; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (typeof nav.getBattery !== "function") return;
    let b: BatteryLike | null = null;
    const update = () => {
      if (!b) return;
      const pct = Math.round(b.level * 100);
      batteryRef.current = pct;
      setBattery(pct);
    };
    nav
      .getBattery()
      .then((bat) => {
        b = bat;
        update();
        bat.addEventListener("levelchange", update);
      })
      .catch(() => {});
    return () => {
      if (b) b.removeEventListener("levelchange", update);
    };
  }, []);

  /* The queue → POST /api/track/<slug>/ingest/web {external_id, fixes}. */
  const [sentCount, setSentCount] = useState(0);
  const [serverNote, setServerNote] = useState<string | null>(null);
  const externalId = van?.device.externalId ?? null;
  const send = useCallback(
    async (items: SendItem<Fix>[], signal: AbortSignal): Promise<string[]> => {
      if (!externalId) throw new Error("Choose which van this is first");
      const res = await fetch(apiUrl(slug, "ingest/web", crewKey), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ external_id: externalId, fixes: items.map((i) => i.item) }),
        cache: "no-store",
        // The queue's 15 s timeout and its resend-on-force both end the
        // request through this signal (offlineQueue.ts).
        signal,
      });
      if (res.status === 400 || res.status === 422) {
        // The batch itself was malformed: nothing a retry fixes. Drop it, say so.
        setServerNote(`The server refused a batch of ${items.length} fixes (HTTP ${res.status}).`);
        return items.map((i) => i.id);
      }
      if (!res.ok) throw new HttpError(res.status, keyedStatusMessage(res.status));
      const data = (await res.json()) as { ok?: boolean; results?: IngestOutcome[] };
      const results = data.results ?? [];
      let stored = 0;
      const refused = new Map<string, number>();
      for (const r of results) {
        if (r.ok && r.stored) stored += 1;
        else if (!r.ok) refused.set(r.reason, (refused.get(r.reason) ?? 0) + 1);
      }
      setSentCount((n) => n + stored);
      if (refused.has("unknown_device")) {
        setServerNote(`The server does not know this van's device (${externalId}). Ask the owner to run the event sync.`);
      } else if (refused.has("archived_event")) {
        setServerNote("This event is archived on the server; fixes are being dropped.");
      } else if (refused.size) {
        setServerNote(`Some fixes were refused: ${Array.from(refused, ([k, n]) => `${k} ×${n}`).join(", ")}.`);
      } else {
        setServerNote(null);
      }
      // Delivered is delivered — duplicates and refusals alike leave the queue.
      return items.map((i) => i.id);
    },
    [slug, crewKey, externalId],
  );
  const q = useOfflineQueue<Fix>(`fixes:${slug}:${externalId ?? "none"}`, send, { minIntervalMs: SEND_EVERY_MS, batchMax: BATCH_MAX });

  /* Geolocation */
  const [running, setRunning] = useState(false);
  const watchId = useRef<number | null>(null);
  const [last, setLast] = useState<LastFix | null>(null);
  const [fixCount, setFixCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [geoError, setGeoError] = useState<{ code: number; message: string } | null>(null);
  const [secure, setSecure] = useState(true);
  useEffect(() => setSecure(window.isSecureContext), []);
  /** The last fix that went into the queue — null until the first one after START. */
  const lastQueued = useRef<{ at: number; lat: number; lon: number } | null>(null);

  const onFix = useCallback(
    (pos: GeolocationPosition) => {
      const c = pos.coords;
      const fixTime = new Date(pos.timestamp).toISOString();
      setLast({ at: Date.now(), fixTime, accuracyM: c.accuracy, speedMps: c.speed, lat: c.latitude, lon: c.longitude });
      setFixCount((n) => n + 1);
      setGeoError(null);
      if (!Number.isFinite(c.accuracy) || c.accuracy > INGEST_RULES.maxAccuracyM) {
        // The server would drop it (§8 rule 4); do not spend the upload.
        setSkipped((n) => n + 1);
        return;
      }
      // Thinning, against the last fix QUEUED: a van parked at an exchange
      // for 40 minutes sends 240 fixes, not 2400; a moving one still sends
      // every 20 m. Measured on the device clock (pos.timestamp), the same
      // clock the fix_time carries.
      const prev = lastQueued.current;
      if (prev && pos.timestamp - prev.at < THIN_MIN_MS && haversineM(prev.lat, prev.lon, c.latitude, c.longitude) < THIN_MIN_M) return;
      lastQueued.current = { at: pos.timestamp, lat: c.latitude, lon: c.longitude };
      setQueuedCount((n) => n + 1);
      const fix: Fix = {
        fix_time: fixTime,
        lat: c.latitude,
        lon: c.longitude,
        accuracy_m: Math.round(c.accuracy),
        speed_mps: c.speed === null || !Number.isFinite(c.speed) || c.speed < 0 ? undefined : Math.round(c.speed * 100) / 100,
        altitude_m: c.altitude === null || !Number.isFinite(c.altitude) ? undefined : Math.round(c.altitude),
        battery_pct: batteryRef.current ?? undefined,
      };
      // Deterministic id: the same fix reported twice is one row in the queue.
      void q.enqueue(fix, `${externalId}:${fixTime}`);
    },
    [q, externalId],
  );

  const onGeoError = useCallback((err: GeolocationPositionError) => {
    setGeoError({ code: err.code, message: err.message });
  }, []);

  /* Wake lock */
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const [lock, setLock] = useState<LockState>("off");
  const acquireLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      setLock("unsupported");
      return;
    }
    if (lockRef.current) return;
    try {
      const s = await navigator.wakeLock.request("screen");
      lockRef.current = s;
      setLock("on");
      s.addEventListener("release", () => {
        lockRef.current = null;
        setLock((l) => (l === "on" ? "off" : l));
      });
    } catch {
      setLock("denied");
    }
  }, []);
  const releaseLock = useCallback(async () => {
    const s = lockRef.current;
    lockRef.current = null;
    if (s) {
      try {
        await s.release();
      } catch {
        /* already released */
      }
    }
    setLock((l) => (l === "on" ? "off" : l));
  }, []);

  const runningRef = useRef(false);
  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError({ code: 0, message: "This browser has no location support." });
      return;
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    // The first fix after START always goes, however close to the last one.
    lastQueued.current = null;
    watchId.current = navigator.geolocation.watchPosition(onFix, onGeoError, { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 });
    runningRef.current = true;
    setRunning(true);
    void acquireLock();
  }, [onFix, onGeoError, acquireLock]);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    runningRef.current = false;
    setRunning(false);
    void releaseLock();
    void q.flush();
  }, [releaseLock, q]);

  // The browser drops the lock when the tab is hidden; take it back when we are shown again.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && runningRef.current && !lockRef.current) void acquireLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [acquireLock]);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      void lockRef.current?.release().catch(() => {});
    },
    [],
  );

  const ageS = last && now ? Math.max(0, (now - last.at) / 1000) : null;
  const ageClass = ageS === null ? "" : ageS < 60 ? "ok" : ageS < 180 ? "warn" : "bad";
  const accClass = !last ? "" : last.accuracyM <= 30 ? "ok" : last.accuracyM <= INGEST_RULES.maxAccuracyM ? "warn" : "bad";
  const speedText =
    last && last.speedMps !== null && Number.isFinite(last.speedMps) && last.speedMps >= 0
      ? shell.units === "imperial"
        ? `${(last.speedMps * 2.23694).toFixed(0)}`
        : `${(last.speedMps * 3.6).toFixed(0)}`
      : "—";
  const speedUnit = shell.units === "imperial" ? "mph" : "km/h";
  const retryIn = q.nextRetryAt && now ? Math.max(0, Math.round((q.nextRetryAt - now) / 1000)) : null;

  const entryStyle = van ? ({ "--entry": van.entry.color } as React.CSSProperties) : undefined;

  /* The entry's vehicle devices, every source, with what each one is. */
  const deviceList = vehicles.length > 0 && (
    <section className="c-section">
      <div className="c-h">
        <span className="mono">Vehicle devices</span>
        <span className="mono">{vehicles.length === 1 ? "1 device" : `${vehicles.length} devices`}</span>
      </div>
      <div className="c-settings">
        {vehicles.map((v) => {
          const web = v.device.source === "web";
          const active = web && van?.key === v.key;
          return (
            <div className="c-kv" key={v.key} style={{ "--entry": v.entry.color } as React.CSSProperties}>
              <span style={{ minWidth: 0 }}>
                <span className="c-code" style={{ fontSize: 16 }}>
                  {v.device.externalId}
                </span>
                <small style={{ display: "block", color: "var(--muted)", fontSize: 14, marginTop: 2 }}>
                  {shell.entries.length > 1 && <>{v.entry.name} · </>}
                  {web ? (active ? "this page, this phone" : "a web page like this one") : v.device.source === "traccar" ? "Traccar Client on the van phone — reports on its own" : `${v.device.source} tracker — reports on its own`}
                </small>
              </span>
              <b style={{ fontSize: 15, color: active ? "var(--ok)" : "var(--muted)" }}>{web ? (active ? "ACTIVE" : "WEB") : "APP"}</b>
            </div>
          );
        })}
      </div>
      <p className="c-sub" style={{ marginTop: 10 }}>
        The van phone can run Traccar Client instead — then this page is not needed. Both report as the van; the public page shows whichever spoke last.
      </p>
    </section>
  );

  return (
    <div className="c-page" style={entryStyle}>
      <TrackHeader
        kicker="Van · position"
        title={shell.name}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            {van && (
              <span className="c-teamchip">
                <span className="tag">{van.entry.shortName}</span>
              </span>
            )}
            <OnlinePill />
          </div>
        }
      />

      <main className="c-main">
        {!vanLoaded ? (
          <div className="c-section c-sub">…</div>
        ) : vehicles.length === 0 ? (
          <div className="c-section">
            <p className="c-lead">No van is set up for this event.</p>
            <p className="c-sub">
              Ask the owner to add a <span className="c-code" style={{ fontSize: 16 }}>vehicle_device</span> to each entry in{" "}
              <span className="c-code" style={{ fontSize: 16 }}>events/{slug}.yaml</span> and run the sync.
            </p>
          </div>
        ) : vans.length === 0 ? (
          <>
            <div className="c-section">
              <p className="c-lead">The van phone runs Traccar Client — there is nothing to start here.</p>
              <p className="c-sub">
                This event&rsquo;s {appVans.length === 1 ? "vehicle device is" : "vehicle devices are"} the app, not a web page. To use this page as a fallback, ask the owner to add a{" "}
                <span className="c-code" style={{ fontSize: 16 }}>source: web</span> vehicle device under <span className="c-code" style={{ fontSize: 16 }}>vehicle_devices</span> in{" "}
                <span className="c-code" style={{ fontSize: 16 }}>events/{slug}.yaml</span> and run the sync.
              </p>
            </div>
            {deviceList}
          </>
        ) : !van ? (
          <>
            <section className="c-section">
              <p className="c-lead">Which van is this phone in?</p>
              <div className="c-teams">
                {vans.map((v) => (
                  <button key={v.key} type="button" className="c-team" style={{ "--entry": v.entry.color } as React.CSSProperties} onClick={() => setVanKey(v.key)}>
                    <span className="dot">{v.entry.shortName}</span>
                    <span>
                      {v.entry.name}
                      <small>{v.device.externalId}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="c-sub" style={{ marginTop: 14 }}>
                Remembered on this phone. Only web devices are listed — a Traccar Client device is the app on the van phone, not this page.
              </p>
            </section>
            {deviceList}
          </>
        ) : (
          <>
            <section className="c-section">
              <div className="c-h">
                <span className="mono">
                  {van.entry.name} · {van.device.externalId}
                </span>
                {vans.length > 1 && !running && (
                  <button type="button" className="c-link" onClick={() => setVanKey(null)}>
                    Change van
                  </button>
                )}
              </div>
              {running ? (
                <button type="button" className="c-big stop" onClick={stop}>
                  STOP
                  <small>sharing this van&rsquo;s position</small>
                </button>
              ) : (
                <button type="button" className="c-big start" onClick={start} disabled={!secure}>
                  START
                  <small>share this van&rsquo;s position</small>
                </button>
              )}
              <div className="c-rule">
                <span aria-hidden="true" style={{ fontSize: 26 }}>
                  ☀
                </span>
                <span>Keep this page open and the screen on. A phone in a pocket with the screen off sends nothing.</span>
              </div>
            </section>

            {!secure && (
              <div className="c-err" role="alert">
                <b>Location needs a secure page.</b> Open this page over https (or on localhost); on a plain http address the browser refuses to share location.
              </div>
            )}

            {geoError && (
              <div className="c-err" role="alert">
                {geoError.code === 1 ? (
                  <>
                    <b>Location permission was denied.</b> The van cannot be tracked until it is allowed:
                    <ol>
                      <li>iPhone: Settings → Privacy &amp; Security → Location Services → Safari Websites → While Using the App, Precise on. Then reload this page.</li>
                      <li>Android (Chrome): tap the lock icon in the address bar → Permissions → Location → Allow. Then tap START again.</li>
                      <li>If a &ldquo;Share location?&rdquo; prompt appears, choose Allow.</li>
                    </ol>
                  </>
                ) : geoError.code === 2 ? (
                  <>
                    <b>No position available.</b> Location Services may be off for the whole phone, or the phone has no GPS fix yet. Check Settings and wait a minute.
                  </>
                ) : geoError.code === 3 ? (
                  <>
                    <b>Waiting for a GPS fix…</b> No position in the last 30 s. Keep the phone where it can see the sky.
                  </>
                ) : (
                  <>
                    <b>Location error.</b> {geoError.message}
                  </>
                )}
              </div>
            )}

            <section className="c-section">
              <div className="c-h">
                <span className="mono">Status</span>
                <span className={`c-pill ${lock === "on" ? "ok" : lock === "off" ? "" : "warn"}`} style={{ minHeight: 36 }}>
                  <i aria-hidden="true" /> Screen {lock === "on" ? "kept on" : lock === "unsupported" ? "lock unsupported — set Auto-Lock to Never" : lock === "denied" ? "lock refused — set Auto-Lock to Never" : "may turn off"}
                </span>
              </div>
              <div className="c-stats">
                <div className={`c-stat ${ageClass}`}>
                  <span className="mono k">Last fix</span>
                  <span className="v">{ageS === null ? "—" : fmtAgo(ageS)}</span>
                </div>
                <div className={`c-stat ${accClass}`}>
                  <span className="mono k">Accuracy</span>
                  <span className="v">
                    {last ? `±${Math.round(last.accuracyM)}` : "—"}
                    {last && <small>m</small>}
                  </span>
                </div>
                <div className="c-stat">
                  <span className="mono k">Speed</span>
                  <span className="v">
                    {speedText}
                    {speedText !== "—" && <small>{speedUnit}</small>}
                  </span>
                </div>
                <div className="c-stat">
                  <span className="mono k">Battery</span>
                  <span className="v">
                    {battery === null ? "—" : battery}
                    {battery !== null && <small>%</small>}
                  </span>
                </div>
                <div className={`c-stat ${q.pending.length > 0 && !online ? "warn" : ""}`}>
                  <span className="mono k">Waiting to send</span>
                  <span className="v">{q.pending.length}</span>
                </div>
                <div className="c-stat">
                  <span className="mono k">Sent</span>
                  <span className="v">{sentCount}</span>
                </div>
                <div className="c-stat">
                  <span className="mono k">Queued</span>
                  <span className="v">
                    {queuedCount}
                    <small>of {fixCount} fixes taken</small>
                  </span>
                </div>
                <div className={`c-stat ${skipped > 0 ? "warn" : ""}`}>
                  <span className="mono k">Too rough, skipped</span>
                  <span className="v">{skipped}</span>
                </div>
              </div>

              <p className="c-sub" style={{ marginTop: 12 }} aria-live="polite">
                {q.state === "sending"
                  ? "Sending…"
                  : q.pending.length === 0
                    ? running
                      ? "All fixes sent. One fix per 10 s or 20 m is kept; batches go every 10 seconds."
                      : "Stopped."
                    : !online
                      ? "No signal — fixes are saved here and go when it is back."
                      : q.lastError
                        ? `${q.lastError}${retryIn !== null ? ` · retry ${fmtIn(retryIn)}` : ""}`
                        : retryIn !== null
                          ? `Next batch ${fmtIn(retryIn)}`
                          : "Waiting"}
              </p>
              {q.lastError && q.attempt > 0 && (
                <div className="c-queue err" role="alert">
                  <div>
                    {q.pending.length} fix{q.pending.length === 1 ? "" : "es"} waiting
                    <small>{q.lastError}</small>
                  </div>
                  <button type="button" onClick={() => void q.flush()} disabled={q.state === "sending"}>
                    Retry now
                  </button>
                </div>
              )}
              {serverNote && (
                <div className="c-queue err" role="alert">
                  <div>{serverNote}</div>
                  <button type="button" onClick={() => setServerNote(null)}>
                    OK
                  </button>
                </div>
              )}
            </section>

            {deviceList}
          </>
        )}

        <footer className="c-foot">
          This phone stands in for the runner&rsquo;s when theirs goes quiet; the public page says &ldquo;showing support van&rdquo; when it does.
          {q.backend === "memory" && " (Private browsing: unsent fixes live only while this tab is open.)"}
          {admin && (
            <>
              {" "}
              <a href={`/track/${encodeURIComponent(slug)}`}>Public page →</a>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}
