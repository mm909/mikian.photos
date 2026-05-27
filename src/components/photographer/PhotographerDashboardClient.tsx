"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { LibraryTile } from "@/components/photographer/LibraryTile";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";

type Props = {
  /** First name to greet with. Passed from the server actor lookup. */
  name: string;
  /** Email shown in the mono "Photographer · …" chip above the headline. */
  email: string;
};

/**
 * Photographer dashboard — the "your race-day gallery" landing page.
 *
 * It's intentionally a near-clone of the Library experience (same tile, same
 * click-to-modal, same ⋯ hover menu) but always scoped to the signed-in user's
 * own uploads — even for owner. Owner gets a separate Library route to see
 * every photographer's work.
 *
 * Why the duplication-ish: keeping the dashboard as its own component lets
 * us add dashboard-only things later (sales, payouts, route-map of where you
 * shot from) without bloating the admin Library client.
 */
export function PhotographerDashboardClient({ name, email }: Props) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<DetailPhoto[]>([]);

  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      // mine=1 forces owner to see only their own uploads here. Non-owners
      // already get scoped to themselves server-side.
      const r = await fetch("/api/photographer/photos/catalog?mine=1", {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`catalog ${r.status}`);
      const d = (await r.json()) as { photos: DetailPhoto[] };
      setPhotos(d.photos);
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
      setTimeout(() => setRerun((s) => ({ ...s, [photoId]: "idle" })), 1800);
    } catch (e) {
      console.error(e);
      setRerun((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function deletePhoto(photoId: string) {
    setDelState((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `delete ${r.status}`);
      }
      setOpenId((curr) => (curr === photoId ? null : curr));
      setPhotos((curr) => curr.filter((p) => p.id !== photoId));
      setDelState((s) => {
        const next = { ...s };
        delete next[photoId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setDelState((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  async function toggleHidden(photoId: string) {
    const photo = photos.find((p) => p.id === photoId);
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
      setPhotos((curr) =>
        curr.map((p) => (p.id === photoId ? { ...p, hidden: nextHidden } : p))
      );
      setHideStateMap((s) => {
        const next = { ...s };
        delete next[photoId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setHideStateMap((s) => ({ ...s, [photoId]: "err" }));
    }
  }

  // Visible-only by default; hidden photos still counted in stats but not in grid.
  const visiblePhotos = useMemo(() => photos.filter((p) => !p.hidden), [photos]);

  const counts = useMemo(() => {
    const total = photos.length;
    const visible = visiblePhotos.length;
    const hidden = total - visible;
    return { total, visible, hidden };
  }, [photos, visiblePhotos]);

  const openPhoto = openId ? photos.find((p) => p.id === openId) ?? null : null;
  const firstName = name.split(" ")[0] || name;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 32,
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
                marginBottom: 6,
              }}
            >
              Photographer · {email}
            </div>
            <Headline
              as="h1"
              text={`Hi, ${firstName}.`}
              accent={firstName}
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 44,
                letterSpacing: "-.018em",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/photographer/upload" className="btn btn--primary">
              Upload photos →
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Stat label="Uploaded" value={counts.total.toString()} />
          <Stat label="Visible" value={counts.visible.toString()} />
          <Stat label="Hidden" value={counts.hidden.toString()} />
          <Stat label="Sales (coming)" value="—" muted />
        </div>

        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 22,
            margin: "0 0 14px",
            color: "var(--ink)",
          }}
        >
          Your uploads
        </h2>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading…</p>
        ) : visiblePhotos.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              color: "var(--muted)",
              fontSize: 15,
            }}
          >
            Nothing here yet. Drop your first batch via the upload button above.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 4,
            }}
          >
            {visiblePhotos.map((p) => (
              <LibraryTile
                key={p.id}
                p={p}
                running={rerun[p.id] === "running"}
                deleteState={delState[p.id] ?? "idle"}
                onOpen={() => setOpenId(p.id)}
                onRerun={() => rerunOcr(p.id)}
                onToggleHidden={() => toggleHidden(p.id)}
                onAskDelete={() =>
                  setDelState((s) => ({
                    ...s,
                    [p.id]: s[p.id] === "confirm" ? "idle" : "confirm",
                  }))
                }
                onConfirmDelete={() => deletePhoto(p.id)}
                onCancelDelete={() => setDelState((s) => ({ ...s, [p.id]: "idle" }))}
              />
            ))}
          </div>
        )}
      </div>

      {openPhoto && (
        <PhotoDetailModal
          photo={openPhoto}
          rerunState={rerun[openPhoto.id] ?? "idle"}
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
        />
      )}
    </main>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        opacity: muted ? 0.6 : 1,
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
          fontSize: 28,
          marginTop: 2,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
