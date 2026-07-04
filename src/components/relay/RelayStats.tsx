"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RelayData, RelayRunnerDto, RelaySegmentDto } from "@/lib/relay";
import { TEAM_NAME, TEAM_TAG, TEAM_HASHTAG } from "@/lib/dtk";
import { fmtMiles, fmtFeet, fmtPace, fmtDuration, fmtAgo, fmtEta } from "./format";
import { ElevationChart, type ProfilePoint, type SyncPoint } from "./ElevationChart";
import { StatsMap } from "./StatsMap";
import { RunnerPoster, LegGrid } from "./RunnerPoster";
import {
  renderTeamShareCard,
  renderLegShareCard,
  legShareFilename,
  download,
} from "./shareCard";
import { renderPosterCard, canvasToClipboard, type PosterLayout } from "./posterShare";
import { renderMapShot } from "./mapShot";
import { ShareModal } from "./ShareModal";
import { useMounted } from "./hooks";
import { RelayNav } from "./RelayNav";

/**
 * /tsp/stats — the immersive dark stats page for DowntownKruz (DTK).
 *
 * Layout (per the owner's feedback), top to bottom:
 *  1. "Where are we right now" MAP — dark tiles, all completed lines + the
 *     bright dotted plan + the position dot, initially zoomed to the last 3
 *     completed legs + the next ~10 mi of plan (StatsMap).
 *  2. Elevation profile, hover-synced with the map BOTH ways via the shared
 *     `sync` state here: chart hover → dot on the map; planned-line hover on
 *     the map → vertical marker on the chart. The team's current position is
 *     snapped onto the profile too ("how much climb is left").
 *  3. Big totals row (distance / gain / moving time / team pace — no
 *     waypoint counter).
 *  4. "The eight", ALPHABETICAL, clickable: selecting a runner filters
 *     everything below to them — their stat strip + a small-multiples grid of
 *     their legs, the leg table, and the big poster dims everyone else to ~8%.
 *     Every row shares ONE fixed grid template so the stat columns line up
 *     page-wide.
 *  5. "Leg by leg" — the leg table (moved here off the live page), newest
 *     first, LAST 5 shown with "Load more"/"Show all"; each leg's Share opens
 *     the preview-first ShareModal (transparent/dark story card).
 *  6. The poster ("Every line they ran").
 *  7. "Share the crossing" — pick a layout (map / grid / story overlay / map
 *     photo over real CARTO tiles), toggle the background, preview the
 *     rendered PNG, copy it to the clipboard or download it
 *     (posterShare.ts / shareCard.ts / mapShot.ts). NOTHING downloads without
 *     a preview first.
 *
 * The route profile (concatenated planned segments — completed as a fallback —
 * cumulative haversine distance vs elevation, decimated to <= 800 pts) is
 * built ONCE here and shared by the map and the chart so both sides snap
 * against the same series.
 */

const BG = "#14120f";
const CREAM = "#f5f2ec";
const MUTED = "#9a9186";
const ACCENT = "#e8613c";
const HAIR = "rgba(245,242,236,0.10)";

/** ONE fixed template for every runner row (name | distance | pace | gain |
 *  moving | legs) so the stat columns line up page-wide. */
const RUNNER_COLS = "minmax(140px, 1.2fr) 90px 90px 90px 90px 60px";

/** Fixed template for the leg table (leg | runner | miles | pace | started |
 *  share) — same idea: every row uses it, so everything aligns. */
const LEG_COLS = "minmax(150px, 1.3fr) minmax(130px, 1fr) 80px 96px 110px 100px";

/** Right-aligned tabular number cell for the leg table. */
const numCell: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "var(--font-serif)",
  fontSize: 15.5,
  color: CREAM,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const R_EARTH = 6371000;
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

/** Concatenate the route into a cumulative-distance profile. Planned segments
 *  when any are usable, else completed (so the page still renders sensibly
 *  with no plan). Segments with < 2 points are skipped; non-finite elevations
 *  become 0; the result is decimated to <= 800 points (first + last kept). */
function buildProfile(segments: RelaySegmentDto[]): {
  profile: ProfilePoint[];
  source: "planned" | "completed" | null;
} {
  const usable = (kind: "planned" | "completed") =>
    segments
      .filter((s) => s.kind === kind && s.points && s.points.length >= 2)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const planned = usable("planned");
  const completed = usable("completed");
  const src = planned.length ? planned : completed;
  const source: "planned" | "completed" | null = planned.length
    ? "planned"
    : completed.length
      ? "completed"
      : null;

  const full: ProfilePoint[] = [];
  let cum = 0;
  for (const seg of src) {
    for (const [lat, lng, ele] of seg.points) {
      if (full.length > 0) {
        const prev = full[full.length - 1];
        cum += haversineM(prev.lat, prev.lng, lat, lng);
      }
      full.push({ lat, lng, ele: Number.isFinite(ele) ? ele : 0, alongM: cum });
    }
  }

  const MAX_PTS = 800;
  let profile = full;
  if (full.length > MAX_PTS) {
    const step = Math.ceil(full.length / MAX_PTS);
    profile = [];
    for (let i = 0; i < full.length; i += step) profile.push(full[i]);
    if (profile[profile.length - 1] !== full[full.length - 1]) {
      profile.push(full[full.length - 1]);
    }
  }
  return { profile, source };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".16em",
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 18px",
        fontFamily: "var(--font-serif)",
        fontWeight: 500,
        fontSize: "clamp(22px, 3vw, 32px)",
        letterSpacing: "-.015em",
        color: CREAM,
      }}
    >
      {children}
    </h2>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: "clamp(26px, 4.4vw, 46px)",
          lineHeight: 1,
          letterSpacing: "-.02em",
          color: CREAM,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: ".13em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function runnerStatList(runner: RelayRunnerDto): Array<{ label: string; value: string }> {
  return [
    { label: "Distance", value: fmtMiles(runner.distanceM) },
    { label: "Pace", value: fmtPace(runner.paceSecPerKm) },
    { label: "Gain", value: fmtFeet(runner.gainM) },
    { label: "Moving", value: fmtDuration(runner.movingTimeSec) },
    { label: "Legs", value: String(runner.segmentCount) },
  ];
}

function MiniStats({ runner }: { runner: RelayRunnerDto }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "18px 26px",
        flexWrap: "wrap",
        flex: "2 1 320px",
        justifyContent: "flex-start",
      }}
    >
      {runnerStatList(runner).map((s) => (
        <div key={s.label} style={{ minWidth: 54 }}>
          <div
            style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: CREAM, lineHeight: 1 }}
          >
            {s.value}
          </div>
          <div
            style={{
              marginTop: 5,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One stat column in a runner row: value + its little mono label, attached,
 *  both right-aligned so the numbers line up down the page. */
function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <span style={{ display: "block", textAlign: "right", minWidth: 0 }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-serif)",
          fontSize: 17,
          color: CREAM,
          lineHeight: 1,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
      <span
        style={{
          display: "block",
          marginTop: 5,
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        {label}
      </span>
    </span>
  );
}

function RunnerRow({
  runner,
  selected,
  dimmed,
  onClick,
}: {
  runner: RelayRunnerDto;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "grid",
        gridTemplateColumns: RUNNER_COLS,
        gap: 12,
        alignItems: "center",
        width: "100%",
        padding: "16px 12px",
        border: "none",
        borderTop: `1px solid ${HAIR}`,
        background: selected ? "rgba(232,97,60,0.07)" : "transparent",
        boxShadow: selected ? `inset 3px 0 0 ${ACCENT}` : "none",
        opacity: dimmed ? 0.55 : 1,
        cursor: "pointer",
        textAlign: "left",
        color: CREAM,
        fontFamily: "inherit",
        transition: "background .15s ease, opacity .15s ease",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: runner.color,
            boxShadow: `0 0 8px ${runner.color}`,
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            color: CREAM,
            letterSpacing: "-.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {runner.name}
        </span>
      </span>
      {runnerStatList(runner).map((s) => (
        <StatCell key={s.label} value={s.value} label={s.label} />
      ))}
    </button>
  );
}

/** Small pill toggle for the share-section options. */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 16px",
        borderRadius: 999,
        border: `1px solid ${active ? ACCENT : HAIR}`,
        background: active ? "rgba(232,97,60,0.08)" : "transparent",
        color: active ? CREAM : MUTED,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "border-color .15s ease, color .15s ease",
      }}
    >
      {children}
    </button>
  );
}

export function RelayStats({ data, isOwner }: { data: RelayData; isOwner: boolean }) {
  // Relative/locale time strings render post-mount only (hydration safety —
  // the SSR pass runs at a different moment/timezone than the client).
  const mounted = useMounted();
  const { totals, runners, segments, waypoints, position } = data;

  // Shared hover-sync point — set by the elevation chart OR the map's planned
  // line; rendered by both (dot on the map, vertical marker on the chart).
  const [sync, setSync] = useState<SyncPoint | null>(null);
  const handleHover = useCallback((s: SyncPoint | null) => setSync(s), []);

  // Selected-runner filter for the lower sections.
  const [selectedRunnerId, setSelectedRunnerId] = useState<string | null>(null);
  const toggleRunner = useCallback((id: string) => {
    setSelectedRunnerId((cur) => (cur === id ? null : id));
  }, []);

  const completedSegments = useMemo(
    () => segments.filter((s) => s.kind === "completed"),
    [segments]
  );

  // Route profile shared by the map + chart (built once per data load).
  const { profile, source: profileSource } = useMemo(() => buildProfile(segments), [segments]);

  // Team position snapped onto the profile → "how much climb is left".
  const positionAlongM = useMemo(() => {
    if (!position || profile.length === 0) return null;
    const cos = Math.cos((position.lat * Math.PI) / 180);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < profile.length; i++) {
      const dLat = profile[i].lat - position.lat;
      const dLng = (profile[i].lng - position.lng) * cos;
      const d = dLat * dLat + dLng * dLng;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return profile[best].alongM;
  }, [position, profile]);

  // The eight — ALPHABETICAL by name.
  const sortedRunners = useMemo(
    () => runners.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [runners]
  );

  const selectedRunner = useMemo(
    () => (selectedRunnerId ? (runners.find((r) => r.id === selectedRunnerId) ?? null) : null),
    [selectedRunnerId, runners]
  );

  // Selected runner's legs, in leg order (DB already orders segments by
  // sortOrder → startedAt → createdAt, so array order IS leg order).
  const selectedLegs = useMemo(
    () =>
      selectedRunnerId
        ? completedSegments.filter((s) => s.runnerId === selectedRunnerId)
        : [],
    [selectedRunnerId, completedSegments]
  );

  const runnerById = useMemo(() => new Map(runners.map((r) => [r.id, r])), [runners]);

  // Leg table rows — leg # is the team-wide chronological index (array order
  // IS leg order), shown NEWEST FIRST, filtered when a runner is selected.
  const legRows = useMemo(() => {
    const rows = completedSegments.map((seg, i) => ({ seg, legNumber: i + 1 })).reverse();
    return selectedRunnerId ? rows.filter((r) => r.seg.runnerId === selectedRunnerId) : rows;
  }, [completedSegments, selectedRunnerId]);

  // ---- Per-leg share — opens the preview-first ShareModal (no blind
  // downloads); the transparent/dark chips live inside the modal.
  const [legShare, setLegShare] = useState<{ seg: RelaySegmentDto; legNumber: number } | null>(
    null
  );
  const [legDark, setLegDark] = useState(false); // default: transparent overlay

  const openLegShare = useCallback((seg: RelaySegmentDto, legNumber: number) => {
    setLegDark(false);
    setLegShare({ seg, legNumber });
  }, []);

  const legShareRender = useCallback(() => {
    if (!legShare) return null;
    const runner = legShare.seg.runnerId ? (runnerById.get(legShare.seg.runnerId) ?? null) : null;
    return renderLegShareCard({
      legNumber: legShare.legNumber,
      legName: legShare.seg.name,
      points: legShare.seg.points,
      distanceM: legShare.seg.distanceM,
      runnerName: runner?.name ?? null,
      runnerColor: runner?.color ?? null,
      runnerTotalM: runner?.distanceM ?? null,
      dark: legDark,
    });
  }, [legShare, legDark, runnerById]);

  // ---- Leg table paging — only the LAST 5 legs up front, +5 per click.
  const LEGS_PAGE = 5;
  const [visibleLegCount, setVisibleLegCount] = useState(LEGS_PAGE);
  useEffect(() => {
    setVisibleLegCount(LEGS_PAGE); // reset paging when the runner filter flips
  }, [selectedRunnerId]);
  const visibleLegRows = legRows.slice(0, visibleLegCount);
  const hiddenLegCount = Math.max(0, legRows.length - visibleLegRows.length);

  // ---- "Share the crossing" — layout options, live preview, copy/download.
  const [shareLayout, setShareLayout] = useState<PosterLayout | "story" | "mapshot">("map");
  const [posterTransparent, setPosterTransparent] = useState(false); // posters default dark
  const [storyDark, setStoryDark] = useState(false); // story defaults transparent
  const [shareStatus, setShareStatus] = useState<"rendering" | "ready" | "unavailable">(
    "rendering"
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const shareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Render the picked card client-side whenever an option changes and show it
  // as a data-URL <img> preview — the preview IS the gate: copy/download stay
  // disabled until it's on screen. The map photo renders async (tile fetch).
  useEffect(() => {
    shareCanvasRef.current = null;
    if (completedSegments.length === 0) {
      setPreviewUrl(null);
      return;
    }
    if (shareLayout === "mapshot") {
      let cancelled = false;
      setShareStatus("rendering");
      setPreviewUrl(null);
      renderMapShot({ segments, runners, waypoints })
        .then((canvas) => {
          if (cancelled) return;
          let url: string | null = null;
          if (canvas) {
            try {
              url = canvas.toDataURL("image/png");
            } catch {
              url = null;
            }
          }
          if (!canvas || !url) {
            setShareStatus("unavailable");
            return;
          }
          shareCanvasRef.current = canvas;
          setPreviewUrl(url);
          setShareStatus("ready");
        })
        .catch(() => {
          if (!cancelled) setShareStatus("unavailable");
        });
      return () => {
        cancelled = true;
      };
    }
    const canvas =
      shareLayout === "story"
        ? renderTeamShareCard(data, { dark: storyDark })
        : renderPosterCard({
            segments: completedSegments,
            runners,
            layout: shareLayout,
            transparent: posterTransparent,
            focusRunnerId: selectedRunnerId,
          });
    if (!canvas) {
      setPreviewUrl(null);
      setShareStatus("unavailable");
      return;
    }
    shareCanvasRef.current = canvas;
    setPreviewUrl(canvas.toDataURL("image/png"));
    setShareStatus("ready");
  }, [
    shareLayout,
    posterTransparent,
    storyDark,
    selectedRunnerId,
    completedSegments,
    segments,
    waypoints,
    runners,
    data,
  ]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    },
    []
  );

  const shareFilename = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    const focus = selectedRunner
      ? `-${selectedRunner.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : "";
    if (shareLayout === "story") return `dtk-story-overlay${storyDark ? "-dark" : ""}-${date}.png`;
    if (shareLayout === "mapshot") return `dtk-map-photo-${date}.png`;
    const bg = posterTransparent ? "-transparent" : "";
    if (shareLayout === "map") return `dtk-poster-map${focus}${bg}-${date}.png`;
    return `dtk-poster-grid${focus}${bg}-${date}.png`;
  }, [shareLayout, storyDark, posterTransparent, selectedRunner]);

  const shareReady = shareStatus === "ready";

  const handleShareDownload = useCallback(() => {
    const canvas = shareCanvasRef.current;
    if (canvas) download(canvas, shareFilename());
  }, [shareFilename]);

  const handleShareCopy = useCallback(async () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const ok = await canvasToClipboard(canvas);
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    if (ok) {
      setCopyState("copied");
    } else {
      setCopyState("failed");
      download(canvas, shareFilename()); // clipboard unsupported → just save it
    }
    copyTimerRef.current = window.setTimeout(() => setCopyState("idle"), 2000);
  }, [shareFilename]);

  const copyLabel =
    copyState === "copied"
      ? "Copied ✓"
      : copyState === "failed"
        ? "Copy unsupported — downloaded instead"
        : "Copy to clipboard";

  // Is the CURRENT share render transparent? → checkerboard behind the preview.
  const previewTransparent =
    (shareLayout === "story" && !storyDark) ||
    ((shareLayout === "map" || shareLayout === "grid") && posterTransparent);

  const totalStats: Array<{ label: string; value: string }> = [
    { label: "Distance", value: fmtMiles(totals.distanceM) },
    { label: "Elevation gain", value: fmtFeet(totals.gainM) },
    { label: "Moving time", value: fmtDuration(totals.movingTimeSec) },
    { label: "Team pace", value: fmtPace(totals.paceSecPerKm) },
  ];

  const wrap: React.CSSProperties = {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "0 clamp(18px, 5vw, 40px)",
  };

  const frame: React.CSSProperties = {
    border: `1px solid ${HAIR}`,
    borderRadius: 14,
    background: "rgba(245,242,236,0.02)",
  };

  const posterCaption = selectedRunner ? (
    <>
      {selectedLegs.length} {selectedLegs.length === 1 ? "leg" : "legs"} by {selectedRunner.name} ·{" "}
      <span style={{ color: ACCENT }}>{TEAM_HASHTAG}</span>
    </>
  ) : (
    <>
      {completedSegments.length} completed {completedSegments.length === 1 ? "leg" : "legs"} ·{" "}
      <span style={{ color: ACCENT }}>{TEAM_HASHTAG}</span>
    </>
  );

  return (
    <main style={{ minHeight: "100vh", background: BG, color: CREAM, paddingBottom: 96 }}>
      {/* ---- Compact header --------------------------------------------- */}
      <header style={{ ...wrap, paddingTop: "clamp(20px, 4vw, 40px)" }}>
        <div style={{ marginBottom: 20 }}>
          <RelayNav current="stats" isOwner={isOwner} />
        </div>
        <Eyebrow>
          {TEAM_NAME} ({TEAM_TAG}) · TSP France
        </Eyebrow>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "8px 18px",
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              margin: "10px 0 6px",
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(28px, 4.6vw, 46px)",
              letterSpacing: "-.02em",
              color: CREAM,
              lineHeight: 1.05,
            }}
          >
            Where we are right now
          </h1>
          {totals.lastUpdatedAt && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: MUTED,
                letterSpacing: ".04em",
              }}
            >
              Updated {mounted ? fmtAgo(totals.lastUpdatedAt) : "…"}
            </div>
          )}
        </div>
      </header>

      {/* ---- 1. The map, first — zoomed to "right now" ------------------- */}
      <section style={{ marginTop: 16 }}>
        <StatsMap
          data={data}
          profile={profile}
          profileSource={profileSource}
          sync={sync}
          onPlannedHover={handleHover}
          height="clamp(380px, 58vh, 640px)"
        />
      </section>

      {/* ---- 2. Elevation profile, hover-synced with the map ------------- */}
      <section style={{ ...wrap, marginTop: "clamp(26px, 4vw, 44px)" }}>
        <Eyebrow>The climb</Eyebrow>
        <SectionTitle>Elevation profile</SectionTitle>
        <div style={{ ...frame, padding: "22px 18px 16px" }}>
          <ElevationChart
            profile={profile}
            sourceLabel={profileSource === "completed" ? "completed line" : "planned line"}
            waypoints={waypoints}
            sync={sync}
            onHover={handleHover}
            positionAlongM={positionAlongM}
          />
        </div>
        <p
          style={{
            marginTop: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: MUTED,
            letterSpacing: ".04em",
          }}
        >
          Hover the profile or the dotted route on the map — they follow each other.
        </p>
      </section>

      {/* ---- 3. Big totals ----------------------------------------------- */}
      <section style={{ ...wrap, marginTop: "clamp(44px, 6vw, 72px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "24px 20px",
            paddingTop: "clamp(24px, 3vw, 36px)",
            borderTop: `1px solid ${HAIR}`,
          }}
        >
          {totalStats.map((s) => (
            <BigStat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </section>

      {/* ---- 4. The eight — alphabetical, click to filter ----------------- */}
      <section style={{ ...wrap, marginTop: "clamp(48px, 7vw, 84px)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "10px 18px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Eyebrow>Runner by runner</Eyebrow>
            <SectionTitle>The eight</SectionTitle>
          </div>
          <button
            type="button"
            onClick={() => setSelectedRunnerId(null)}
            aria-pressed={selectedRunnerId === null}
            style={{
              marginBottom: 18,
              padding: "6px 16px",
              borderRadius: 999,
              border: `1px solid ${selectedRunnerId === null ? ACCENT : HAIR}`,
              background: "transparent",
              color: selectedRunnerId === null ? CREAM : MUTED,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "border-color .15s ease, color .15s ease",
            }}
          >
            All
          </button>
        </div>

        {sortedRunners.length === 0 ? (
          <div
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: MUTED, padding: "24px 0" }}
          >
            No runner splits yet.
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 640 }}>
                {sortedRunners.map((r) => (
                  <RunnerRow
                    key={r.id}
                    runner={r}
                    selected={r.id === selectedRunnerId}
                    dimmed={selectedRunnerId !== null && r.id !== selectedRunnerId}
                    onClick={() => toggleRunner(r.id)}
                  />
                ))}
                <div style={{ borderTop: `1px solid ${HAIR}` }} />
              </div>
            </div>
            <p
              style={{
                marginTop: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: MUTED,
                letterSpacing: ".04em",
              }}
            >
              Click a runner to filter everything below to just them.
            </p>
          </>
        )}
      </section>

      {/* ---- 4b. Selected runner — leg-by-leg small multiples ------------- */}
      {selectedRunner && (
        <section style={{ ...wrap, marginTop: "clamp(44px, 6vw, 72px)" }}>
          <Eyebrow>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: selectedRunner.color,
                boxShadow: `0 0 6px ${selectedRunner.color}`,
                marginRight: 9,
                verticalAlign: "baseline",
              }}
            />
            {selectedRunner.name} · leg by leg
          </Eyebrow>
          <SectionTitle>
            {selectedLegs.length === 1 ? "Their leg, drawn small" : "Their legs, drawn small"}
          </SectionTitle>
          <div style={{ marginBottom: 18 }}>
            <MiniStats runner={selectedRunner} />
          </div>
          <div style={{ ...frame, padding: "clamp(14px, 3vw, 26px)" }}>
            <LegGrid segments={selectedLegs} color={selectedRunner.color} />
          </div>
        </section>
      )}

      {/* ---- 5. Leg by leg — the full table, newest first ------------------ */}
      {completedSegments.length > 0 && (
        <section style={{ ...wrap, marginTop: "clamp(48px, 7vw, 84px)" }}>
          <Eyebrow>
            {selectedRunner ? `${selectedRunner.name} · newest first` : "Newest first"}
          </Eyebrow>
          <SectionTitle>Leg by leg</SectionTitle>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 700 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: LEG_COLS,
                  gap: 12,
                  alignItems: "end",
                  padding: "0 12px 10px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: MUTED,
                }}
              >
                <span>Leg</span>
                <span>Runner</span>
                <span style={{ textAlign: "right" }}>Miles</span>
                <span style={{ textAlign: "right" }}>Pace</span>
                <span style={{ textAlign: "right" }}>Started</span>
                <span aria-hidden />
              </div>
              {legRows.length === 0 ? (
                <div
                  style={{
                    borderTop: `1px solid ${HAIR}`,
                    padding: "18px 12px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: MUTED,
                  }}
                >
                  No legs yet.
                </div>
              ) : (
                visibleLegRows.map(({ seg, legNumber }) => {
                  const runner = seg.runnerId ? (runnerById.get(seg.runnerId) ?? null) : null;
                  const legPaceSecPerKm =
                    seg.movingTimeSec !== null && seg.movingTimeSec > 0 && seg.distanceM > 0
                      ? seg.movingTimeSec / (seg.distanceM / 1000)
                      : null;
                  return (
                    <div
                      key={seg.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: LEG_COLS,
                        gap: 12,
                        alignItems: "center",
                        padding: "12px",
                        borderTop: `1px solid ${HAIR}`,
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontFamily: "var(--font-serif)",
                            fontSize: 16,
                            color: CREAM,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          Leg {legNumber}
                        </span>
                        {seg.name && (
                          <span
                            style={{
                              display: "block",
                              marginTop: 3,
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              color: MUTED,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {seg.name}
                          </span>
                        )}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span
                          aria-hidden
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: runner?.color ?? MUTED,
                            boxShadow: runner ? `0 0 6px ${runner.color}` : "none",
                            flex: "0 0 auto",
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: 15.5,
                            color: runner ? CREAM : MUTED,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {runner?.name ?? "—"}
                        </span>
                      </span>
                      <span style={numCell}>{fmtMiles(seg.distanceM)}</span>
                      <span style={numCell}>{fmtPace(legPaceSecPerKm)}</span>
                      <span
                        style={{
                          ...numCell,
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: MUTED,
                        }}
                      >
                        {mounted ? fmtEta(seg.startedAt) : "…"}
                      </span>
                      <span style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => openLegShare(seg, legNumber)}
                          title="Preview & share this leg's story overlay"
                          style={{
                            padding: "5px 12px",
                            borderRadius: 999,
                            border: `1px solid ${HAIR}`,
                            background: "transparent",
                            color: CREAM,
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            letterSpacing: ".06em",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Share
                        </button>
                      </span>
                    </div>
                  );
                })
              )}
              <div style={{ borderTop: `1px solid ${HAIR}` }} />
            </div>
          </div>
          {hiddenLegCount > 0 && (
            <div
              style={{
                display: "flex",
                gap: "10px 12px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 16,
              }}
            >
              <Chip active={false} onClick={() => setVisibleLegCount((c) => c + 5)}>
                Load 5 more
              </Chip>
              <Chip active={false} onClick={() => setVisibleLegCount(legRows.length)}>
                Show all {legRows.length}
              </Chip>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  color: MUTED,
                  letterSpacing: ".04em",
                }}
              >
                {visibleLegRows.length} of {legRows.length}
              </span>
            </div>
          )}
        </section>
      )}

      {/* ---- 6. The poster ------------------------------------------------ */}
      <section style={{ ...wrap, marginTop: "clamp(48px, 7vw, 84px)" }}>
        <Eyebrow>The crossing</Eyebrow>
        <SectionTitle>Every line they ran</SectionTitle>
        <div
          style={{
            border: `1px solid ${HAIR}`,
            borderRadius: 14,
            padding: "clamp(14px, 3vw, 30px)",
            background:
              "radial-gradient(120% 90% at 50% 15%, rgba(232,97,60,0.06), rgba(20,18,15,0) 60%)",
          }}
        >
          <RunnerPoster
            segments={completedSegments}
            runners={runners}
            focusRunnerId={selectedRunnerId}
          />
        </div>
        <p
          style={{
            marginTop: 18,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: MUTED,
            letterSpacing: ".04em",
            textAlign: "center",
          }}
        >
          {posterCaption}
        </p>
      </section>

      {/* ---- 7. Share the crossing — options + preview + copy ------------- */}
      {completedSegments.length > 0 && (
        <section style={{ ...wrap, marginTop: "clamp(48px, 7vw, 84px)" }}>
          <Eyebrow>Take it with you</Eyebrow>
          <SectionTitle>Share the crossing</SectionTitle>

          <div style={{ display: "flex", gap: "10px 12px", flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: MUTED,
                marginRight: 2,
              }}
            >
              Layout
            </span>
            <Chip active={shareLayout === "map"} onClick={() => setShareLayout("map")}>
              Map
            </Chip>
            <Chip active={shareLayout === "grid"} onClick={() => setShareLayout("grid")}>
              Grid
            </Chip>
            <Chip active={shareLayout === "story"} onClick={() => setShareLayout("story")}>
              Story overlay
            </Chip>
            <Chip active={shareLayout === "mapshot"} onClick={() => setShareLayout("mapshot")}>
              Map photo
            </Chip>
          </div>

          {/* Background toggle — every render has both variants (posters
              default dark, story defaults transparent); the map photo's tiles
              are inherently opaque, so no toggle there. */}
          {shareLayout !== "mapshot" && (
            <div
              style={{
                display: "flex",
                gap: "10px 12px",
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 12,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: MUTED,
                  marginRight: 2,
                }}
              >
                Background
              </span>
              {shareLayout === "story" ? (
                <>
                  <Chip active={!storyDark} onClick={() => setStoryDark(false)}>
                    Transparent
                  </Chip>
                  <Chip active={storyDark} onClick={() => setStoryDark(true)}>
                    Dark
                  </Chip>
                </>
              ) : (
                <>
                  <Chip active={!posterTransparent} onClick={() => setPosterTransparent(false)}>
                    Dark
                  </Chip>
                  <Chip active={posterTransparent} onClick={() => setPosterTransparent(true)}>
                    Transparent
                  </Chip>
                </>
              )}
            </div>
          )}

          {shareStatus === "rendering" && !previewUrl && (
            <div
              style={{
                marginTop: 20,
                display: "inline-block",
                padding: "44px 56px",
                border: `1px dashed ${HAIR}`,
                borderRadius: 14,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: MUTED,
                letterSpacing: ".08em",
              }}
            >
              Rendering…
            </div>
          )}

          {shareStatus === "unavailable" && (
            <div
              style={{
                marginTop: 20,
                display: "inline-block",
                padding: "28px 32px",
                border: `1px solid ${HAIR}`,
                borderRadius: 14,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: MUTED,
                letterSpacing: ".04em",
              }}
            >
              {shareLayout === "mapshot"
                ? "Map snapshot unavailable — try the poster instead."
                : "Preview unavailable."}
            </div>
          )}

          {shareReady && previewUrl && (
            <div
              style={{
                marginTop: 20,
                display: "inline-block",
                border: `1px solid ${HAIR}`,
                borderRadius: 14,
                overflow: "hidden",
                // Transparent renders preview over a dark checkerboard so
                // "transparent" reads as transparent.
                ...(previewTransparent
                  ? {
                      padding: 10,
                      backgroundColor: "#26221d",
                      backgroundImage:
                        "linear-gradient(45deg, rgba(245,242,236,0.05) 25%, transparent 25%, transparent 75%, rgba(245,242,236,0.05) 75%), linear-gradient(45deg, rgba(245,242,236,0.05) 25%, transparent 25%, transparent 75%, rgba(245,242,236,0.05) 75%)",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 10px 10px",
                    }
                  : null),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview of the share card"
                style={{
                  display: "block",
                  width: "min(380px, 78vw)",
                  height: "auto",
                  borderRadius: previewTransparent ? 8 : 0,
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <button
              type="button"
              onClick={handleShareCopy}
              disabled={!shareReady}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: `1px solid ${ACCENT}`,
                background: "rgba(232,97,60,0.10)",
                color: CREAM,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                cursor: shareReady ? "pointer" : "default",
                opacity: shareReady ? 1 : 0.45,
                transition: "background .15s ease, opacity .15s ease",
              }}
            >
              {copyLabel}
            </button>
            <button
              type="button"
              onClick={handleShareDownload}
              disabled={!shareReady}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                border: `1px solid ${HAIR}`,
                background: "transparent",
                color: CREAM,
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                cursor: shareReady ? "pointer" : "default",
                opacity: shareReady ? 1 : 0.45,
                transition: "border-color .15s ease, opacity .15s ease",
              }}
            >
              ⇣ Download PNG
            </button>
          </div>
          <p
            style={{
              marginTop: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: MUTED,
              letterSpacing: ".04em",
            }}
          >
            Everything is 1080×1350 except the story overlay (1080×1920). Transparent variants
            drop over your own photo; the map photo draws the route on the real map.
          </p>
        </section>
      )}

      {/* ---- Per-leg share modal — preview first, always ------------------- */}
      {legShare && (
        <ShareModal
          title={`Leg ${legShare.legNumber} · story overlay`}
          filename={legShareFilename({
            legName: legShare.seg.name,
            legNumber: legShare.legNumber,
            dark: legDark,
          })}
          render={legShareRender}
          transparentable={!legDark}
          onClose={() => setLegShare(null)}
        >
          <Chip active={!legDark} onClick={() => setLegDark(false)}>
            Transparent
          </Chip>
          <Chip active={legDark} onClick={() => setLegDark(true)}>
            Dark background
          </Chip>
        </ShareModal>
      )}
    </main>
  );
}
