"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DISTANCE_LABELS,
  DISTANCE_METERS,
  elevationSeries,
  loadGpx,
  projectToSvg,
  type DistanceKey,
  type GpxTrack,
} from "@/lib/gpx";
import { racers } from "@/lib/data";
import { useRunner } from "./RunnerProvider";

const TABS: DistanceKey[] = ["5k", "10k", "half"];

export function CourseCard() {
  const { event } = useRunner();
  const [tab, setTab] = useState<DistanceKey>("half");
  const [track, setTrack] = useState<GpxTrack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadGpx(tab).then((t) => {
      if (!cancelled) {
        setTrack(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const racerCount = useMemo(() => racers.filter((r) => r.distance === tab).length, [tab]);

  const mapPoints = useMemo(() => (track ? projectToSvg(track, 320, 160) : []), [track]);
  const mapPath = useMemo(
    () =>
      mapPoints.length
        ? "M " + mapPoints.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")
        : "",
    [mapPoints]
  );

  const elev = useMemo(() => (track ? elevationSeries(track) : null), [track]);
  const elevPath = useMemo(() => {
    if (!elev || elev.distM.length < 2) return "";
    const w = 320;
    const h = 60;
    const totalD = elev.distM[elev.distM.length - 1] || 1;
    const span = Math.max(elev.max - elev.min, 1);
    const pts = elev.distM.map((d, i) => {
      const x = (d / totalD) * w;
      const y = h - ((elev.ele[i] - elev.min) / span) * h;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return "M " + pts.join(" L ");
  }, [elev]);

  const distanceKm = track ? (track.distanceM / 1000).toFixed(1) : (DISTANCE_METERS[tab] / 1000).toFixed(1);
  const gainM = track ? Math.round(track.gainM) : 0;

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        background: "var(--paper)",
        border: "1px solid var(--line)",
      }}
    >
      {/* Header strip with status */}
      <div
        style={{
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
          background: "var(--green-bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--green)",
        }}
      >
        <span className="live-dot" />
        {event?.name ?? "Race"} · Photos Live
      </div>

      {/* Distance tabs */}
      <div
        role="tablist"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          borderBottom: "1px solid var(--line)",
        }}
      >
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            style={{
              padding: "10px 8px",
              background: tab === k ? "var(--surface)" : "transparent",
              border: 0,
              borderRight: k === TABS[TABS.length - 1] ? 0 : "1px solid var(--line)",
              borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: tab === k ? "var(--ink)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: tab === k ? 500 : 400,
            }}
          >
            {DISTANCE_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Map */}
      <div style={{ padding: 16, background: "var(--cream)" }}>
        <svg
          viewBox="0 0 320 160"
          width="100%"
          height="160"
          role="img"
          aria-label={`${DISTANCE_LABELS[tab]} course map`}
          style={{ display: "block" }}
        >
          {loading || !track ? (
            <rect width="320" height="160" fill="transparent" />
          ) : (
            <>
              <path
                d={mapPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
              {mapPoints.length > 0 && (
                <>
                  <circle cx={mapPoints[0].x} cy={mapPoints[0].y} r={4} fill="var(--ink)" />
                  <circle
                    cx={mapPoints[mapPoints.length - 1].x}
                    cy={mapPoints[mapPoints.length - 1].y}
                    r={5}
                    fill="var(--accent)"
                    stroke="var(--paper)"
                    strokeWidth={2}
                  />
                </>
              )}
            </>
          )}
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginTop: 6,
          }}
        >
          <span>Start</span>
          <span>Finish</span>
        </div>
      </div>

      {/* Elevation */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 4,
          }}
        >
          <span>Elevation</span>
          <span>{gainM} m gain</span>
        </div>
        <svg viewBox="0 0 320 60" width="100%" height="60" style={{ display: "block" }}>
          {elevPath && (
            <>
              <path
                d={`${elevPath} L 320 60 L 0 60 Z`}
                fill="var(--accent)"
                opacity={0.12}
              />
              <path
                d={elevPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          padding: "12px 16px",
          borderTop: "1px solid var(--line)",
          gap: 10,
        }}
      >
        <Stat label="Distance" value={`${distanceKm} km`} />
        <Stat label="Racers" value={racerCount.toLocaleString()} />
        <Stat label="Gain" value={`${gainM} m`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 20,
          color: "var(--ink)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
