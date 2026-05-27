"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Headline } from "@/components/runner/Headline";
import { LibraryTile, type LibraryTilePhoto } from "@/components/photographer/LibraryTile";
import {
  PhotoDetailModal,
  type DeleteState,
  type DetailPhoto,
  type HideState,
  type RerunState,
} from "@/components/photographer/PhotoDetailModal";

type EventLite = { id: string; name: string; date: string; city: string };

type Status = "queued" | "uploading" | "done" | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  status: Status;
  photoId?: string;
  // We intentionally don't surface error strings per-file; aggregate counts only.
  errored: boolean;
  // Set true once the server preview is reachable. Tile then swaps from the
  // local blob URL to /api/photos/[id]/preview so OCR / hide updates land.
  serverReady?: boolean;
  // Hidden flag mirrors the server row. Lets us optimistically dim the tile
  // when the photographer hides a just-uploaded photo without refetching.
  hidden?: boolean;
};

const CONCURRENCY = 3;

export function UploadClient({ event }: { event: EventLite }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [isRunning, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-photo action state + detail-modal data, mirroring the library page.
  const [rerun, setRerun] = useState<Record<string, RerunState>>({});
  const [delState, setDelState] = useState<Record<string, DeleteState>>({});
  const [hideStateMap, setHideStateMap] = useState<Record<string, HideState>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailPhoto, setDetailPhoto] = useState<DetailPhoto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        uid: `q-${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: "queued",
        errored: false,
      }));
    setItems((curr) => [...curr, ...next]);
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function removeAllDone() {
    setItems((curr) => {
      curr.filter((i) => i.status === "done").forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return curr.filter((i) => i.status !== "done");
    });
  }

  function clearAll() {
    setItems((curr) => {
      curr.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return [];
    });
  }

  async function uploadOne(item: QueueItem): Promise<void> {
    updateItem(item.uid, { status: "uploading", errored: false });

    // 1) sign — server makes a Photo placeholder + returns a presigned PUT URL
    const signRes = await fetch("/api/photographer/photos/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, contentType: item.file.type || "image/jpeg" }),
    });
    if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
    const { photoId, uploadUrl } = (await signRes.json()) as {
      photoId: string;
      uploadUrl: string;
    };

    // 2) direct browser PUT to R2 — bypasses Vercel's 4.5MB body limit
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: item.file,
      headers: { "Content-Type": item.file.type || "image/jpeg" },
    });
    if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);

    // 3) finalize — server pulls original from R2, makes preview, reads EXIF
    const finRes = await fetch("/api/photographer/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (!finRes.ok) throw new Error(`finalize ${finRes.status}`);

    updateItem(item.uid, { status: "done", photoId, serverReady: true, hidden: false });
  }

  async function processUntilEmpty() {
    setRunning(true);
    try {
      // Work-stealing pool: keep CONCURRENCY uploads in flight until the queue
      // (plus retries) drains.
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
    } finally {
      setRunning(false);
    }
  }

  async function worker() {
    // Each worker pulls the next queued or errored item until none remain.
    // We re-read state via the setter pattern so multiple workers cooperate.
    while (true) {
      const next: QueueItem | undefined = await new Promise((resolve) => {
        setItems((curr) => {
          const target = curr.find((i) => i.status === "queued");
          if (!target) {
            resolve(undefined);
            return curr;
          }
          resolve(target);
          // Mark as uploading so other workers skip it
          return curr.map((i) => (i.uid === target.uid ? { ...i, status: "uploading" } : i));
        });
      });
      if (!next) return;
      try {
        await uploadOne(next);
      } catch {
        updateItem(next.uid, { status: "error", errored: true });
      }
    }
  }

  async function retryFailed() {
    setItems((curr) =>
      curr.map((i) => (i.status === "error" ? { ...i, status: "queued", errored: false } : i))
    );
    await processUntilEmpty();
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Per-photo actions on completed uploads — mirrors PhotosAdminClient so
   * the user can rerun OCR, hide, or delete a just-uploaded photo without
   * leaving this page. Detail modal opens on tile click and lazy-loads
   * the full DetailPhoto from /api/photographer/photos/[id].
   * ────────────────────────────────────────────────────────────────────── */

  async function openDetail(photoId: string) {
    setOpenId(photoId);
    setDetailLoading(true);
    setDetailPhoto(null);
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`get ${r.status}`);
      const d = (await r.json()) as { photo: DetailPhoto };
      setDetailPhoto(d.photo);
    } catch (e) {
      console.error(e);
      // Close on failure — better than leaving an empty modal hanging.
      setOpenId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setOpenId(null);
    setDetailPhoto(null);
  }

  async function rerunOcr(photoId: string) {
    setRerun((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}/rerun-ocr`, { method: "POST" });
      if (!r.ok) throw new Error(`rerun ${r.status}`);
      // If the detail modal is open on this photo, refetch to reflect new bibs.
      if (openId === photoId) {
        const re = await fetch(`/api/photographer/photos/${photoId}`, { cache: "no-store" });
        if (re.ok) {
          const d = (await re.json()) as { photo: DetailPhoto };
          setDetailPhoto(d.photo);
        }
      }
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
      // Drop from the queue + close the modal if it's open on this photo.
      if (openId === photoId) closeDetail();
      setItems((curr) => {
        const target = curr.find((i) => i.photoId === photoId);
        if (target) URL.revokeObjectURL(target.previewUrl);
        return curr.filter((i) => i.photoId !== photoId);
      });
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

  async function toggleHidden(photoId: string, currentHidden: boolean) {
    const nextHidden = !currentHidden;
    setHideStateMap((s) => ({ ...s, [photoId]: "running" }));
    try {
      const r = await fetch(`/api/photographer/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: nextHidden }),
      });
      if (!r.ok) throw new Error(`patch ${r.status}`);
      // Reflect optimistically in the queue + open modal.
      setItems((curr) =>
        curr.map((i) => (i.photoId === photoId ? { ...i, hidden: nextHidden } : i))
      );
      setDetailPhoto((curr) =>
        curr && curr.id === photoId ? { ...curr, hidden: nextHidden } : curr
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

  // Aggregate counts + progress
  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const flight = items.filter((i) => i.status === "uploading").length;
  const failed = items.filter((i) => i.status === "error").length;
  const queued = items.filter((i) => i.status === "queued").length;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
  const isFinished = total > 0 && queued === 0 && flight === 0;

  const failedLabel = useMemo(() => {
    if (failed === 0) return "";
    return `${failed} failed`;
  }, [failed]);

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 28,
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
              {event.name} · {event.city}
            </div>
            <Headline
              as="h1"
              text="Upload your photos."
              accent="your photos."
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: 40,
                letterSpacing: "-.015em",
                lineHeight: 1.05,
              }}
            />
          </div>
          <Link href="/photographer" className="btn btn--ghost">
            ← Back to dashboard
          </Link>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          style={{
            border: `2px dashed ${isDragging ? "var(--accent)" : "var(--line)"}`,
            background: isDragging ? "rgba(200,64,26,.04)" : "var(--cream)",
            borderRadius: 12,
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition:
              "background var(--dur-hover) var(--ease), border-color var(--dur-hover) var(--ease)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 22,
              color: "var(--ink)",
              marginBottom: 6,
              letterSpacing: "-.005em",
            }}
          >
            Drop photos here, or click to choose
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            JPEG or HEIC. EXIF GPS + time are read automatically. Large files OK.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Aggregate status bar + actions */}
        {items.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {done}/{total} uploaded
                {flight > 0 ? ` · ${flight} in flight` : ""}
                {queued > 0 && !isRunning ? ` · ${queued} queued` : ""}
                {failedLabel ? ` · ${failedLabel}` : ""}
              </div>
              <span style={{ flex: 1 }} />
              {failed > 0 && !isRunning && (
                <button className="btn btn--ghost" onClick={retryFailed}>
                  Retry {failed}
                </button>
              )}
              {done > 0 && !isRunning && (
                <button className="btn btn--ghost" onClick={removeAllDone}>
                  Clear uploaded
                </button>
              )}
              {isFinished && (
                <button className="btn btn--ghost" onClick={clearAll}>
                  Clear all
                </button>
              )}
              {!isFinished && (
                <button
                  className="btn btn--primary"
                  disabled={(queued === 0 && failed === 0) || isRunning}
                  onClick={processUntilEmpty}
                >
                  {isRunning ? "Uploading…" : `Upload ${queued + failed}`}
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div
              style={{
                marginTop: 12,
                height: 6,
                background: "var(--line)",
                borderRadius: 999,
                overflow: "hidden",
              }}
              aria-label="upload progress"
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: failed > 0 && isFinished ? "var(--accent)" : "var(--green)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Thumbnail grid — completed uploads get the full library tile
            (click-to-modal + ⋯ quick actions); in-flight items keep the
            lightweight Tile with status pills. */}
        {items.length > 0 && (
          <div
            style={{
              marginTop: 22,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 4,
            }}
          >
            {items.map((it) => {
              if (it.status === "done" && it.photoId && it.serverReady) {
                const tilePhoto: LibraryTilePhoto = {
                  id: it.photoId,
                  previewUrl: `/api/photos/${it.photoId}/preview`,
                  hidden: Boolean(it.hidden),
                  bibs: [], // queue items don't carry full bib data; modal fetches it on click
                };
                return (
                  <LibraryTile
                    key={it.uid}
                    p={tilePhoto}
                    running={rerun[it.photoId] === "running"}
                    onOpen={() => openDetail(it.photoId!)}
                  />
                );
              }
              return <Tile key={it.uid} item={it} />;
            })}
          </div>
        )}
      </div>

      {/* Detail modal — same component as the library page. Renders a
          loading shim while we fetch the full DetailPhoto.
          We only pass the one fetched photo as the "set" for now — arrow-key
          navigation across the upload queue would require fetching full
          DetailPhoto rows for every completed item, which we skip until
          someone asks for it. */}
      {openId && detailPhoto && (
        <PhotoDetailModal
          photos={[detailPhoto]}
          currentId={detailPhoto.id}
          onSelect={() => {
            /* single-item set — arrow keys are inert here */
          }}
          rerunState={rerun[detailPhoto.id] ?? "idle"}
          deleteState={delState[detailPhoto.id] ?? "idle"}
          hideState={hideStateMap[detailPhoto.id] ?? "idle"}
          onClose={closeDetail}
          onRerun={() => rerunOcr(detailPhoto.id)}
          onAskDelete={() =>
            setDelState((s) => ({
              ...s,
              [detailPhoto.id]: s[detailPhoto.id] === "confirm" ? "idle" : "confirm",
            }))
          }
          onConfirmDelete={() => deletePhoto(detailPhoto.id)}
          onCancelDelete={() => setDelState((s) => ({ ...s, [detailPhoto.id]: "idle" }))}
          onToggleHidden={() => toggleHidden(detailPhoto.id, detailPhoto.hidden)}
        />
      )}
      {openId && !detailPhoto && detailLoading && (
        <div className="overlay" onClick={closeDetail} style={{ background: "rgba(28,26,23,.6)" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "20px 28px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Loading photo…
          </div>
        </div>
      )}
    </main>
  );
}

function Tile({ item }: { item: QueueItem }) {
  const ring =
    item.status === "done"
      ? "var(--green)"
      : item.status === "error"
        ? "var(--accent)"
        : item.status === "uploading"
          ? "var(--accent)"
          : "transparent";
  const dimOpacity = item.status === "queued" ? 0.55 : 1;

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "4 / 3",
        borderRadius: 6,
        overflow: "hidden",
        background: "var(--cream)",
        outline: ring === "transparent" ? "1px solid var(--line)" : `2px solid ${ring}`,
        outlineOffset: 0,
      }}
      title={item.file.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={item.file.name}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: dimOpacity,
          transition: "opacity 0.2s ease",
        }}
      />
      {item.status === "uploading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.25) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s linear infinite",
          }}
        />
      )}
      {item.status === "done" && (
        <Badge color="var(--green)" symbol="✓" />
      )}
      {item.status === "error" && (
        <Badge color="var(--accent)" symbol="!" />
      )}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function Badge({ color, symbol }: { color: string; symbol: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 999,
        background: color,
        color: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 700,
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
      }}
    >
      {symbol}
    </div>
  );
}
