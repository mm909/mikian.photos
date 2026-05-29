"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";

export type CoverageResponse = {
  event: { id: string; name: string };
  totals: {
    photos: number;
    withBib: number;
    withFace: number;
    withBoth: number;
    withNeither: number;
  };
  bibs: Array<{
    bib: number;
    photoCount: number;
    sources: string[];
    avgConfidence: number;
    faceCount: number;
    runner: string | null;
  }>;
  faces: Array<{
    faceClusterId: string;
    photoCount: number;
    bibsSeenAlongside: number[];
    avgConfidence: number;
    /** Highest-confidence face for this cluster — used to render a
     *  thumbnail crop in the By-face table. */
    sampleFace: { photoId: string; faceId: string };
  }>;
  gaps: {
    unreachable: { count: number; samplePhotoIds: string[] };
    bibOnly: { count: number; samplePhotoIds: string[] };
    faceOnly: { count: number; samplePhotoIds: string[] };
  };
};

type PhotosResponse = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  photos: DetailPhoto[];
};

type BibSortKey = "bib" | "photos" | "sources" | "conf" | "faces" | "runner";
type GapKey = "unreachable" | "bibOnly" | "faceOnly";

type PhotoFilter =
  | { eventId: string; bib: number }
  | { eventId: string; faceClusterId: string }
  | { eventId: string; gap: GapKey };

const ROW_PAGE_SIZE = 30; // bib/face rows per table page
const PHOTO_PAGE_SIZE = 24;

/**
 * Owner-only coverage data hook.
 *
 * Fetches the aggregated coverage rollup (`/api/admin/coverage`) once for an
 * event and exposes a `refetch` so callers can refresh totals after a
 * mutation (e.g. untagging a photo from a bib). The coverage tabs
 * (`BibTab` / `FaceTab` / `GapsTab`) consume the returned `data`.
 *
 * Lives here (rather than inside a screen component) because the combined
 * Roster surface owns the screen chrome now — it just borrows these tabs.
 */
export function useCoverageData(eventId: string) {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/coverage?eventId=${encodeURIComponent(eventId)}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      setData((await r.json()) as CoverageResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ============================================================================
// By bib
// ============================================================================

export function BibTab({
  eventId,
  rows,
  onMutated,
}: {
  eventId: string;
  rows: CoverageResponse["bibs"];
  /** Tell the parent to refetch coverage totals (after a bib delete). */
  onMutated: () => void;
}) {
  const [sort, setSort] = useState<BibSortKey>("photos");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedBib, setExpandedBib] = useState<number | null>(null);

  // Reset to page 1 whenever the user changes the filter — otherwise they
  // could be left staring at an empty page 6.
  useEffect(() => {
    setPage(1);
  }, [query, sort, sortDir]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.bib).includes(q) || (r.runner ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort) {
        case "bib":
          return (a.bib - b.bib) * dir;
        case "photos":
          return (a.photoCount - b.photoCount) * dir;
        case "sources":
          return (
            (a.sources.join(",").localeCompare(b.sources.join(","))) * dir
          );
        case "conf":
          return (a.avgConfidence - b.avgConfidence) * dir;
        case "faces":
          return (a.faceCount - b.faceCount) * dir;
        case "runner":
          return ((a.runner ?? "").localeCompare(b.runner ?? "")) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / ROW_PAGE_SIZE));
  const pageStart = (page - 1) * ROW_PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + ROW_PAGE_SIZE);

  function toggleSort(k: BibSortKey) {
    if (sort === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      // Sensible defaults: text cols default ascending, number cols descending.
      setSortDir(k === "bib" || k === "runner" || k === "sources" ? "asc" : "desc");
    }
  }

  // deleteBib(...) used to live here; whole-bib deletion is intentionally
  // off the coverage table for now. The API endpoint stays (in case we
  // surface it from somewhere safer later) — see /api/admin/coverage/bib.

  if (rows.length === 0) {
    return <Muted>No bibs detected in this event yet.</Muted>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          type="search"
          placeholder="Search bib or runner name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 240,
            padding: "7px 10px",
            fontSize: 13,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            // Six columns now — the per-row Delete column was removed.
            // Whole-bib deletion lives elsewhere; the coverage table is
            // read-mostly with row-click drill-in + per-photo untag.
            display: "grid",
            gridTemplateColumns: "72px 70px 1.2fr 80px 80px 1.4fr",
            gap: 10,
            padding: "8px 12px",
            background: "var(--cream)",
            borderBottom: "1px solid var(--line)",
            alignItems: "center",
          }}
        >
          <SortBtn label="Bib" k="bib" active={sort} dir={sortDir} onClick={toggleSort} />
          <SortBtn label="Photos" k="photos" active={sort} dir={sortDir} onClick={toggleSort} />
          <SortBtn label="Sources" k="sources" active={sort} dir={sortDir} onClick={toggleSort} />
          <SortBtn label="Conf" k="conf" active={sort} dir={sortDir} onClick={toggleSort} />
          <SortBtn label="Faces" k="faces" active={sort} dir={sortDir} onClick={toggleSort} />
          <SortBtn label="Runner" k="runner" active={sort} dir={sortDir} onClick={toggleSort} />
        </div>
        {pageRows.length === 0 ? (
          <div style={{ padding: 16, color: "var(--muted)", fontSize: 13, textAlign: "center" }}>
            No bibs match this search.
          </div>
        ) : (
          pageRows.map((r) => {
            const open = expandedBib === r.bib;
            return (
              <div key={r.bib}>
                <BibRow
                  row={r}
                  open={open}
                  onToggle={() => setExpandedBib(open ? null : r.bib)}
                />
                {open && (
                  <BibDrawer
                    eventId={eventId}
                    bib={r.bib}
                    onAfterUntag={onMutated}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 && (
        <Pager page={page} pageCount={pageCount} onJump={setPage} />
      )}
    </div>
  );
}

function BibRow({
  row,
  open,
  onToggle,
}: {
  row: CoverageResponse["bibs"][number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "72px 70px 1.2fr 80px 80px 1.4fr",
        gap: 10,
        padding: "8px 12px",
        borderBottom: "1px solid var(--line)",
        background: open ? "var(--cream)" : "var(--surface)",
        cursor: "pointer",
        fontSize: 13,
        alignItems: "center",
        transition: "background 0.08s",
      }}
      onMouseEnter={(e) => {
        if (!open) (e.currentTarget as HTMLDivElement).style.background = "var(--cream)";
      }}
      onMouseLeave={(e) => {
        if (!open)
          (e.currentTarget as HTMLDivElement).style.background = "var(--surface)";
      }}
      title={`Show photos for #${row.bib}`}
    >
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
        {open ? "▾" : "▸"} #{row.bib}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.photoCount}</span>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>
        {prettySources(row.sources)}
      </span>
      <span
        style={{
          color: "var(--muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {(row.avgConfidence * 100).toFixed(0)}%
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          color: row.faceCount === 0 ? "var(--line)" : "var(--ink)",
        }}
      >
        {row.faceCount}
      </span>
      {/* Runner cell links to the per-runner profile when we know who
          this bib belongs to. stopPropagation so clicking the name
          doesn't also toggle the drawer below. */}
      {row.runner ? (
        <Link
          href={`/admin/roster/${row.bib}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            color: "var(--ink)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
              "underline")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.textDecoration = "none")
          }
          title={`Open ${row.runner}'s profile`}
        >
          {row.runner}
        </Link>
      ) : (
        <span style={{ color: "var(--line)" }}>—</span>
      )}
    </div>
  );
}

function BibDrawer({
  eventId,
  bib,
  onAfterUntag,
}: {
  eventId: string;
  bib: number;
  /** Called when a single PhotoBib row was removed, so parent can refetch totals. */
  onAfterUntag: () => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--cream)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* Whole-bib Delete button used to live in the topRightAction slot.
          Removed for now — coverage is read-mostly. Per-photo untagging
          still works via the bib chips inside PhotoDetailModal. */}
      <CoveragePhotoGrid
        filter={{ eventId, bib }}
        emptyLabel="No photos for this bib (anymore)."
        onAfterUntag={onAfterUntag}
      />
    </div>
  );
}

// ============================================================================
// By face
// ============================================================================

export function FaceTab({
  eventId,
  rows,
}: {
  eventId: string;
  rows: CoverageResponse["faces"];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: "24px 18px",
          background: "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 6,
          }}
        >
          Awaiting face detection
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          This tab fills in once face-detection writes PhotoFace rows.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          // First col is now a 48px thumbnail; the face-id label moves
          // alongside it so the row reads "[crop] cluster-id".
          gridTemplateColumns: "56px 1.4fr 70px 2fr 80px",
          gap: 10,
          padding: "8px 12px",
          background: "var(--cream)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <ColHeader label="" />
        <ColHeader label="Face" />
        <ColHeader label="Photos" />
        <ColHeader label="Bibs seen alongside" />
        <ColHeader label="Avg conf" />
      </div>
      {rows.map((r) => {
        const open = expanded === r.faceClusterId;
        return (
          <div key={r.faceClusterId}>
            <div
              onClick={() => setExpanded(open ? null : r.faceClusterId)}
              role="button"
              tabIndex={0}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1.4fr 70px 2fr 80px",
                gap: 10,
                padding: "8px 12px",
                borderBottom: "1px solid var(--line)",
                background: open ? "var(--cream)" : "var(--surface)",
                cursor: "pointer",
                fontSize: 13,
                alignItems: "center",
              }}
              onMouseEnter={(e) => {
                if (!open) (e.currentTarget as HTMLDivElement).style.background = "var(--cream)";
              }}
              onMouseLeave={(e) => {
                if (!open) (e.currentTarget as HTMLDivElement).style.background = "var(--surface)";
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${r.sampleFace.photoId}/face/${r.sampleFace.faceId}`}
                alt=""
                loading="lazy"
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 4,
                  background: "var(--cream)",
                  border: "1px solid var(--line)",
                }}
              />
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                {open ? "▾" : "▸"} {r.faceClusterId.slice(0, 14)}…
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.photoCount}</span>
              <span style={{ color: "var(--muted)" }}>
                {r.bibsSeenAlongside.length === 0
                  ? "—"
                  : r.bibsSeenAlongside.map((b) => `#${b}`).join(", ")}
              </span>
              <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                {(r.avgConfidence * 100).toFixed(0)}%
              </span>
            </div>
            {open && (
              <div
                style={{
                  padding: 14,
                  background: "var(--cream)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <CoveragePhotoGrid
                  filter={{ eventId, faceClusterId: r.faceClusterId }}
                  emptyLabel="No photos for this face cluster."
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Coverage gaps
// ============================================================================

export function GapsTab({
  eventId,
  totals,
}: {
  eventId: string;
  totals: CoverageResponse["gaps"];
}) {
  const [bucket, setBucket] = useState<GapKey>(() => {
    if (totals.unreachable.count > 0) return "unreachable";
    if (totals.bibOnly.count > 0) return "bibOnly";
    if (totals.faceOnly.count > 0) return "faceOnly";
    return "unreachable";
  });

  const meta: Record<GapKey, { label: string; helper: string; count: number }> = {
    unreachable: {
      label: "Unreachable",
      helper: "No bib, no face. Can only be found by browsing.",
      count: totals.unreachable.count,
    },
    bibOnly: {
      label: "Bib-only",
      helper: "Bib detected, no face. Face search misses these.",
      count: totals.bibOnly.count,
    },
    faceOnly: {
      label: "Face-only",
      helper: "Face detected, no bib. Bib search misses.",
      count: totals.faceOnly.count,
    },
  };
  const active = meta[bucket];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(Object.keys(meta) as GapKey[]).map((k) => (
          <BucketBtn
            key={k}
            label={meta[k].label}
            count={meta[k].count}
            active={bucket === k}
            onClick={() => setBucket(k)}
          />
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>{active.helper}</p>
      <CoveragePhotoGrid filter={{ eventId, gap: bucket }} emptyLabel="Empty bucket." />
    </div>
  );
}

function BucketBtn({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: active ? "var(--surface)" : "var(--cream)",
        border: active ? "1px solid var(--ink)" : "1px solid var(--line)",
        borderRadius: 5,
        cursor: active ? "default" : "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: active ? "var(--ink)" : "var(--muted)",
        fontWeight: active ? 700 : 400,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          padding: "1px 5px",
          background: active ? "var(--ink)" : "var(--surface)",
          color: active ? "var(--paper)" : "var(--muted)",
          borderRadius: 3,
          fontSize: 9,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ============================================================================
// Photo grid (paginated; click → PhotoDetailModal)
// ============================================================================

function CoveragePhotoGrid({
  filter,
  emptyLabel,
  onAfterUntag,
  topRightAction,
}: {
  filter: PhotoFilter;
  emptyLabel: string;
  /** Called after an untag deletion completes, so the parent can refetch
   *  aggregate counts (the row count + the total). The untag UI itself
   *  lives on the chips inside PhotoDetailModal. */
  onAfterUntag?: () => void;
  topRightAction?: React.ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-photo client state for the modal (shared across opens).
  const [openId, setOpenId] = useState<string | null>(null);
  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [rerunFace, setRerunFace] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});

  const queryString = useMemo(() => {
    const qs = new URLSearchParams({
      eventId: filter.eventId,
      page: String(page),
      pageSize: String(PHOTO_PAGE_SIZE),
    });
    if ("bib" in filter) qs.set("bib", String(filter.bib));
    else if ("faceClusterId" in filter) qs.set("faceClusterId", filter.faceClusterId);
    else qs.set("gap", filter.gap);
    return qs.toString();
  }, [filter, page]);

  // Reset page 1 when the filter identity changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    "bib" in filter ? `b:${filter.bib}` : "",
    "faceClusterId" in filter ? `f:${filter.faceClusterId}` : "",
    "gap" in filter ? `g:${filter.gap}` : "",
  ]);

  const refetch = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/coverage/photos?${queryString}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `${r.status}`);
        }
        return (await r.json()) as PhotosResponse;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // ----- modal actions (mirror PhotographerDashboardClient) -----

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, { method: "POST" });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      // Refetch the photos list to pick up new bibs.
      refetch();
      setRerun((s) => ({ ...s, [photoId]: "ok" }));
      setTimeout(() => setRerun((s) => ({ ...s, [photoId]: "idle" })), 1500);
    } catch (e) {
      console.error(e);
      setRerun((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  /** Force a fresh Rekognition IndexFaces pass on this photo. Hits the
   *  rerun-faces endpoint which wipes existing PhotoFace + Rekognition
   *  entries first, then re-indexes. ~5–15s round trip. */
  async function rerunFaceIndex(photoId: string) {
    setRerunFace((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-faces`, {
        method: "POST",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `rerun-faces ${r.status}`);
      }
      // Refetch so the new PhotoFace rows show up in the modal + chips.
      refetch();
      setRerunFace((s) => ({ ...s, [photoId]: "ok" }));
      setTimeout(() => setRerunFace((s) => ({ ...s, [photoId]: "idle" })), 1500);
    } catch (e) {
      console.error(e);
      setRerunFace((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function deletePhoto(photoId: string) {
    setDelState((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`delete ${r.status}`);
      setOpenId((curr) => (curr === photoId ? null : curr));
      refetch();
      setDelState((s) => {
        const { [photoId]: _gone, ...rest } = s;
        void _gone;
        return rest;
      });
    } catch (e) {
      console.error(e);
      setDelState((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function toggleHidden(photoId: string) {
    const photo = data?.photos.find((p) => p.id === photoId);
    if (!photo) return;
    const nextHidden = !photo.hidden;
    setHideStateMap((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: nextHidden }),
      });
      if (!r.ok) throw new Error(`patch ${r.status}`);
      refetch();
      setHideStateMap((s) => {
        const { [photoId]: _gone, ...rest } = s;
        void _gone;
        return rest;
      });
    } catch (e) {
      console.error(e);
      setHideStateMap((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function untagSinglePhotoBib(photoId: string, bib: number) {
    // No confirm here — the chip button in PhotoDetailModal already
    // confirmed before invoking this. Keep this function pure-network.
    const r = await fetch("/api/admin/coverage/photo-bib", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, bib }),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      alert(`Could not untag: ${j.error ?? r.status}`);
      return;
    }
    refetch();
    onAfterUntag?.();
  }

  const openPhoto = openId ? data?.photos.find((p) => p.id === openId) ?? null : null;

  if (loading && !data) return <Muted>Loading photos…</Muted>;
  if (error) return <Muted>Failed to load: {error}</Muted>;
  if (!data || data.total === 0) return <Muted>{emptyLabel}</Muted>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {data.total.toLocaleString()} photo{data.total === 1 ? "" : "s"}
          {data.pageCount > 1 && ` · page ${data.page} of ${data.pageCount}`}
        </div>
        {topRightAction}
      </div>

      <div
        style={{
          display: "grid",
          // Bigger tiles + tighter gap. Switched from `auto-fill, 1fr` to
          // `auto-fill, <fixed>` so the last row doesn't stretch its tiles
          // to fill the leftover horizontal space — the user explicitly
          // doesn't want the grid to fully justify.
          gridTemplateColumns: "repeat(auto-fill, 200px)",
          gap: 2,
          opacity: loading ? 0.55 : 1,
          transition: "opacity 0.15s",
        }}
      >
        {data.photos.map((p) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              aspectRatio: "3 / 2",
              background: "var(--cream)",
              borderRadius: 3,
              overflow: "hidden",
              cursor: "pointer",
            }}
            onClick={() => setOpenId(p.id)}
            title={p.id}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.previewUrl}
              alt=""
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
            {/* Per-tile Untag button intentionally removed — the same action
                now lives on the bib chip inside PhotoDetailModal (click the
                chip to remove the tagging). Keeps the grid uncluttered. */}
          </div>
        ))}
      </div>

      {data.pageCount > 1 && (
        <Pager page={data.page} pageCount={data.pageCount} onJump={setPage} />
      )}

      {openPhoto && data && (
        <PhotoDetailModal
          photos={data.photos}
          currentId={openPhoto.id}
          onSelect={(id) => setOpenId(id)}
          rerunState={rerun[openPhoto.id] ?? "idle"}
          rerunFaceState={rerunFace[openPhoto.id] ?? "idle"}
          onRerunFace={() => rerunFaceIndex(openPhoto.id)}
          deleteState={delState[openPhoto.id] ?? "idle"}
          hideState={hideStateMap[openPhoto.id] ?? "idle"}
          onClose={() => setOpenId(null)}
          onRerun={() => rerunOcr(openPhoto.id)}
          onAskDelete={() =>
            setDelState((s) => ({
              ...s,
              [openPhoto.id]: s[openPhoto.id] === "confirm" ? "idle" : "confirm",
            }))
          }
          onConfirmDelete={() => deletePhoto(openPhoto.id)}
          onCancelDelete={() => setDelState((s) => ({ ...s, [openPhoto.id]: "idle" }))}
          onToggleHidden={() => toggleHidden(openPhoto.id)}
          // Coverage-only: click a bib chip in the modal → remove that
          // tagging from this single photo. Library doesn't pass this so
          // its chips stay static.
          onUntagBib={(bib) => untagSinglePhotoBib(openPhoto.id, bib)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Atoms
// ============================================================================

function Pager({
  page,
  pageCount,
  onJump,
}: {
  page: number;
  pageCount: number;
  onJump: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
      <PageBtn
        label="←"
        disabled={page <= 1}
        onClick={() => onJump(Math.max(1, page - 1))}
      />
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 6px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--muted)",
        }}
      >
        <input
          type="number"
          min={1}
          max={pageCount}
          value={page}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 1 && n <= pageCount) onJump(n);
          }}
          style={{
            width: 50,
            padding: "4px 6px",
            border: "1px solid var(--line)",
            borderRadius: 4,
            background: "var(--surface)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textAlign: "center",
          }}
        />
        / {pageCount}
      </label>
      <PageBtn
        label="→"
        disabled={page >= pageCount}
        onClick={() => onJump(Math.min(pageCount, page + 1))}
      />
    </div>
  );
}

function PageBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "5px 10px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "10px 12px",
        opacity: muted ? 0.6 : 1,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
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
          fontSize: 22,
          marginTop: 1,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 1,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "5px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        background: active ? "var(--surface)" : "transparent",
        border: 0,
        color: active ? "var(--ink)" : "var(--muted)",
        cursor: active ? "default" : "pointer",
        borderRadius: 4,
      }}
    >
      {label}
    </button>
  );
}

function SortBtn({
  label,
  k,
  active,
  dir,
  onClick,
}: {
  label: string;
  k: BibSortKey;
  active: BibSortKey;
  dir: "asc" | "desc";
  onClick: (k: BibSortKey) => void;
}) {
  const isActive = active === k;
  return (
    <button
      onClick={() => onClick(k)}
      style={{
        background: "transparent",
        border: 0,
        padding: 0,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: isActive ? "var(--ink)" : "var(--muted)",
        fontWeight: isActive ? 700 : 400,
      }}
      title={`Sort by ${label}`}
    >
      {label}
      {isActive ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

function ColHeader({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      {label}
    </span>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{children}</p>;
}

export function fmtCount(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function pctValue(num: number | undefined, denom: number | undefined): string {
  if (num == null || denom == null || denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

function prettySources(sources: string[]): string {
  if (sources.length === 0) return "—";
  return sources
    .map((s) => {
      if (s === "manual") return "manual";
      if (s === "user-tag") return "user";
      if (s.startsWith("ocr-")) return s.replace("ocr-", "OCR/");
      return s;
    })
    .join(" + ");
}
