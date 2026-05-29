"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";

type Runner = {
  bib: number;
  name: string;
  gender: "Male" | "Female";
  age: number;
  city: string;
  state: string;
  chipTime: string;
  chipMinutes: number;
  photoCount: number;
  faceCount: number;
};

type RosterResponse = {
  event: { id: string; name: string };
  runners: Runner[];
  officialResultsUrl: string | null;
};

type SortKey = "bib" | "name" | "gender" | "age" | "city" | "chip" | "photos" | "faces";

const ROW_PAGE_SIZE = 50;

type Props = { defaultEventId: string; defaultEventName: string };

/**
 * Roster screen — searchable, sortable list of every entrant joined with
 * per-runner photo + face counts. Helpful for spot-checking detection
 * coverage by runner identity (the coverage screen does it by bib).
 *
 * Owner-only. Click the offical-results link to verify a runner's time on
 * the third-party timing site.
 */
export function RosterClient({ defaultEventId, defaultEventName }: Props) {
  const [eventId] = useState(defaultEventId);
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("bib");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

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
        case "faces":
          return (a.faceCount - b.faceCount) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / ROW_PAGE_SIZE));
  const pageStart = (page - 1) * ROW_PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + ROW_PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sort === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setSortDir(k === "name" || k === "gender" || k === "city" || k === "bib" ? "asc" : "desc");
    }
  }

  // Aggregate summary above the table.
  const total = sorted.length;
  const withPhotos = sorted.filter((r) => r.photoCount > 0).length;
  const withoutPhotos = total - withPhotos;

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
            Owner · Roster · {data?.event.name ?? defaultEventName}
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <Stat label="Runners" value={total.toString()} />
          <Stat
            label="With photos"
            value={`${withPhotos}`}
            sub={total ? `${Math.round((withPhotos / total) * 100)}%` : "—"}
          />
          <Stat
            label="Missing photos"
            value={`${withoutPhotos}`}
            sub={total ? `${Math.round((withoutPhotos / total) * 100)}%` : "—"}
            muted={withoutPhotos === 0}
          />
          {data?.officialResultsUrl ? (
            <a
              href={data.officialResultsUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                textDecoration: "none",
                color: "var(--ink)",
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
                Verify times
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--ink)",
                  marginTop: 2,
                }}
              >
                Official results →
              </div>
            </a>
          ) : (
            <Stat label="Verify times" value="—" sub="no source" muted />
          )}
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
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading roster…</p>
        ) : data?.runners.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No roster wired for this event yet.</p>
        ) : (
          <>
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "60px 1.6fr 60px 50px 1fr 80px 70px 70px",
                  gap: 10,
                  padding: "8px 12px",
                  background: "var(--cream)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <SortBtn label="Bib" k="bib" active={sort} dir={sortDir} onClick={toggleSort} />
                <SortBtn label="Name" k="name" active={sort} dir={sortDir} onClick={toggleSort} />
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
                <SortBtn
                  label="Faces"
                  k="faces"
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
                    gridTemplateColumns:
                      "60px 1.6fr 60px 50px 1fr 80px 70px 70px",
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
                  <Link
                    href={`/admin/roster/${r.bib}`}
                    style={{
                      color: "var(--ink)",
                      textDecoration: "none",
                      // Subtle hint that the row is clickable — underline
                      // on hover, no underline otherwise (keeps the table
                      // visually quiet).
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                        "underline")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                        "none")
                    }
                  >
                    {r.name}
                  </Link>
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
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      color: r.faceCount === 0 ? "var(--line)" : "var(--ink)",
                    }}
                  >
                    {r.faceCount}
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
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
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
