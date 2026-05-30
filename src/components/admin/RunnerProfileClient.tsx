"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";
import type { LighthouseRacer } from "@/lib/lighthouseRoster";

type PhotosResponse = {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  photos: DetailPhoto[];
};

type Props = {
  eventId: string;
  eventName: string;
  runner: LighthouseRacer;
};

const PHOTO_PAGE_SIZE = 24;

/**
 * Per-runner profile.
 *
 * Header with name + age/gender + city + chip time + photo-count badge.
 * Below: paginated grid of every photo carrying this runner's bib, with
 * the full PhotoDetailModal on click (arrow nav across the current page,
 * face view, OCR view, untag bib, hide/delete, rerun OCR/face).
 *
 * Photos are fetched via the same /api/admin/coverage/photos endpoint
 * the coverage screen uses — we just hard-code the bib filter.
 */
type ProfileResponse = {
  event: { id: string; name: string };
  photoCount: number;
  clusterCount: number;
  /** Heuristic-picked face cluster for this runner (most photos, then
   *  highest confidence). null until face detection produces clusters. */
  assignedFace: {
    faceClusterId: string;
    sample: { photoId: string; faceId: string };
    photoShare: number;
    photoCount: number;
  } | null;
};

export function RunnerProfileClient({ eventId, eventName, runner }: Props) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PhotosResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state mirrors CoverageClient.
  const [openId, setOpenId] = useState<string | null>(null);
  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [rerunFace, setRerunFace] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});

  // Profile fetch — once on mount; refetch on photo mutations so the
  // assigned-face thumbnail updates if the underlying clusters shift.
  const fetchProfile = useCallback(() => {
    let cancelled = false;
    fetch(`/api/admin/roster/${runner.bib}?eventId=${encodeURIComponent(eventId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d: ProfileResponse) => {
        if (!cancelled) setProfile(d);
      })
      .catch((e) => console.warn("profile fetch failed:", e));
    return () => {
      cancelled = true;
    };
  }, [eventId, runner.bib]);

  useEffect(() => {
    const cancel = fetchProfile();
    return cancel;
  }, [fetchProfile]);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams({
      eventId,
      bib: String(runner.bib),
      page: String(page),
      pageSize: String(PHOTO_PAGE_SIZE),
    });
    return qs.toString();
  }, [eventId, runner.bib, page]);

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

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      refetch();
      setRerun((s) => ({ ...s, [photoId]: "ok" }));
      setTimeout(() => setRerun((s) => ({ ...s, [photoId]: "idle" })), 1500);
    } catch (e) {
      console.error(e);
      setRerun((s) => ({ ...s, [photoId]: "err" }));
    }
  }

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

  async function untagBib(photoId: string, bib: number) {
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
  }

  const openPhoto = openId ? data?.photos.find((p) => p.id === openId) ?? null : null;

  return (
    <main className="screen" style={{ padding: "28px 24px 64px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Breadcrumb + header */}
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/admin/roster"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            ← Roster · {eventName}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Assigned face thumbnail (one per runner, picked by the
                "most-common cluster" heuristic on the server). Renders
                an empty cream placeholder until face detection produces
                clusters for this runner. */}
            <AssignedFaceThumb assigned={profile?.assignedFace ?? null} />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                Bib #{runner.bib} · {runner.gender} {runner.age}
                {runner.city ? ` · ${runner.city}${runner.state ? ", " + runner.state : ""}` : ""}
            </div>
              <Headline
                as="h1"
                text={runner.name}
                accent={runner.name.split(" ").pop() ?? runner.name}
                style={{
                  margin: 0,
                  fontFamily: "var(--font-serif)",
                  fontWeight: 500,
                  fontSize: 34,
                  letterSpacing: "-.015em",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/admin/coverage`}
              className="btn btn--ghost btn--sm"
              style={{ textDecoration: "none" }}
            >
              Coverage view →
            </Link>
          </div>
        </div>

        {/* Stat strip — chip time + photo/face counts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Stat label="Chip time" value={runner.chipTime} />
          <Stat
            label="Photos"
            value={data ? data.total.toString() : "—"}
            muted={data?.total === 0}
          />
          <Stat
            label="Faces"
            value={
              data
                ? new Set(
                    data.photos.flatMap((p) =>
                      (p.faces ?? []).map((f) => f.faceClusterId ?? f.id)
                    )
                  ).size.toString()
                : "—"
            }
            sub="this page"
            muted
          />
        </div>

        {/* Photo grid */}
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
            Could not load photos: {error}
          </div>
        )}

        {loading && !data ? (
          <p style={{ color: "var(--muted)" }}>Loading photos…</p>
        ) : !data || data.total === 0 ? (
          <div
            style={{
              padding: "32px 24px",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
            }}
          >
            No photos tagged with bib #{runner.bib} yet.
          </div>
        ) : (
          <>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              {data.total.toLocaleString()} photo
              {data.total === 1 ? "" : "s"}
              {data.pageCount > 1 && ` · page ${data.page} of ${data.pageCount}`}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 6,
                opacity: loading ? 0.55 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {data.photos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setOpenId(p.id)}
                  style={{
                    aspectRatio: "3 / 2",
                    background: "var(--cream)",
                    borderRadius: 3,
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
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
                </div>
              ))}
            </div>

            {data.pageCount > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                }}
              >
                <PageBtn
                  label="←"
                  disabled={data.page <= 1}
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
                    max={data.pageCount}
                    value={data.page}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n >= 1 && n <= data.pageCount) setPage(n);
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
                  / {data.pageCount}
                </label>
                <PageBtn
                  label="→"
                  disabled={data.page >= data.pageCount}
                  onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))}
                />
              </div>
            )}
          </>
        )}
      </div>

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
          onUntagBib={(bib) => untagBib(openPhoto.id, bib)}
        />
      )}
    </main>
  );
}

/**
 * Assigned-face thumbnail on the runner header.
 *
 * Renders the server-cropped face image when face detection has produced
 * a cluster for this runner; otherwise an empty placeholder with a
 * "no face" affordance so the layout doesn't jump when faces eventually
 * land.
 *
 * Tooltip shows the share of photos that voted for this cluster — useful
 * to spot weak assignments (e.g. 1/8 photos = picked from a crowd shot).
 */
function AssignedFaceThumb({
  assigned,
}: {
  assigned: {
    faceClusterId: string;
    sample: { photoId: string; faceId: string };
    photoShare: number;
    photoCount: number;
  } | null;
}) {
  if (!assigned) {
    return (
      <div
        title="No face assigned yet — run face detection on this runner's photos"
        style={{
          width: 72,
          height: 72,
          background: "var(--cream)",
          border: "1px dashed var(--line)",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--muted)",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        no face
        <br />
        yet
      </div>
    );
  }
  return (
    <div
      title={`Cluster ${assigned.faceClusterId.slice(0, 14)}… · ${assigned.photoCount} photo${
        assigned.photoCount === 1 ? "" : "s"
      }`}
      style={{
        position: "relative",
        width: 72,
        height: 72,
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--cream)",
        border: "1px solid var(--line)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${assigned.sample.photoId}/face/${assigned.sample.faceId}`}
        alt=""
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
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
        opacity: muted ? 0.65 : 1,
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
