"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RelayNav } from "./RelayNav";
import type { RelayData } from "@/lib/relay";
import {
  parseGpxActivity,
  parseGpxWaypoints,
  decimatePoints,
  type GpxActivity,
} from "@/lib/gpx";
import { RelayMap } from "./RelayMap";
import { fmtDuration, fmtFeet, fmtMiles } from "./format";

/**
 * The owner's road console for the relay tracker. One column, big touch
 * targets — it will be used on a phone, on a bike, in France.
 *
 * Segment flow: pick a .gpx → parsed IN THE BROWSER (DOMParser; the server
 * never sees raw XML) → preview distance/gain/moving time → tag the runner
 * (or mark it planned) → upload. The GPX is decimated to ≤1500 points before
 * posting so payloads stay small on hotel wifi.
 */
export function RelayManageClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<RelayData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/relay/${encodeURIComponent(eventId)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as RelayData);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [eventId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function postTo(
    endpoint: "admin" | "simulate",
    payload: Record<string, unknown>
  ): Promise<{ ok: boolean; data?: Record<string, unknown> }> {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/relay/${encodeURIComponent(eventId)}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      await refresh();
      return { ok: true, data: j };
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }
  const post = (payload: Record<string, unknown>) => postTo("admin", payload).then((r) => r.ok);

  /* ---- Demo / simulation (test TSP without real GPX) ---- */
  const [startLat, setStartLat] = useState("45.9219");
  const [startLng, setStartLng] = useState("6.8720");
  const [endLat, setEndLat] = useState("43.2616");
  const [endLng, setEndLng] = useState("5.3745");
  const [simFraction, setSimFraction] = useState("0.5");

  async function drawPlannedRoute() {
    const s: [number, number] = [Number(startLat), Number(startLng)];
    const e: [number, number] = [Number(endLat), Number(endLng)];
    if (![...s, ...e].every(Number.isFinite)) {
      setErr("Enter valid start/end coordinates.");
      return;
    }
    // Route through any waypoints already placed, in order.
    const mid = (data?.waypoints ?? []).map((w) => [w.lat, w.lng] as [number, number]);
    const res = await postTo("simulate", { action: "planRoute", waypoints: [s, ...mid, e] });
    if (res.ok) {
      const src = res.data?.source === "brouter" ? "foot-routed" : "straight-line (routing unavailable)";
      setNotice(`Planned route drawn — ${res.data?.distanceMi} mi (${src})`);
      setTimeout(() => setNotice(null), 4000);
    }
  }
  async function simulateLegs() {
    const res = await postTo("simulate", {
      action: "simulate",
      fraction: Number(simFraction) || 0.5,
      reset: true,
    });
    if (res.ok) {
      setNotice(`Simulated ${res.data?.legs} legs · ${res.data?.coveredMi} mi — see /tsp`);
      setTimeout(() => setNotice(null), 4000);
    }
  }

  /** One-click: load the bundled Chamonix→Marseille composite GPX as the planned
   *  route + its named waypoints. Parses in the browser, posts the distilled
   *  track (planned segment) and each <wpt> (waypoint). */
  async function loadSampleRoute() {
    setBusy(true);
    setErr(null);
    try {
      const xml = await fetch("/gpx/tsp-chx-composite.gpx", { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`sample GPX ${r.status}`);
        return r.text();
      });
      const track = parseGpxActivity(xml);
      const wpts = parseGpxWaypoints(xml);
      if (!track) throw new Error("Couldn't parse the sample route.");
      // Planned route from the track.
      const okSeg = await post({
        action: "addSegment",
        name: "Chamonix → Marseille (planned)",
        kind: "planned",
        points: decimatePoints(track.points).map((p) => [p.lat, p.lng, p.ele]),
        distanceM: track.distanceM,
        gainM: track.gainM,
      });
      if (!okSeg) return;
      // Named waypoints.
      for (const w of wpts) {
        await post({ action: "addWaypoint", name: w.name, lat: w.lat, lng: w.lng });
      }
      setNotice(`Loaded planned route + ${wpts.length} waypoints — see /tsp`);
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /* ---- Segment upload state ---- */
  const fileRef = useRef<HTMLInputElement>(null);
  const [gpx, setGpx] = useState<GpxActivity | null>(null);
  const [segName, setSegName] = useState("");
  const [segKind, setSegKind] = useState<"completed" | "planned">("completed");
  const [segRunnerId, setSegRunnerId] = useState<string>("");

  async function onPickFile(f: File | null) {
    setGpx(null);
    if (!f) return;
    const xml = await f.text();
    const parsed = parseGpxActivity(xml);
    if (!parsed) {
      setErr("Couldn't read that GPX — no trackpoints found.");
      return;
    }
    setErr(null);
    setGpx(parsed);
    setSegName(f.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " ").trim());
    // No timestamps usually means it's a drawn/planned route — preselect.
    setSegKind(parsed.movingTimeSec === null ? "planned" : "completed");
  }

  async function uploadSegment() {
    if (!gpx) return;
    const ok = await post({
      action: "addSegment",
      name: segName,
      kind: segKind,
      runnerId: segKind === "completed" ? segRunnerId || null : null,
      points: decimatePoints(gpx.points).map((p) => [p.lat, p.lng, p.ele]),
      distanceM: gpx.distanceM,
      gainM: gpx.gainM,
      movingTimeSec: gpx.movingTimeSec,
      startedAt: gpx.startedAt?.toISOString() ?? null,
      endedAt: gpx.endedAt?.toISOString() ?? null,
    });
    if (ok) {
      setGpx(null);
      setSegName("");
      if (fileRef.current) fileRef.current.value = "";
      setNotice(segKind === "completed" ? "Segment is live on /tsp 🎉" : "Planned section added");
      setTimeout(() => setNotice(null), 3000);
    }
  }

  /* ---- Runner form ---- */
  const [runnerName, setRunnerName] = useState("");
  const [runnerColor, setRunnerColor] = useState("#c8401a");

  /* ---- Waypoint form (click map to place) ---- */
  const [wpName, setWpName] = useState("");
  const [wpPos, setWpPos] = useState<{ lat: number; lng: number } | null>(null);

  const label: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: "var(--muted)",
    display: "block",
    marginBottom: 6,
  };
  const section: React.CSSProperties = { marginTop: 28 };

  return (
    <main className="screen" style={{ padding: "36px 20px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 28, color: "var(--ink)" }}>
            TSP tracker — manage
          </h1>
          <RelayNav current="manage" isOwner dark={false} />
        </div>

        {err && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: "10px 14px",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--accent)",
              fontSize: 13,
              background: "rgba(200,64,26,.06)",
            }}
          >
            {err}
          </div>
        )}
        {notice && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              border: "1px solid var(--green)",
              borderRadius: 6,
              color: "var(--green)",
              fontSize: 13,
              background: "var(--green-bg)",
            }}
          >
            {notice}
          </div>
        )}

        {/* ---- Demo & simulation — build/test without real GPX ---- */}
        <section className="card" style={{ ...section, padding: 20 }}>
          <div style={label}>Demo &amp; simulation (test without GPX)</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
            Seed the team, draw a foot route between two points, then fill in simulated legs.
          </div>
          <div style={{ marginBottom: 14 }}>
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void loadSampleRoute()}>
              ⚑ Load Chamonix → Marseille sample (route + waypoints)
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: "1 1 130px" }}>
              <label style={label} htmlFor="s-lat">Start lat, lng</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input id="s-lat" className="input" value={startLat} onChange={(e) => setStartLat(e.target.value)} />
                <input className="input" value={startLng} onChange={(e) => setStartLng(e.target.value)} aria-label="Start lng" />
              </div>
            </div>
            <div style={{ flex: "1 1 130px" }}>
              <label style={label} htmlFor="e-lat">End lat, lng</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input id="e-lat" className="input" value={endLat} onChange={(e) => setEndLat(e.target.value)} />
                <input className="input" value={endLng} onChange={(e) => setEndLng(e.target.value)} aria-label="End lng" />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void post({ action: "addRunner", name: `Runner ${(data?.runners.length ?? 0) + 1}`, color: "#2f6fb3" })}>
              + runner
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void postTo("simulate", { action: "seedTeam", count: 8 })}
            >
              Seed 8 runners
            </button>
            <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => void drawPlannedRoute()}>
              Draw planned route
            </button>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...label, margin: 0 }} htmlFor="sim-frac">Cover</label>
              <input
                id="sim-frac"
                className="input"
                value={simFraction}
                onChange={(e) => setSimFraction(e.target.value)}
                style={{ width: 58 }}
                inputMode="decimal"
              />
              <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => void simulateLegs()}>
                Simulate legs
              </button>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => {
                if (confirm("Delete ALL segments (planned + completed)?")) {
                  void postTo("simulate", { action: "clearAll" });
                }
              }}
            >
              Clear all segments
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            Cover = fraction of the planned route to fill with simulated running (0.5 = halfway).
          </div>
        </section>

        {/* ---- Upload a segment — the main road action ---- */}
        <section className="card" style={{ ...section, padding: 20 }}>
          <div style={label}>Upload a segment (GPX)</div>
          <input
            ref={fileRef}
            type="file"
            accept=".gpx,application/gpx+xml"
            onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", width: "100%", fontSize: 14 }}
          />
          {gpx && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--ink)",
                  background: "var(--cream)",
                  borderRadius: 6,
                  padding: "10px 12px",
                }}
              >
                {fmtMiles(gpx.distanceM)} · {fmtFeet(gpx.gainM)} gain ·{" "}
                {gpx.movingTimeSec !== null ? `${fmtDuration(gpx.movingTimeSec)} moving` : "no timestamps"} ·{" "}
                {gpx.points.length.toLocaleString()} pts
              </div>
              <div>
                <label style={label} htmlFor="seg-name">Name</label>
                <input
                  id="seg-name"
                  className="input"
                  value={segName}
                  onChange={(e) => setSegName(e.target.value)}
                  placeholder="e.g. Day 3 — into Lyon"
                />
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <label style={label} htmlFor="seg-kind">Type</label>
                  <select
                    id="seg-kind"
                    className="input"
                    value={segKind}
                    onChange={(e) => setSegKind(e.target.value as "completed" | "planned")}
                  >
                    <option value="completed">Completed leg</option>
                    <option value="planned">Planned section</option>
                  </select>
                </div>
                {segKind === "completed" && (
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={label} htmlFor="seg-runner">Who ran it</label>
                    <select
                      id="seg-runner"
                      className="input"
                      value={segRunnerId}
                      onChange={(e) => setSegRunnerId(e.target.value)}
                    >
                      <option value="">— unassigned —</option>
                      {(data?.runners ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button
                className="btn btn--primary btn--lg"
                onClick={() => void uploadSegment()}
                disabled={busy}
                style={{ justifyContent: "center" }}
              >
                {busy ? "Uploading…" : segKind === "completed" ? "Publish segment" : "Add planned section"}
              </button>
            </div>
          )}
        </section>

        {/* ---- Runners ---- */}
        <section className="card" style={{ ...section, padding: 20 }}>
          <div style={label}>Runners</div>
          {(data?.runners ?? []).map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 999, background: r.color }} />
              <span style={{ flex: 1, fontSize: 15, color: "var(--ink)" }}>
                {r.name}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}
                  >
                    ↗
                  </a>
                )}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                {fmtMiles(r.distanceM)}
              </span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busy}
                title="Link this runner's Instagram (or any URL) — their name links out on the tracker"
                onClick={() => {
                  const v = prompt(
                    `Instagram handle or URL for ${r.name} (empty clears):`,
                    r.url ?? ""
                  );
                  if (v !== null) void post({ action: "updateRunner", id: r.id, url: v });
                }}
              >
                🔗
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remove ${r.name}? Their segments stay on the map, unassigned.`)) {
                    void post({ action: "deleteRunner", id: r.id });
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <input
              className="input"
              placeholder="Runner name"
              value={runnerName}
              onChange={(e) => setRunnerName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="color"
              aria-label="Runner color"
              value={runnerColor}
              onChange={(e) => setRunnerColor(e.target.value)}
              style={{ width: 44, height: 38, border: "1px solid var(--line)", borderRadius: 6, padding: 2, background: "var(--surface)" }}
            />
            <button
              className="btn btn--primary"
              disabled={busy || !runnerName.trim()}
              onClick={async () => {
                if (await post({ action: "addRunner", name: runnerName, color: runnerColor })) {
                  setRunnerName("");
                }
              }}
            >
              Add
            </button>
          </div>
        </section>

        {/* ---- Waypoints — tap the map to place ---- */}
        <section className="card" style={{ ...section, padding: 20 }}>
          <div style={label}>Waypoints (tap the map to place, then name it)</div>
          {data && (
            <RelayMap
              data={data}
              height={320}
              onMapClick={(lat, lng) => setWpPos({ lat, lng })}
            />
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder="Waypoint name (e.g. Lyon)"
              value={wpName}
              onChange={(e) => setWpName(e.target.value)}
              style={{ flex: "1 1 200px" }}
            />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", minWidth: 130 }}>
              {wpPos ? `${wpPos.lat.toFixed(4)}, ${wpPos.lng.toFixed(4)}` : "tap map…"}
            </span>
            <button
              className="btn btn--primary"
              disabled={busy || !wpName.trim() || !wpPos}
              onClick={async () => {
                if (
                  wpPos &&
                  (await post({ action: "addWaypoint", name: wpName, lat: wpPos.lat, lng: wpPos.lng }))
                ) {
                  setWpName("");
                  setWpPos(null);
                }
              }}
            >
              Add
            </button>
          </div>
          {(data?.waypoints ?? []).map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ flex: 1, fontSize: 15, color: "var(--ink)" }}>{w.name}</span>
              <button
                className="btn btn--ghost btn--sm"
                disabled={busy}
                onClick={() => void post({ action: "deleteWaypoint", id: w.id })}
              >
                ✕
              </button>
            </div>
          ))}
        </section>

        {/* ---- Segments ---- */}
        <section className="card" style={{ ...section, padding: 20 }}>
          <div style={label}>Segments</div>
          {(data?.segments ?? []).length === 0 && (
            <div style={{ fontSize: 14, color: "var(--muted)" }}>None yet.</div>
          )}
          {(data?.segments ?? []).map((s) => {
            const runner = data?.runners.find((r) => r.id === s.runnerId);
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: s.kind === "planned" ? "var(--muted)" : "var(--green)",
                    minWidth: 74,
                  }}
                >
                  {s.kind}
                </span>
                <span style={{ flex: 1, fontSize: 14, color: "var(--ink)" }}>
                  {s.name ?? "Untitled"}
                  {runner ? ` · ${runner.name}` : ""}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                  {fmtMiles(s.distanceM)}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Delete "${s.name ?? "this segment"}"?`)) {
                      void post({ action: "deleteSegment", id: s.id });
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
