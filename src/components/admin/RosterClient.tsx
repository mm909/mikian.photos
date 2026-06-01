"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { Stat, fmtCount, useCoverageData } from "@/components/admin/CoverageClient";
import { DISTANCE_LABELS, type DistanceKey } from "@/lib/gpx";

type Runner = {
  bib: number;
  name: string;
  gender: "Male" | "Female";
  age: number;
  city: string;
  state: string;
  chipTime: string;
  chipMinutes: number;
  distance: DistanceKey;
  photoCount: number;
  // The single face we've identified for this runner (face-above-bib geometry
  // + one-face-per-runner). null when no face is matched yet. Renders the row
  // thumbnail and doubles as the "face identified" marker.
  face: { photoId: string; faceId: string } | null;
};

type RosterResponse = {
  event: { id: string; name: string };
  runners: Runner[];
  officialResultsUrl: string | null;
};

type SortKey = "bib" | "face" | "name" | "race" | "gender" | "age" | "city" | "chip" | "photos";

// Approx pixel height of one rendered roster row — used to size a page so
// the table fits the viewport without scrolling. Keep in sync with the row
// padding/font below.
const ROW_PX = 31;

type Props = {
  defaultEventId: string;
  defaultEventName: string;
  /** Owner sees clickable rows that drill into the per-runner curation
   *  profile. Race directors get the read-only list (rows are static). */
  isOwner: boolean;
};

/**
 * Combined Roster + Coverage surface — owner + race director.
 *
 * - **Runners** (default): searchable, sortable list of every entrant joined
 *   with per-runner photo + face counts. For owners, click a row → that
 *   runner's profile (the curation drill-in); race directors get the
 *   read-only list. This is the "someone got first, find their photos" lookup.
 * - **By bib / By face / Coverage gaps**: the detection-coverage tabs, so the
 *   owner can audit what OCR + face detection actually tagged without leaving
 *   the page.
 *
 * Click the official-results link to verify a runner's time on the
 * third-party timing site.
 */
export function RosterClient({ defaultEventId, defaultEventName, isOwner }: Props) {
  const [eventId] = useState(defaultEventId);

  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Coverage rollup powers the stat strip + the bib/face/gaps tabs. Fetched
  // alongside the roster so the header numbers are complete on first paint.
  const coverage = useCoverageData(eventId);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("bib");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Size each page so the table fills the space below it without making the
  // page scroll. Measured from the table's top edge to the bottom of the
  // viewport, minus room for the column header + pager.
  const tableRef = useRef<HTMLDivElement>(null);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  useEffect(() => {
    function recompute() {
      const el = tableRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const reserveBelow = 72; // pager + bottom breathing room
      const headerRow = 36; // the column-header row inside the table
      const avail = window.innerHeight - top - reserveBelow - headerRow;
      setRowsPerPage(Math.max(5, Math.floor(avail / ROW_PX)));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [loading, data]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/roster?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `${r.status}`);
        }
        return (await r.json()) as RosterResponse;
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
  }, [eventId]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, sortDir]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.runners;
    return data.runners.filter(
      (r) =>
        String(r.bib).includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
    );
  }, [data, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort) {
        case "bib":
          return (a.bib - b.bib) * dir;
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "race":
          return (
            ((RACE_RANK[a.distance] ?? 99) - (RACE_RANK[b.distance] ?? 99)) * dir ||
            a.bib - b.bib
          );
        case "gender":
          return a.gender.localeCompare(b.gender) * dir;
        case "age":
          return (a.age - b.age) * dir;
        case "city":
          return a.city.localeCompare(b.city) * dir;
        case "chip":
          return (a.chipMinutes - b.chipMinutes) * dir;
        case "photos":
          return (a.photoCount - b.photoCount) * dir;
        case "face":
          // Identified-first (or last, depending on dir). Tiebreak by bib so
          // the order within each group is stable.
          return ((a.face ? 1 : 0) - (b.face ? 1 : 0)) * dir || a.bib - b.bib;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pageRows = sorted.slice(pageStart, pageStart + rowsPerPage);

  function toggleSort(k: SortKey) {
    if (sort === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setSortDir(
        k === "name" || k === "gender" || k === "city" || k === "bib" || k === "race"
          ? "asc"
          : "desc"
      );
    }
  }

  // Aggregate summary above the table.
  const total = data?.runners.length ?? 0;
  const cov = coverage.data?.totals;

  return (
    <main className="screen" style={{ padding: "28px 24px 64px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 4,
            }}
          >
            {isOwner ? "Owner" : "Race director"} · Roster &amp; coverage ·{" "}
            {data?.event.name ?? defaultEventName}
          </div>
          <Headline
            as="h1"
            text="Race roster."
            accent="roster."
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 30,
              letterSpacing: "-.015em",
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--accent)",
              marginBottom: 14,
              fontSize: 13,
            }}
          >
            Could not load roster: {error}
          </div>
        )}

        {/* Unified stat strip — roster headcount + detection coverage. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <Stat label="Runners" value={total.toString()} />
          <Stat label="Photos" value={fmtCount(cov?.photos)} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
              <input
                className="input"
                type="search"
                placeholder="Search bib, name, or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, minWidth: 240, padding: "7px 10px", fontSize: 13 }}
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
                {filtered.length} of {data?.runners.length ?? 0}
              </span>
              {data?.officialResultsUrl && (
                <a
                  href={data.officialResultsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--ink)",
                    textDecoration: "none",
                    border: "1px solid var(--line)",
                    borderRadius: 5,
                    padding: "6px 10px",
                    whiteSpace: "nowrap",
                  }}
                  title="Verify finish times on the official timing site"
                >
                  Official results →
                </a>
              )}
            </div>

            {loading ? (
              <p style={{ color: "var(--muted)" }}>Loading roster…</p>
            ) : data?.runners.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No roster wired for this event yet.</p>
            ) : (
              <>
                <div
                  ref={tableRef}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 34px 1.6fr 56px 60px 50px 1fr 80px 70px",
                      gap: 10,
                      padding: "8px 12px",
                      background: "var(--cream)",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <SortBtn label="Bib" k="bib" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Face" k="face" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Name" k="name" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Race" k="race" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Sex" k="gender" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Age" k="age" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="City" k="city" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn label="Chip" k="chip" active={sort} dir={sortDir} onClick={toggleSort} />
                    <SortBtn
                      label="Photos"
                      k="photos"
                      active={sort}
                      dir={sortDir}
                      onClick={toggleSort}
                    />
                  </div>
                  {pageRows.map((r) => (
                    <div
                      key={r.bib}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 34px 1.6fr 56px 60px 50px 1fr 80px 70px",
                        gap: 10,
                        padding: "7px 12px",
                        borderBottom: "1px solid var(--line)",
                        fontSize: 13,
                        alignItems: "center",
                        cursor: "default",
                        background: "var(--surface)",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = "var(--cream)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.background = "var(--surface)")
                      }
                    >
                      {isOwner ? (
                        <Link
                          href={`/admin/roster/${r.bib}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--ink)",
                            textDecoration: "none",
                          }}
                        >
                          #{r.bib}
                        </Link>
                      ) : (
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                          #{r.bib}
                        </span>
                      )}
                      <FaceThumb face={r.face} name={r.name} />
                      {isOwner ? (
                        <Link
                          href={`/admin/roster/${r.bib}`}
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
                        >
                          {r.name}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--ink)" }}>{r.name}</span>
                      )}
                      <RaceBadge distance={r.distance} />
                      <span style={{ color: "var(--muted)" }}>{r.gender[0]}</span>
                      <span
                        style={{
                          color: "var(--muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.age}
                      </span>
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.city ? `${r.city}${r.state ? ", " + r.state : ""}` : "—"}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontVariantNumeric: "tabular-nums",
                          fontSize: 12,
                        }}
                      >
                        {r.chipTime}
                      </span>
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          color: r.photoCount === 0 ? "var(--line)" : "var(--ink)",
                        }}
                      >
                        {r.photoCount}
                      </span>
                    </div>
                  ))}
                </div>

                {pageCount > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 10,
                    }}
                  >
                    <PageBtn
                      label="←"
                      disabled={currentPage <= 1}
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
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
                        value={currentPage}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 1 && n <= pageCount) setPage(n);
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
                      disabled={currentPage >= pageCount}
                      onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                    />
                  </div>
                )}
              </>
            )}
      </div>
    </main>
  );
}

/** Row face cell: the runner's identified-face crop, or a dim placeholder when
 *  we haven't matched one. The filled vs empty circle is the at-a-glance
 *  "face identified" marker the roster scans for. */
function FaceThumb({
  face,
  name,
}: {
  face: { photoId: string; faceId: string } | null;
  name: string;
}) {
  const SIZE = 24;
  if (!face) {
    return (
      <span
        aria-label="No face identified"
        title="No face identified yet"
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: "50%",
          border: "1px dashed var(--line)",
          background: "var(--cream)",
          display: "inline-block",
        }}
      />
    );
  }
  return (
    <img
      src={`/api/photos/${face.photoId}/face/${face.faceId}`}
      alt={`${name} (identified face)`}
      title={`${name} — face identified`}
      loading="lazy"
      width={SIZE}
      height={SIZE}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        objectFit: "cover",
        display: "block",
        border: "1px solid var(--line)",
        background: "var(--cream)",
      }}
    />
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
  k: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
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
    >
      {label}
      {isActive ? (dir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

const RACE_STYLES: Record<DistanceKey, { color: string; bg: string }> = {
  "5k": { color: "#2f7d4f", bg: "rgba(47,125,79,.12)" },
  "10k": { color: "#2f6db0", bg: "rgba(47,109,176,.12)" },
  half: { color: "#c8401a", bg: "rgba(200,64,26,.12)" },
};

const RACE_RANK: Record<DistanceKey, number> = { "5k": 0, "10k": 1, half: 2 };

/** Color-coded race/distance chip (5K / 10K / Half). */
function RaceBadge({ distance }: { distance: DistanceKey }) {
  const s = RACE_STYLES[distance] ?? { color: "var(--muted)", bg: "var(--cream)" };
  return (
    <span
      title={DISTANCE_LABELS[distance] ?? distance}
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".06em",
        textTransform: "uppercase",
        color: s.color,
        background: s.bg,
        whiteSpace: "nowrap",
      }}
    >
      {DISTANCE_LABELS[distance] ?? distance}
    </span>
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
