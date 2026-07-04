"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RelayData, RelayWaypointDto } from "@/lib/relay";
import { RelayMap, type ExtraLine } from "./RelayMap";
import { RelayNav } from "./RelayNav";
import { fmtAgo, fmtEta, fmtFeet, fmtMiles } from "./format";
import { parseGpxActivity, decimatePoints } from "@/lib/gpx";
import { useMounted } from "./hooks";

/**
 * /tsp/plan — the route-planning console (owner-only).
 *
 * The plan is a chain of WAYPOINTS (town-to-town checkpoints, ~20 mi apart);
 * between each consecutive pair sits a SECTION with one of three states:
 *   ✓ passed     the team has already run through the far waypoint
 *   ● locked     a chosen foot route is saved for the pair (drawn amber)
 *   ◌ unplanned  no route picked yet (drawn as a faint straight dashed hint)
 *
 * Click the map to drop a new checkpoint. For any unplanned/locked section,
 * "Suggest routes" fetches up to 3 BRouter foot-route candidates (recommended
 * first — shortest with a climb penalty), previews them on the map in distinct
 * colors, and "Lock this route" saves the pick for that pair. Locked sections
 * feed the public tracker's planned line, waypoint ETAs, and totals.
 */

const CAND_COLORS = ["#f0b060", "#6fb3e8", "#b78ae8"];

type Candidate = {
  alt: number;
  source: "brouter" | "straight";
  distanceM: number;
  gainM: number;
  points: [number, number, number][];
  recommended: boolean;
};

type Section = {
  from: RelayWaypointDto;
  to: RelayWaypointDto;
  status: "passed" | "locked" | "unplanned";
  /** Locked segment id (for unlock) when status === "locked". */
  segmentId: string | null;
  distanceM: number;
  gainM: number | null; // null = unknown (straight-line estimate has no gain)
  estimated: boolean;
};

const R_EARTH = 6371000;
function havM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

export function RelayPlanClient({ eventId }: { eventId: string }) {
  const [data, setData] = useState<RelayData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const mounted = useMounted();

  // Waypoint placement (map click → inline form).
  const [wpPos, setWpPos] = useState<{ lat: number; lng: number } | null>(null);
  const [wpName, setWpName] = useState("");

  // GPX import (OnTheGoMap / any planner round-trip).
  const gpxInputRef = useRef<HTMLInputElement>(null);

  // "We know we want to hit this city next" — Nominatim place search.
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [citySearching, setCitySearching] = useState(false);

  // Candidate suggestion state: which section + the fetched candidates.
  const [suggestFor, setSuggestFor] = useState<{ fromId: string; toId: string } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<number>(0);

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

  async function post(
    endpoint: "admin" | "simulate",
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
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
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  /* ---- Section assembly -------------------------------------------------- */
  const sections: Section[] = useMemo(() => {
    if (!data) return [];
    const wps = [...data.waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    const locked = data.segments.filter(
      (s) => s.kind === "planned" && s.fromWaypointId && s.toWaypointId
    );
    const out: Section[] = [];
    for (let i = 0; i < wps.length - 1; i++) {
      const from = wps[i];
      const to = wps[i + 1];
      const seg = locked.find((s) => s.fromWaypointId === from.id && s.toWaypointId === to.id);
      // Unplanned estimate: straight line with a mild windiness factor.
      const straight = havM(from.lat, from.lng, to.lat, to.lng) * 1.25;
      out.push({
        from,
        to,
        status: to.passed ? "passed" : seg ? "locked" : "unplanned",
        segmentId: seg?.id ?? null,
        distanceM: seg ? seg.distanceM : straight,
        gainM: seg ? seg.gainM : null,
        estimated: !seg,
      });
    }
    return out;
  }, [data]);

  const planTotals = useMemo(() => {
    const distanceM = sections.reduce((a, s) => a + s.distanceM, 0);
    const gainM = sections.reduce((a, s) => a + (s.gainM ?? 0), 0);
    const lockedCount = sections.filter((s) => s.status === "locked").length;
    const unplanned = sections.filter((s) => s.status === "unplanned").length;
    return { distanceM, gainM, lockedCount, unplanned, total: sections.length };
  }, [sections]);

  /* ---- Map extras: unplanned hints + candidate previews ------------------ */
  const extras: ExtraLine[] = useMemo(() => {
    const out: ExtraLine[] = [];
    for (const s of sections) {
      if (s.status === "unplanned") {
        out.push({
          id: `hint-${s.from.id}`,
          points: [
            [s.from.lat, s.from.lng],
            [s.to.lat, s.to.lng],
          ],
          color: "#9a9186",
          weight: 2,
          opacity: 0.5,
          dash: "4 10",
          label: `${s.from.name} → ${s.to.name} · unplanned`,
        });
      }
    }
    candidates.forEach((c, i) => {
      out.push({
        id: `cand-${i}`,
        points: c.points,
        color: CAND_COLORS[i % CAND_COLORS.length],
        weight: i === picked ? 7 : 4,
        opacity: i === picked ? 1 : 0.65,
        label: `Option ${i + 1}${c.recommended ? " ★" : ""} · ${fmtMiles(c.distanceM)} · +${fmtFeet(c.gainM)}`,
      });
    });
    return out;
  }, [sections, candidates, picked]);

  /* ---- Actions ------------------------------------------------------------ */
  async function suggest(section: Section) {
    setCandidates([]);
    setPicked(0);
    setSuggestFor({ fromId: section.from.id, toId: section.to.id });
    const res = await post("simulate", {
      action: "routeSection",
      fromWaypointId: section.from.id,
      toWaypointId: section.to.id,
    });
    if (res && Array.isArray(res.candidates)) {
      const cands = res.candidates as Candidate[];
      setCandidates(cands);
      if (cands.some((c) => c.source === "straight")) {
        setNotice("Routing service unavailable — showing a straight-line estimate.");
        setTimeout(() => setNotice(null), 4000);
      }
    } else {
      setSuggestFor(null);
    }
  }

  async function lockPicked() {
    const c = candidates[picked];
    if (!c || !suggestFor) return;
    const res = await post("simulate", {
      action: "lockSection",
      fromWaypointId: suggestFor.fromId,
      toWaypointId: suggestFor.toId,
      points: c.points,
      distanceM: c.distanceM,
      gainM: c.gainM,
    });
    if (res) {
      setSuggestFor(null);
      setCandidates([]);
      setNotice("Section locked in — it's live on /tsp");
      setTimeout(() => setNotice(null), 3500);
      await refresh();
    }
  }

  async function unlock(section: Section) {
    if (!section.segmentId) return;
    if (!confirm(`Unlock ${section.from.name} → ${section.to.name}? The saved route is removed.`))
      return;
    if (await post("simulate", { action: "unlockSection", id: section.segmentId })) await refresh();
  }

  async function addWaypoint() {
    if (!wpPos || !wpName.trim()) return;
    if (
      await post("admin", {
        action: "addWaypoint",
        name: wpName.trim(),
        lat: wpPos.lat,
        lng: wpPos.lng,
      })
    ) {
      setWpPos(null);
      setWpName("");
      setCityResults([]);
      setMapKey((k) => k + 1); // refit so the new checkpoint is in view
      await refresh();
    }
  }

  /** Import a GPX (e.g. exported from OnTheGoMap) as a free-form PLANNED
   *  section — parsed in the browser, decimated, posted like the manage
   *  console's uploader. Completes the export → sketch → import round-trip. */
  async function importGpx(file: File) {
    const xml = await file.text();
    const track = parseGpxActivity(xml);
    if (!track) {
      setErr("Couldn't read that GPX — no trackpoints found.");
      return;
    }
    const ok = await post("admin", {
      action: "addSegment",
      name: file.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " ").trim() || "Imported plan",
      kind: "planned",
      points: decimatePoints(track.points).map((p) => [p.lat, p.lng, p.ele]),
      distanceM: track.distanceM,
      gainM: track.gainM,
    });
    if (ok) {
      setNotice(`Imported ${fmtMiles(track.distanceM)} of planned route`);
      setTimeout(() => setNotice(null), 3500);
      setMapKey((k) => k + 1); // remount so the map refits to the new plan
      await refresh();
    }
  }

  /** Find a city/town by name (Nominatim, biased to France) and prefill the
   *  add-checkpoint form with the pick. Free service, ~1 req/s — triggered
   *  only by an explicit button/Enter, never per keystroke. */
  async function searchCity() {
    const q = cityQuery.trim();
    if (!q) return;
    setCitySearching(true);
    setCityResults([]);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en` +
        `&countrycodes=fr&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as { display_name?: string; name?: string; lat: string; lon: string }[];
      setCityResults(
        rows
          .map((r) => ({
            name: r.name || (r.display_name ?? "").split(",")[0] || q,
            lat: Number(r.lat),
            lng: Number(r.lon),
          }))
          .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      );
    } catch (e) {
      setErr(`City search failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCitySearching(false);
    }
  }

  /** Google Maps directions deep link for a checkpoint (works in the app on
   *  phones — the crew's most common need: "navigate the van to the next CP"). */
  function directionsUrl(w: RelayWaypointDto): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}`;
  }
  async function copyCheckpointLink(w: RelayWaypointDto) {
    try {
      await navigator.clipboard.writeText(`${w.name} — https://maps.google.com/?q=${w.lat},${w.lng}`);
      setNotice(`Copied a maps link for ${w.name}`);
    } catch {
      setNotice(`Maps link: https://maps.google.com/?q=${w.lat},${w.lng}`);
    }
    setTimeout(() => setNotice(null), 3000);
  }

  /** Export the current plan (locked sections + checkpoints) as a GPX file —
   *  portable into OnTheGoMap / RideWithGPS / a watch. */
  function downloadPlanGpx() {
    if (!data) return;
    const planned = data.segments
      .filter((s) => s.kind === "planned" && s.points.length > 1)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const wpts = data.waypoints
      .map(
        (w) =>
          `  <wpt lat="${w.lat}" lon="${w.lng}"><name>${esc(w.name)}</name></wpt>`
      )
      .join("\n");
    const trksegs = planned
      .map(
        (s) =>
          `    <trkseg>\n${s.points
            .map((p) => `      <trkpt lat="${p[0]}" lon="${p[1]}"><ele>${p[2] ?? 0}</ele></trkpt>`)
            .join("\n")}\n    </trkseg>`
      )
      .join("\n");
    const gpx =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<gpx version="1.1" creator="DTK route planner" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `${wpts}\n  <trk><name>DTK plan</name>\n${trksegs}\n  </trk>\n</gpx>\n`;
    const blob = new Blob([gpx], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dtk-plan-${new Date().toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function deleteWaypoint(w: RelayWaypointDto) {
    if (!confirm(`Remove checkpoint "${w.name}"? Sections touching it lose their lock.`)) return;
    // Drop locks touching this waypoint first so no orphan sections remain.
    const touching = (data?.segments ?? []).filter(
      (s) => s.kind === "planned" && (s.fromWaypointId === w.id || s.toWaypointId === w.id)
    );
    for (const seg of touching) {
      await post("simulate", { action: "unlockSection", id: seg.id });
    }
    if (await post("admin", { action: "deleteWaypoint", id: w.id })) await refresh();
  }

  /* ---- Render ------------------------------------------------------------- */
  const mono: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: ".12em",
    textTransform: "uppercase",
  };
  const FG = "#f5f2ec";
  const MUTED = "#9a9186";
  const AMBER = "#f0b060";

  const statusChip: Record<Section["status"], { label: string; color: string }> = {
    passed: { label: "✓ passed", color: "#6fbf7a" },
    locked: { label: "● locked", color: AMBER },
    unplanned: { label: "◌ unplanned", color: MUTED },
  };

  return (
    <div style={{ background: "#14120f", minHeight: "100dvh", color: FG }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 24 }}>
            Plan the route
          </h1>
          <span style={{ ...mono, color: MUTED }}>
            {planTotals.lockedCount}/{planTotals.total} sections locked
            {mounted && data?.totals.lastUpdatedAt
              ? ` · updated ${fmtAgo(data.totals.lastUpdatedAt)}`
              : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <RelayNav current="plan" isOwner />
          <button
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() => {
              setMapKey((k) => k + 1);
              void refresh();
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Round-trip toolbar: export the plan, sketch anywhere (OnTheGoMap),
          import the GPX straight back here as a planned section. */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "0 18px 10px",
        }}
      >
        <button className="btn btn--ghost btn--sm" disabled={busy || !data} onClick={downloadPlanGpx}>
          ⇣ Export plan GPX
        </button>
        <button
          className="btn btn--ghost btn--sm"
          disabled={busy}
          onClick={() => gpxInputRef.current?.click()}
        >
          ⇡ Import GPX as planned section
        </button>
        <input
          ref={gpxInputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (f) void importGpx(f);
          }}
        />
        <a
          href="https://onthegomap.com/#/create"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...mono, color: MUTED, textDecoration: "none" }}
          title="Sketch a route there, export its GPX, and import it back here"
        >
          OnTheGoMap ↗
        </a>
        <details style={{ marginLeft: "auto" }}>
          <summary style={{ ...mono, color: MUTED, cursor: "pointer" }}>
            How to plan mid-race
          </summary>
          <ol
            style={{
              margin: "10px 0 0",
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.7,
              color: MUTED,
              maxWidth: 460,
            }}
          >
            <li>Find the next city below (or tap the map) → add it as a checkpoint.</li>
            <li>On its section, hit <em>Suggest routes</em> → compare the options → <em>Lock</em>.</li>
            <li>Sections after that can stay ◌ unplanned — the dashed hints and (est.) miles still count toward the totals.</li>
            <li>Prefer sketching by hand? <em>Export plan GPX</em> → draw on OnTheGoMap → <em>Import GPX</em> back.</li>
            <li>Send the van: <em>Directions ↗</em> on any checkpoint.</li>
          </ol>
        </details>
      </div>

      {(err || notice) && (
        <div
          style={{
            margin: "0 18px 10px",
            padding: "9px 14px",
            borderRadius: 8,
            fontSize: 13,
            border: `1px solid ${err ? "#c8401a" : "#3a6b40"}`,
            color: err ? "#e8613c" : "#6fbf7a",
            background: "rgba(0,0,0,.3)",
          }}
        >
          {err ?? notice}
        </div>
      )}

      {/* Map — click to drop a checkpoint; candidate previews draw here. */}
      <div style={{ position: "relative" }}>
        {data && (
          <RelayMap
            key={mapKey}
            data={data}
            height="62vh"
            bare
            // Rich, readable basemap for planning (street names, terrain) —
            // the dark tiles are for the public tracker, not for map work.
            tiles="voyager"
            extras={extras}
            onMapClick={(lat, lng) => {
              setWpPos({ lat, lng });
              setWpName(`Waypoint ${(data.waypoints.length ?? 0) + 1}`);
            }}
          />
        )}
        {!wpPos && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              ...mono,
              color: MUTED,
              background: "rgba(18,16,13,.8)",
              padding: "7px 14px",
              borderRadius: 999,
              border: "1px solid rgba(245,242,236,.14)",
              pointerEvents: "none",
              zIndex: 500,
            }}
          >
            Click the map to drop a checkpoint
          </div>
        )}
      </div>

      {/* City search — "we know we want to hit this city next". Picking a
          result prefills the add-checkpoint form below. */}
      <div
        style={{
          margin: "12px 18px 0",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void searchCity()}
          placeholder="Find a city/town (e.g. Sisteron)…"
          style={{
            flex: "1 1 220px",
            maxWidth: 340,
            background: "rgba(245,242,236,.06)",
            color: FG,
            borderColor: "rgba(245,242,236,.2)",
          }}
        />
        <button
          className="btn btn--ghost btn--sm"
          disabled={busy || citySearching || !cityQuery.trim()}
          onClick={() => void searchCity()}
        >
          {citySearching ? "Searching…" : "Find"}
        </button>
        {cityResults.map((c, i) => (
          <button
            key={i}
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setWpPos({ lat: c.lat, lng: c.lng });
              setWpName(c.name);
              setCityResults([]);
              setCityQuery("");
            }}
          >
            + {c.name}
          </button>
        ))}
      </div>

      {/* New-checkpoint form */}
      {wpPos && (
        <div
          style={{
            margin: "12px 18px",
            padding: "12px 14px",
            border: `1px solid ${AMBER}`,
            borderRadius: 10,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ ...mono, color: MUTED }}>
            {wpPos.lat.toFixed(4)}, {wpPos.lng.toFixed(4)}
          </span>
          <input
            className="input"
            value={wpName}
            onChange={(e) => setWpName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addWaypoint()}
            placeholder="Checkpoint name (e.g. Gap)"
            style={{
              flex: "1 1 180px",
              background: "rgba(245,242,236,.06)",
              color: FG,
              borderColor: "rgba(245,242,236,.2)",
            }}
            autoFocus
          />
          <button
            className="btn btn--primary btn--sm"
            disabled={busy || !wpName.trim()}
            onClick={() => void addWaypoint()}
          >
            Add checkpoint
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setWpPos(null)}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "10px 18px 80px" }}>
        {/* Plan totals */}
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", padding: "12px 0 18px" }}>
          <div>
            <div style={{ ...mono, color: MUTED, marginBottom: 3 }}>Planned distance</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>
              {fmtMiles(planTotals.distanceM)}
            </div>
          </div>
          <div>
            <div style={{ ...mono, color: MUTED, marginBottom: 3 }}>Planned gain</div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 26 }}>
              {fmtFeet(planTotals.gainM)}
            </div>
          </div>
          <div>
            <div style={{ ...mono, color: MUTED, marginBottom: 3 }}>Unplanned sections</div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                color: planTotals.unplanned ? AMBER : FG,
              }}
            >
              {planTotals.unplanned}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ ...mono, color: MUTED, margin: "8px 0 10px" }}>
          Sections · checkpoint to checkpoint
        </div>
        {sections.length === 0 && (
          <div style={{ color: MUTED, fontSize: 14, padding: "18px 0" }}>
            Drop at least two checkpoints on the map to create your first section.
          </div>
        )}
        {sections.map((s) => {
          const chip = statusChip[s.status];
          const isSuggesting = suggestFor?.fromId === s.from.id && suggestFor?.toId === s.to.id;
          return (
            <div
              key={s.from.id}
              style={{ borderBottom: "1px solid rgba(245,242,236,.1)", padding: "12px 4px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ ...mono, color: chip.color, minWidth: 92 }}>{chip.label}</span>
                <span style={{ flex: 1, fontSize: 15, minWidth: 180 }}>
                  {s.from.name} → {s.to.name}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 14,
                    color: s.estimated ? MUTED : FG,
                  }}
                >
                  {fmtMiles(s.distanceM)}
                  {s.estimated ? " (est.)" : ""}
                </span>
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 14,
                    color: MUTED,
                    minWidth: 76,
                  }}
                >
                  {s.gainM !== null ? `+${fmtFeet(s.gainM)}` : "gain —"}
                </span>
                {s.status !== "passed" && (
                  <span style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={busy}
                      onClick={() => void suggest(s)}
                    >
                      {s.status === "locked" ? "Re-route" : "Suggest routes"}
                    </button>
                    {s.status === "locked" && (
                      <button
                        className="btn btn--ghost btn--sm"
                        disabled={busy}
                        onClick={() => void unlock(s)}
                      >
                        Unlock
                      </button>
                    )}
                  </span>
                )}
              </div>

              {/* Candidate picker — options preview on the map above. */}
              {isSuggesting && (
                <div style={{ margin: "12px 0 4px", paddingLeft: 6 }}>
                  {candidates.length === 0 ? (
                    <div style={{ ...mono, color: MUTED }}>Routing…</div>
                  ) : (
                    <>
                      {candidates.map((c, i) => (
                        <label
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 0",
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          <input
                            type="radio"
                            name="cand"
                            checked={picked === i}
                            onChange={() => setPicked(i)}
                          />
                          <span
                            aria-hidden
                            style={{
                              width: 22,
                              height: 4,
                              borderRadius: 2,
                              background: CAND_COLORS[i % CAND_COLORS.length],
                            }}
                          />
                          <span>
                            Option {i + 1}
                            {c.recommended && <span style={{ color: AMBER }}> ★ recommended</span>}
                          </span>
                          <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                            {fmtMiles(c.distanceM)} · +{fmtFeet(c.gainM)}
                            {c.source === "straight" ? " · straight-line" : ""}
                          </span>
                        </label>
                      ))}
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <button
                          className="btn btn--primary btn--sm"
                          disabled={busy}
                          onClick={() => void lockPicked()}
                        >
                          Lock this route
                        </button>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setSuggestFor(null);
                            setCandidates([]);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Checkpoints */}
        <div style={{ ...mono, color: MUTED, margin: "26px 0 10px" }}>Checkpoints</div>
        {(data?.waypoints ?? []).map((w) => (
          <div
            key={w.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 4px",
              borderBottom: "1px solid rgba(245,242,236,.08)",
              fontSize: 14,
            }}
          >
            <span style={{ flex: 1 }}>
              {w.name}
              {w.passed && <span style={{ color: "#6fbf7a" }}> ✓</span>}
            </span>
            <span style={{ ...mono, color: MUTED }}>
              {w.passed ? "passed" : `~ ${fmtEta(w.etaAt)}`}
            </span>
            <a
              className="btn btn--ghost btn--sm"
              href={directionsUrl(w)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              title="Google Maps directions to this checkpoint"
            >
              Directions ↗
            </a>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void copyCheckpointLink(w)}
              title="Copy a shareable maps link"
            >
              ⧉
            </button>
            <button
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void deleteWaypoint(w)}
            >
              ✕
            </button>
          </div>
        ))}
        {data && !data.ready && (
          <div style={{ marginTop: 20, ...mono, color: MUTED }}>
            Tracker tables missing — run `npm run prisma:push`.
          </div>
        )}
      </div>
    </div>
  );
}
