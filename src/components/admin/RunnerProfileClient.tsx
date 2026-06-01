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
  /** Photos carrying this runner's bib. */
  bibPhotoCount: number;
  /** Photos with the confirmed face cluster but NOT the bib tag. */
  faceOnlyCount: number;
  /** The face cluster an owner CONFIRMED for this runner (authoritative), or
   *  null. When set, the profile unions bib ∪ this cluster's photos. */
  confirmedFaceClusterId: string | null;
  assignedFaceConfirmed: boolean;
  /** Confirmed face crop when one is set; otherwise the heuristic guess. */
  assignedFace: {
    faceClusterId: string;
    sample: { photoId: string; faceId: string };
    photoShare: number;
    photoCount: number;
  } | null;
};

export function RunnerProfileClient({ eventId, eventName, runner }: Props) {
  const [page, setPage] = useState(1); // client-side page over allPhotos
  const [allPhotos, setAllPhotos] = useState<DetailPhoto[]>([]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Face cleanup: pick a face cluster, then untag this bib from photos that
  // don't show that face (so only the real runner's photos remain). The picker
  // is revealed by clicking the runner's profile photo.
  const [showFacePicker, setShowFacePicker] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  // Persisting a human-confirmed face (the authoritative pick).
  const [savingFace, setSavingFace] = useState(false);
  // Once a face is confirmed we hide the candidate-face wall (no need to keep
  // showing "faces in these photos" — we've picked). "Change face" reveals it.
  const [changingFace, setChangingFace] = useState(false);
  // The cluster the owner has CONFIRMED for this runner (from the profile API).
  // When set, the grid below unions bib ∪ this cluster's photos.
  const confirmedClusterId = profile?.confirmedFaceClusterId ?? null;

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

  // Load EVERY photo for this runner (looping past the 96/page cap) so the
  // detail modal can page through all of them and the face tools can reason
  // over the whole set. When a face is CONFIRMED, the set is the union of
  // bib-tagged photos AND every photo carrying that face cluster — so face-only
  // shots (bib obscured) show up on the profile too, kept in capture order.
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const FETCH_PAGE = 96;
      // Fetch every page for a single coverage query (bib OR faceClusterId).
      const fetchAllPages = async (params: Record<string, string>): Promise<DetailPhoto[]> => {
        let pageN = 1;
        let pages = 1;
        let acc: DetailPhoto[] = [];
        do {
          const qs = new URLSearchParams({
            ...params,
            page: String(pageN),
            pageSize: String(FETCH_PAGE),
          });
          const r = await fetch(`/api/admin/coverage/photos?${qs}`, { cache: "no-store" });
          if (!r.ok) {
            const j = (await r.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error || `${r.status}`);
          }
          const d = (await r.json()) as PhotosResponse;
          acc = acc.concat(d.photos);
          pages = d.pageCount;
          pageN += 1;
        } while (pageN <= pages);
        return acc;
      };

      const bibPhotos = await fetchAllPages({ eventId, bib: String(runner.bib) });
      let union = bibPhotos;
      if (confirmedClusterId) {
        const facePhotos = await fetchAllPages({ eventId, faceClusterId: confirmedClusterId });
        const byId = new Map<string, DetailPhoto>();
        for (const p of bibPhotos) byId.set(p.id, p);
        for (const p of facePhotos) if (!byId.has(p.id)) byId.set(p.id, p);
        union = [...byId.values()];
        // Re-sort the merged set chronologically (each source was ordered, the
        // union isn't) — capture time, upload time as the tiebreaker.
        union.sort(
          (a, b) =>
            new Date(a.takenAt ?? a.createdAt).getTime() -
            new Date(b.takenAt ?? b.createdAt).getTime()
        );
      }
      setAllPhotos(union);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [eventId, runner.bib, confirmedClusterId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Keep the client-side page in range as the set shrinks (e.g. after removal).
  const total = allPhotos.length;
  // Source breakdown (replaces the old "distinct faces" stat): how many of the
  // shown photos carry the bib vs. came in by the confirmed face alone.
  // bibCount + faceOnlyCount === total.
  const bibCount = allPhotos.filter((p) =>
    (p.bibs ?? []).some((b) => b.bib === runner.bib)
  ).length;
  const faceOnlyCount = total - bibCount;
  const pageCount = Math.max(1, Math.ceil(total / PHOTO_PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pagePhotos = allPhotos.slice((page - 1) * PHOTO_PAGE_SIZE, page * PHOTO_PAGE_SIZE);

  // Face clusters present across all of this runner's photos (each photo counted
  // once per cluster), most-common first — drives the face picker.
  const clusters = useMemo(() => {
    const map = new Map<
      string,
      { clusterId: string; sample: { photoId: string; faceId: string }; count: number }
    >();
    for (const p of allPhotos) {
      const seen = new Set<string>();
      for (const f of p.faces ?? []) {
        if (!f.faceClusterId || seen.has(f.faceClusterId)) continue;
        seen.add(f.faceClusterId);
        const cur = map.get(f.faceClusterId);
        if (cur) cur.count += 1;
        else
          map.set(f.faceClusterId, {
            clusterId: f.faceClusterId,
            sample: { photoId: p.id, faceId: f.id },
            count: 1,
          });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [allPhotos]);

  const photoHasCluster = (p: DetailPhoto, clusterId: string) =>
    (p.faces ?? []).some((f) => f.faceClusterId === clusterId);
  const withoutSelectedFace = selectedCluster
    ? allPhotos.filter((p) => !photoHasCluster(p, selectedCluster))
    : [];

  // Persist (or clear) the human-confirmed face for this runner. This is the
  // authoritative pick: once saved, the profile unions bib ∪ face photos, the
  // roster count matches, and the public find-photos flow auto-expands by it
  // and skips the "Is this you?" prompt. Refetching the profile flips
  // confirmedClusterId, which re-runs fetchAll to pull in the face photos.
  async function confirmFace(clusterId: string | null) {
    setSavingFace(true);
    try {
      const r = await fetch(`/api/admin/roster/${runner.bib}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, faceClusterId: clusterId }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `${r.status}`);
      }
      setSelectedCluster(null);
      setChangingFace(false); // collapse the candidate wall after a pick/clear
      fetchProfile(); // updates confirmedFaceClusterId → triggers the union refetch
    } catch (e) {
      alert(`Could not save face: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingFace(false);
    }
  }

  async function removeWithoutFace() {
    if (!selectedCluster) return;
    const targets = withoutSelectedFace;
    if (targets.length === 0) return;
    const ok = window.confirm(
      `Untag bib #${runner.bib} from ${targets.length} photo${
        targets.length === 1 ? "" : "s"
      } that don't show this face?\n\nThey'll no longer appear for this runner. (The photos themselves aren't deleted.)`
    );
    if (!ok) return;
    setRemoving(true);
    try {
      await Promise.all(
        targets.map((p) =>
          fetch("/api/admin/coverage/photo-bib", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoId: p.id, bib: runner.bib }),
          })
        )
      );
      setSelectedCluster(null);
      await fetchAll();
    } catch (e) {
      alert(`Could not remove: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRemoving(false);
    }
  }

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      void fetchAll();
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
      void fetchAll();
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
      void fetchAll();
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
    const photo = allPhotos.find((p) => p.id === photoId);
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
      void fetchAll();
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
    void fetchAll();
  }

  const openPhoto = openId ? allPhotos.find((p) => p.id === openId) ?? null : null;

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
            <AssignedFaceThumb
              assigned={profile?.assignedFace ?? null}
              active={showFacePicker}
              onClick={() => setShowFacePicker((s) => !s)}
            />
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
          <Stat label="Photos" value={total.toString()} muted={total === 0} />
          <Stat
            label="From bib"
            value={bibCount.toString()}
            sub={`#${runner.bib}`}
            muted={bibCount === 0}
          />
          <Stat
            label="From face"
            value={faceOnlyCount.toString()}
            sub={confirmedClusterId ? "face only" : "no face set"}
            muted={faceOnlyCount === 0}
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

        {loading && total === 0 ? (
          <p style={{ color: "var(--muted)" }}>Loading photos…</p>
        ) : total === 0 ? (
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
            {/* Face picker — revealed by clicking the runner's profile photo.
                Pick this runner's face, then drop the bib photos that don't show
                it (bib-OCR false matches, other runners, etc.). */}
            {/* Candidate-face wall. Once a face is CONFIRMED we hide it (the
                "faces in these photos" grid is for picking — done once chosen);
                "Change face" on the status bar below re-reveals it. */}
            {showFacePicker &&
              clusters.length > 0 &&
              (!confirmedClusterId || changingFace) && (
                <FacePicker
                  clusters={clusters}
                  total={total}
                  selected={selectedCluster}
                  confirmed={confirmedClusterId}
                  onSelect={(id) => setSelectedCluster((cur) => (cur === id ? null : id))}
                />
              )}

            {/* Confirmed-face status — shown in the picker even with nothing
                actively selected, with a one-click clear (reverts to bib-only). */}
            {showFacePicker && confirmedClusterId && !selectedCluster && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "10px 14px",
                  marginBottom: 12,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  fontSize: 13,
                  color: "var(--ink)",
                }}
              >
                <span>
                  ✓ Face confirmed — this profile shows bib + face photos, and the
                  buyer flow skips the &ldquo;is this you?&rdquo; step for bib #{runner.bib}.
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setChangingFace((v) => !v)}
                    disabled={savingFace}
                  >
                    {changingFace ? "Done" : "Change face"}
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: "var(--accent)" }}
                    onClick={() => void confirmFace(null)}
                    disabled={savingFace}
                  >
                    {savingFace ? "…" : "Clear face"}
                  </button>
                </div>
              </div>
            )}

            {selectedCluster && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "10px 14px",
                  marginBottom: 12,
                  borderRadius: 8,
                  border: "1px solid var(--accent)",
                  background: "rgba(200,64,26,.05)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--ink)" }}>
                  This face is in{" "}
                  <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                    {total - withoutSelectedFace.length}
                  </strong>{" "}
                  of {total} photo{total === 1 ? "" : "s"}.
                  {confirmedClusterId === selectedCluster
                    ? " It's this runner's confirmed face."
                    : ""}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setSelectedCluster(null)}
                    disabled={removing || savingFace}
                  >
                    Clear
                  </button>
                  {/* Destructive cleanup (kept): untag the bib from photos that
                      don't show this face. Secondary to confirming. */}
                  <button
                    className="btn btn--ghost btn--sm"
                    style={{ color: "var(--accent)" }}
                    onClick={() => void removeWithoutFace()}
                    disabled={removing || savingFace || withoutSelectedFace.length === 0}
                  >
                    {removing
                      ? "Removing…"
                      : `Untag ${withoutSelectedFace.length} without this face`}
                  </button>
                  {/* Primary: confirm this as the runner's authoritative face. */}
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => void confirmFace(selectedCluster)}
                    disabled={savingFace || removing || confirmedClusterId === selectedCluster}
                  >
                    {confirmedClusterId === selectedCluster
                      ? "✓ This runner's face"
                      : savingFace
                        ? "Saving…"
                        : "Use as this runner's face"}
                  </button>
                </div>
              </div>
            )}

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
              {total.toLocaleString()} photo
              {total === 1 ? "" : "s"}
              {pageCount > 1 && ` · page ${page} of ${pageCount}`}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 6,
                opacity: loading ? 0.55 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {pagePhotos.map((p) => {
                const dim = selectedCluster ? !photoHasCluster(p, selectedCluster) : false;
                return (
                  <div
                    key={p.id}
                    onClick={() => setOpenId(p.id)}
                    style={{
                      position: "relative",
                      aspectRatio: "2 / 3",
                      background: "var(--cream)",
                      borderRadius: 3,
                      overflow: "hidden",
                      cursor: "pointer",
                      opacity: dim ? 0.4 : 1,
                      transition: "opacity 0.15s",
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
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                    {dim && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(28,26,23,.72)",
                          color: "#fff",
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                        }}
                      >
                        no match
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {pageCount > 1 && (
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

      {openPhoto && (
        <PhotoDetailModal
          photos={allPhotos}
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
 * Face picker — one circular thumbnail per distinct face cluster found across
 * the runner's photos, most-common first. Tapping one selects it; the caller
 * then offers to drop every photo that doesn't show that face.
 */
function FacePicker({
  clusters,
  total,
  selected,
  confirmed,
  onSelect,
}: {
  clusters: { clusterId: string; sample: { photoId: string; faceId: string }; count: number }[];
  /** Total photos for this runner — denominator for the likelihood %. */
  total: number;
  selected: string | null;
  /** The currently-confirmed cluster (badged with a ✓), or null. */
  confirmed: string | null;
  onSelect: (clusterId: string) => void;
}) {
  // Crowd shots can spawn dozens of one-off clusters (bystanders). The runner's
  // own face is the most common, so show the top handful (already sorted by
  // count = likelihood, most-likely first) — enough to pick the runner without
  // a wall of stranger thumbnails.
  const MAX = 12;
  const shown = clusters.slice(0, MAX);
  const extra = clusters.length - shown.length;
  return (
    <div style={{ marginBottom: 14 }}>
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
        Faces in these photos — most likely first · tap one to set this runner&rsquo;s face
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        {shown.map((c) => {
          const active = selected === c.clusterId;
          const isConfirmed = confirmed === c.clusterId;
          const likelihood = total > 0 ? Math.round((c.count / total) * 100) : 0;
          return (
            <button
              key={c.clusterId}
              type="button"
              onClick={() => onSelect(c.clusterId)}
              title={
                isConfirmed
                  ? `This runner's confirmed face · in ${c.count} of ${total} photos`
                  : `In ${c.count} of ${total} photos · ${likelihood}% likely this runner`
              }
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: 2,
                border: 0,
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  position: "relative",
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "var(--cream)",
                  border:
                    active || isConfirmed
                      ? "3px solid var(--accent)"
                      : "2px solid var(--line)",
                  boxShadow: active || isConfirmed ? "var(--shadow)" : "none",
                }}
              >
                {isConfirmed && (
                  <span
                    aria-hidden
                    title="Confirmed face"
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      background: "var(--accent)",
                      color: "var(--paper)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      lineHeight: 1,
                      zIndex: 1,
                      boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                    }}
                  >
                    ✓
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${c.sample.photoId}/face/${c.sample.faceId}`}
                  alt=""
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                  color: active ? "var(--accent)" : "var(--ink)",
                }}
              >
                {likelihood}%
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--muted)",
                  marginTop: -2,
                }}
              >
                {c.count} pic{c.count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
        {extra > 0 && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            +{extra} more
          </span>
        )}
      </div>
    </div>
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
  active,
  onClick,
}: {
  assigned: {
    faceClusterId: string;
    sample: { photoId: string; faceId: string };
    photoShare: number;
    photoCount: number;
  } | null;
  /** Whether the face picker it opens is currently shown. */
  active?: boolean;
  /** Click to reveal/hide the face picker. */
  onClick?: () => void;
}) {
  if (!assigned) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Pick this runner's face to clean up their photos"
        style={{
          width: 72,
          height: 72,
          background: "var(--cream)",
          border: active ? "2px solid var(--accent)" : "1px dashed var(--line)",
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
          cursor: "pointer",
          padding: 0,
        }}
      >
        pick
        <br />
        face
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to pick this runner's face and clean up their photos"
      style={{
        position: "relative",
        width: 72,
        height: 72,
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--cream)",
        border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
        cursor: "pointer",
        padding: 0,
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
    </button>
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
