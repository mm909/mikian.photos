"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";

type BibTag = {
  id: string;
  bib: number;
  confidence: number;
  source: string;
  createdAt: string;
};

type AdminPhoto = {
  id: string;
  eventId: string;
  mile: number | null;
  gps: [number, number] | null;
  takenAt: string | null;
  createdAt: string;
  hidden: boolean;
  photographer: { id: string; name: string; email: string };
  bibs: BibTag[];
  previewUrl: string;
  r2OriginalKey: string;
  r2PreviewKey: string;
};

type RerunState = "idle" | "running" | "ok" | "err";

export function PhotosAdminClient() {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, found: 0 });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tagged" | "untagged" | "hidden">("all");

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/photographer/photos/catalog", { cache: "no-store" });
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      const d = (await r.json()) as { photos: AdminPhoto[]; isAdmin: boolean };
      setPhotos(d.photos);
      setIsAdmin(d.isAdmin);
    } catch (e) {
      console.error(e);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      const d = (await r.json()) as { detected: { bib: number; confidence: number }[] };
      // Patch local row with new bibs (replacing ocr-tesseract entries)
      setPhotos((curr) =>
        curr.map((p) =>
          p.id === photoId
            ? {
                ...p,
                bibs: [
                  ...p.bibs.filter((b) => !b.source.startsWith("ocr-")),
                  ...d.detected.map((x) => ({
                    id: `tmp-${x.bib}`,
                    bib: x.bib,
                    confidence: x.confidence,
                    source: "ocr-tesseract",
                    createdAt: new Date().toISOString(),
                  })),
                ].sort((a, b) => b.confidence - a.confidence),
              }
            : p
        )
      );
      setRerun((s) => ({ ...s, [photoId]: "ok" }));
      // Drop the "ok" badge after a moment
      setTimeout(() => setRerun((s) => ({ ...s, [photoId]: "idle" })), 1800);
    } catch (e) {
      console.error(e);
      setRerun((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function rerunAll() {
    const ids = filteredPhotos.map((p) => p.id);
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: ids.length, found: 0 });
    let foundTotal = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await fetch(`/api/photographer/photos/${id}/rerun-ocr`, {
          method: "POST",
        });
        if (r.ok) {
          const d = (await r.json()) as { total: number };
          foundTotal += d.total;
        }
      } catch {
        /* keep going */
      }
      setBulkProgress({ done: i + 1, total: ids.length, found: foundTotal });
    }
    setBulkRunning(false);
    await fetchCatalog();
  }

  const filteredPhotos = useMemo(() => {
    const s = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (filter === "tagged" && p.bibs.length === 0) return false;
      if (filter === "untagged" && p.bibs.length > 0) return false;
      if (filter === "hidden" && !p.hidden) return false;
      if (filter !== "hidden" && p.hidden) return false; // hide hidden by default
      if (!s) return true;
      if (p.id.toLowerCase().includes(s)) return true;
      if (p.bibs.some((b) => String(b.bib).includes(s))) return true;
      if (p.photographer.name.toLowerCase().includes(s)) return true;
      return false;
    });
  }, [photos, search, filter]);

  const counts = useMemo(() => {
    const total = photos.length;
    const tagged = photos.filter((p) => p.bibs.length > 0).length;
    const ocrTagged = photos.filter((p) =>
      p.bibs.some((b) => b.source.startsWith("ocr-"))
    ).length;
    const hidden = photos.filter((p) => p.hidden).length;
    return { total, tagged, untagged: total - tagged, ocrTagged, hidden };
  }, [photos]);

  return (
    <main className="screen" style={{ padding: "40px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              {isAdmin ? "Admin — all photographers" : "Your uploads"}
            </div>
            <Headline
              as="h1"
              text="Photo library."
              accent="library."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 36,
                letterSpacing: "-.015em",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/photographer" className="btn btn--ghost">
              ← Dashboard
            </Link>
            <Link href="/photographer/upload" className="btn btn--primary">
              Upload →
            </Link>
          </div>
        </div>

        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <Stat label="Total" value={counts.total.toString()} />
          <Stat label="Bib-tagged" value={counts.tagged.toString()} />
          <Stat label="OCR detected" value={counts.ocrTagged.toString()} />
          <Stat label="Untagged" value={counts.untagged.toString()} muted />
          <Stat label="Hidden" value={counts.hidden.toString()} muted />
        </div>

        {/* Filter + actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="Search bib, photo ID, photographer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: "8px 12px", fontSize: 14 }}
          />
          <div
            role="tablist"
            style={{
              display: "flex",
              border: "1px solid var(--line)",
              borderRadius: 6,
              background: "var(--cream)",
              padding: 2,
            }}
          >
            {(["all", "tagged", "untagged", "hidden"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                aria-selected={filter === k}
                style={{
                  padding: "6px 12px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  background: filter === k ? "var(--surface)" : "transparent",
                  border: 0,
                  color: filter === k ? "var(--ink)" : "var(--muted)",
                  cursor: "pointer",
                  borderRadius: 4,
                }}
              >
                {k}
              </button>
            ))}
          </div>
          <button
            className="btn btn--ghost"
            onClick={rerunAll}
            disabled={bulkRunning || filteredPhotos.length === 0}
            title="Re-run bib OCR on every photo in the current filter"
          >
            {bulkRunning
              ? `Re-running ${bulkProgress.done}/${bulkProgress.total} (+${bulkProgress.found} bibs)`
              : `Re-run OCR on ${filteredPhotos.length}`}
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : filteredPhotos.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No photos match this filter.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {filteredPhotos.map((p) => (
              <PhotoCard
                key={p.id}
                p={p}
                rerunState={rerun[p.id] ?? "idle"}
                onRerun={() => rerunOcr(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PhotoCard({
  p,
  rerunState,
  onRerun,
}: {
  p: AdminPhoto;
  rerunState: RerunState;
  onRerun: () => void;
}) {
  const ocrBibs = p.bibs.filter((b) => b.source.startsWith("ocr-"));
  const manualBibs = p.bibs.filter((b) => b.source === "manual" || b.source === "user-tag");
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "3 / 2", background: "var(--cream)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={p.previewUrl}
          alt={p.bibs.length ? `Bibs ${p.bibs.map((b) => b.bib).join(", ")}` : "Race photo"}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {p.hidden && (
          <span
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              background: "var(--ink)",
              color: "var(--paper)",
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            Hidden
          </span>
        )}
      </div>

      <div style={{ padding: 12 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.id.slice(0, 14)}…
          </span>
          <span>{p.photographer.name}</span>
        </div>

        <BibChips manual={manualBibs} ocr={ocrBibs} />

        <Meta label="Taken" value={fmtDate(p.takenAt)} />
        <Meta label="GPS" value={p.gps ? `${p.gps[0].toFixed(4)}, ${p.gps[1].toFixed(4)}` : "—"} />
        <Meta label="Face match" value="not yet built" muted />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={onRerun}
            disabled={rerunState === "running"}
            style={{ flex: 1 }}
          >
            {rerunState === "running"
              ? "Running…"
              : rerunState === "ok"
                ? "✓ Updated"
                : rerunState === "err"
                  ? "Failed — retry"
                  : "Re-run bib OCR"}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            disabled
            title="Face detection isn't built yet"
            style={{ flex: 1, opacity: 0.55, cursor: "not-allowed" }}
          >
            Re-run face
          </button>
        </div>
      </div>
    </div>
  );
}

function BibChips({ manual, ocr }: { manual: BibTag[]; ocr: BibTag[] }) {
  if (manual.length === 0 && ocr.length === 0) {
    return (
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        No bibs detected
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {manual.map((b) => (
        <Chip key={b.id} text={`#${b.bib}`} color="ink" title={`manual · ${b.source}`} />
      ))}
      {ocr.map((b) => (
        <Chip
          key={b.id}
          text={`#${b.bib} · ${Math.round(b.confidence * 100)}%`}
          color="accent"
          title={`${b.source} · conf ${(b.confidence * 100).toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

function Chip({ text, color, title }: { text: string; color: "ink" | "accent"; title?: string }) {
  const bg = color === "ink" ? "var(--ink)" : "var(--accent)";
  return (
    <span
      title={title}
      style={{
        display: "inline-block",
        padding: "3px 8px",
        background: bg,
        color: "var(--paper)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".08em",
        borderRadius: 4,
      }}
    >
      {text}
    </span>
  );
}

function Meta({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "baseline",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "var(--muted)",
        marginTop: 4,
      }}
    >
      <span style={{ width: 60, color: muted ? "var(--line)" : "var(--muted)" }}>{label}</span>
      <span style={{ color: muted ? "var(--line)" : "var(--ink)" }}>{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "10px 12px",
        opacity: muted ? 0.7 : 1,
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
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 22,
          color: "var(--ink)",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
