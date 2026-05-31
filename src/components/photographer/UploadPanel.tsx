"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDuplicatePolicy } from "@/lib/uploadSettings";

export type EventLite = { id: string; name: string; date: string; city: string };

/**
 * Per-file pipeline stage. Upload and detection are now two phases:
 *
 *   queued     → picked but the upload pool hasn't started this one
 *   uploading  → presigned PUT to R2 + /finalize (preview + DB)
 *   uploaded   → photo is LIVE (preview ready); waiting for detection
 *   detecting  → /detect is running: bib OCR + face indexing
 *   done       → detection complete; bib/face tags written
 *   skipped    → fingerprint collided with an existing photo and the duplicate
 *                policy is "skip" — no upload, no detection (see uploadSettings)
 *   error      → an upload step failed; user can retry the failed bucket
 */
type Stage = "queued" | "uploading" | "uploaded" | "detecting" | "done" | "skipped" | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  stage: Stage;
  photoId?: string;
  /** Client-side SHA-256 of the file bytes, computed once on enqueue. */
  fingerprint?: string;
  /** Bibs detected by OCR during detect (set when stage === "done"). */
  bibCount?: number;
  /** Faces indexed by Rekognition during detect (set when stage === "done"). */
  faceCount?: number;
  errorMsg?: string;
};

/**
 * Compute SHA-256 of a File as a lowercase hex string. Runs in the browser
 * via SubtleCrypto — works in all current browsers, no extra dependency.
 */
async function fingerprintFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Parallel workers per phase. The browser caps ~6 concurrent connections per
// origin (sign/finalize/detect are same-origin), so 6 is the practical ceiling.
const UPLOAD_CONCURRENCY = 6;
const DETECT_CONCURRENCY = 6;

/** Compact progress summary the dashboard reads to badge a collapsed row. */
export type UploadStatus = {
  total: number;
  /** Past the upload step (uploaded + detecting + done). */
  uploaded: number;
  /** Detection complete. */
  done: number;
  /** Detection in flight. */
  detecting: number;
  skipped: number;
  failed: number;
  queued: number;
  /** Currently PUT/finalizing. */
  uploadInFlight: number;
  /** Upload phase pool is running. */
  running: boolean;
  /** Detection phase pool is running. */
  detectingPhase: boolean;
  paused: boolean;
  /** Every active photo has been uploaded (detection may still be running). */
  uploadComplete: boolean;
  /** Uploaded AND detected — fully finished. */
  allDone: boolean;
  uploadPct: number;
  detectPct: number;
  /** True while anything's in motion (keeps the panel mounted + badged). */
  working: boolean;
};

/**
 * The upload engine + progress UI, with no page chrome of its own. Rendered
 * full-bleed on /photographer/upload and inline (compact) inside an expanded
 * event row on the dashboard, so both ingest surfaces share one code path.
 *
 * Two phases: an upload pool (sign → PUT → finalize, makes the photo live) and
 * a detection pool (bib OCR + face indexing) that runs in the background after
 * upload — so a big batch is "done uploading" in minutes while tags backfill.
 */
export function UploadPanel({
  event,
  compact = false,
  autoStart = false,
  pendingFiles,
  onPendingConsumed,
  onStatus,
  onChanged,
  onDone,
}: {
  event: EventLite;
  compact?: boolean;
  /** When true, adding files (drop / pick / injected) starts the upload
   *  immediately — no "Upload N" click. Used by the dashboard drop-to-upload. */
  autoStart?: boolean;
  /** Files handed in from outside (e.g. dropped onto a collapsed dashboard
   *  row). Consumed once when this changes; parent clears via onPendingConsumed. */
  pendingFiles?: File[];
  onPendingConsumed?: () => void;
  /** Progress callback so a parent (the dashboard) can badge a collapsed row
   *  and keep the panel mounted while work is in flight. */
  onStatus?: (s: UploadStatus) => void;
  /** Fired when a phase finishes draining — lets the dashboard refresh counts. */
  onChanged?: () => void;
  /** "Done" handler — e.g. collapse the dashboard row, or route home. When
   *  omitted, Done just resets the panel back to an empty dropzone. */
  onDone?: () => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [isRunning, setRunning] = useState(false); // upload phase
  const [isDetecting, setDetecting] = useState(false); // detection phase
  /** Paused: workers finished their current item and stopped pulling new ones,
   *  but the queue is preserved so Resume can pick up where it left off. */
  const [isPaused, setPaused] = useState(false);
  /** Pause flag — workers finish their current item and bail out when set. */
  const pausedRef = useRef(false);
  /** Ref mirrors so callbacks avoid stale-closure double-spawns. */
  const runningRef = useRef(false);
  const detectingRef = useRef(false);
  /** Ref mirror of items so workers/uploadOne read the freshest state. */
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  /** In-flight fingerprint hashes, keyed by uid — so uploadOne can AWAIT the
   *  hash before signing (otherwise fast auto-start uploads race past dedup). */
  const fpPromises = useRef<Map<string, Promise<string>>>(new Map());
  /** Ref to onStatus so the report effect fires on status *value* changes only. */
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  /** When the queue drains (or "Upload more") we flip this to bring back the zone. */
  const [showMoreZone, setShowMoreZone] = useState(false);

  /** Per-batch timing. batchStartRef = upload start; detectStartRef = when the
   *  detection phase began. *Ms states freeze each phase's total on completion. */
  const batchStartRef = useRef<number | null>(null);
  const detectStartRef = useRef<number | null>(null);
  const [uploadMs, setUploadMs] = useState<number | null>(null);
  const [detectMs, setDetectMs] = useState<number | null>(null);
  const [, forceTick] = useState(0); // rerender every second for live timers
  useEffect(() => {
    if (!isRunning && !isDetecting) return;
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning, isDetecting]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function addFiles(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        uid: `q-${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        stage: "queued",
      }));
    if (next.length === 0) return;
    setItems((curr) => [...curr, ...next]);
    setShowMoreZone(false);
    setPaused(false);
    // Recompute phase timers to include this fresh set.
    setUploadMs(null);
    setDetectMs(null);

    // Kick off the hash for each file and STASH the promise — uploadOne awaits
    // it before signing so duplicate detection never gets skipped by a race.
    for (const it of next) {
      const p = fingerprintFile(it.file).then(
        (fp) => {
          updateItem(it.uid, { fingerprint: fp });
          return fp;
        },
        () => "" // hash failure → empty string; dedup just won't fire for it
      );
      fpPromises.current.set(it.uid, p);
    }

    // Drop-to-upload: start the upload engine right away unless it's already
    // draining (existing workers pick up newly-queued items on their own).
    if (autoStart && !runningRef.current) {
      void processUntilEmpty();
    }
  }

  /* --- Upload phase: sign → PUT → finalize (preview + DB) → "uploaded" ---- */

  async function uploadOne(item: QueueItem, opts: { force?: boolean } = {}): Promise<void> {
    updateItem(item.uid, { stage: "uploading" });

    // Ensure the fingerprint is ready before signing — wait on the in-flight
    // hash if it hasn't landed yet. This is what makes dedup reliable under
    // auto-start (workers can claim an item before its hash finishes).
    let fingerprint = itemsRef.current.find((i) => i.uid === item.uid)?.fingerprint;
    if (!fingerprint) {
      const pending = fpPromises.current.get(item.uid);
      if (pending) fingerprint = (await pending) || undefined;
    }

    const signRes = await fetch("/api/photographer/photos/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        contentType: item.file.type || "image/jpeg",
        fingerprint,
        force: opts.force ?? false,
      }),
    });
    if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
    const signJson = (await signRes.json()) as
      | { photoId: string; uploadUrl: string }
      | { duplicate: true; existing: { id: string; createdAt: string } };

    if ("duplicate" in signJson) {
      // Apply the admin-set duplicate policy automatically — no prompt. A skip
      // returns here with NO upload and NO detection (the existing photo keeps
      // its tags); we never re-run OCR/face on a duplicate.
      if (getDuplicatePolicy() === "overwrite") {
        try {
          await fetch(`/api/photographer/photos/${signJson.existing.id}`, { method: "DELETE" });
        } catch {
          /* non-fatal */
        }
        await uploadOne(item, { force: true });
        return;
      }
      updateItem(item.uid, { stage: "skipped" });
      return;
    }

    const { photoId, uploadUrl } = signJson;
    updateItem(item.uid, { photoId });

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: item.file,
      headers: { "Content-Type": item.file.type || "image/jpeg" },
    });
    if (!putRes.ok) throw new Error(`PUT ${putRes.status}`);

    const finRes = await fetch("/api/photographer/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (!finRes.ok) throw new Error(`finalize ${finRes.status}`);

    // Photo is live (preview + DB). Detection happens in the background phase.
    updateItem(item.uid, { stage: "uploaded" });
  }

  async function uploadWorker() {
    while (true) {
      if (pausedRef.current) return;
      const next: QueueItem | undefined = await new Promise((resolve) => {
        setItems((curr) => {
          const target = curr.find((i) => i.stage === "queued");
          if (!target) {
            resolve(undefined);
            return curr;
          }
          resolve(target);
          return curr.map((i) => (i.uid === target.uid ? { ...i, stage: "uploading" } : i));
        });
      });
      if (!next) return;
      try {
        await uploadOne(next);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("upload failed:", msg);
        updateItem(next.uid, { stage: "error", errorMsg: msg });
      }
    }
  }

  async function processUntilEmpty() {
    if (runningRef.current) return; // already draining — don't double the pool
    runningRef.current = true;
    setRunning(true);
    setPaused(false);
    setShowMoreZone(false);
    pausedRef.current = false;
    if (batchStartRef.current === null) {
      batchStartRef.current = Date.now();
      detectStartRef.current = null;
      setUploadMs(null);
      setDetectMs(null);
    }
    try {
      const workers = Array.from({ length: UPLOAD_CONCURRENCY }, () => uploadWorker());
      await Promise.all(workers);
    } finally {
      runningRef.current = false;
      setRunning(false);
      if (!pausedRef.current) setPaused(false);
      onChanged?.();
    }
    // Upload phase is complete (or paused). Kick detection in the background —
    // it does NOT block the "upload complete" state.
    if (!pausedRef.current) void runDetectPhase();
  }

  /* --- Detection phase: /detect (bib OCR + faces) → "done" -------------- */

  async function detectOne(item: QueueItem): Promise<void> {
    if (!item.photoId) {
      updateItem(item.uid, { stage: "done", bibCount: 0, faceCount: 0 });
      return;
    }
    const res = await fetch(`/api/photographer/photos/${item.photoId}/detect`, {
      method: "POST",
    });
    if (!res.ok) {
      // Best-effort: the photo is live regardless. Mark done (untagged) + log.
      console.warn(`detect ${item.photoId} ${res.status}`);
      updateItem(item.uid, { stage: "done", bibCount: 0, faceCount: 0 });
      return;
    }
    const d = (await res.json().catch(() => null)) as {
      detectedBibs?: number[];
      indexedFaceCount?: number;
    } | null;
    updateItem(item.uid, {
      stage: "done",
      bibCount: Array.isArray(d?.detectedBibs) ? d!.detectedBibs!.length : 0,
      faceCount: typeof d?.indexedFaceCount === "number" ? d!.indexedFaceCount : 0,
    });
  }

  async function detectWorker() {
    while (true) {
      if (pausedRef.current) return;
      const next: QueueItem | undefined = await new Promise((resolve) => {
        setItems((curr) => {
          const target = curr.find((i) => i.stage === "uploaded");
          if (!target) {
            resolve(undefined);
            return curr;
          }
          resolve(target);
          return curr.map((i) => (i.uid === target.uid ? { ...i, stage: "detecting" } : i));
        });
      });
      if (!next) return;
      try {
        await detectOne(next);
      } catch (e) {
        console.warn("detect failed:", e);
        updateItem(next.uid, { stage: "done", bibCount: 0, faceCount: 0 });
      }
    }
  }

  async function runDetectPhase() {
    if (detectingRef.current) return; // already running
    if (pausedRef.current) return;
    detectingRef.current = true;
    setDetecting(true);
    try {
      const workers = Array.from({ length: DETECT_CONCURRENCY }, () => detectWorker());
      await Promise.all(workers);
    } finally {
      detectingRef.current = false;
      setDetecting(false);
      onChanged?.();
      // Race guard: an item may have become "uploaded" as we wound down.
      if (!pausedRef.current && itemsRef.current.some((i) => i.stage === "uploaded")) {
        void runDetectPhase();
      }
    }
  }

  /* --- Controls --------------------------------------------------------- */

  /** Pause: workers finish their current item, then stop pulling new ones. */
  function pause() {
    pausedRef.current = true;
    setPaused(true);
  }

  /** Resume a paused batch — restarts upload (re-kicks detection at the end). */
  function resume() {
    pausedRef.current = false;
    setPaused(false);
    if (!runningRef.current) void processUntilEmpty();
    // Catch any already-uploaded-but-undetected items if upload had nothing left.
    if (!detectingRef.current && itemsRef.current.some((i) => i.stage === "uploaded")) {
      void runDetectPhase();
    }
  }

  async function retryFailed() {
    setItems((curr) =>
      curr.map((i) => (i.stage === "error" ? { ...i, stage: "queued", errorMsg: undefined } : i))
    );
    await processUntilEmpty();
  }

  /**
   * Abort the batch: stop both pools, wipe the local queue, and delete any
   * photo that already made it to R2 so a cancel leaves nothing behind.
   */
  async function cancel() {
    pausedRef.current = true;
    runningRef.current = false;
    detectingRef.current = false;
    setRunning(false);
    setDetecting(false);
    setPaused(false);
    const photoIds = items.map((i) => i.photoId).filter((x): x is string => Boolean(x));
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    fpPromises.current.clear();
    batchStartRef.current = null;
    detectStartRef.current = null;
    setUploadMs(null);
    setDetectMs(null);
    setShowMoreZone(true);
    await Promise.allSettled(
      photoIds.map((id) => fetch(`/api/photographer/photos/${id}`, { method: "DELETE" }))
    );
    onChanged?.();
  }

  /** Finish: the uploads stay in the library; just leave the panel. */
  function finish() {
    if (onDone) {
      onDone();
      return;
    }
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    fpPromises.current.clear();
    batchStartRef.current = null;
    detectStartRef.current = null;
    setUploadMs(null);
    setDetectMs(null);
    setShowMoreZone(true);
  }

  /* --- Aggregate counts ------------------------------------------------- */
  const total = items.length;
  const queued = items.filter((i) => i.stage === "queued").length;
  const uploading = items.filter((i) => i.stage === "uploading").length;
  const uploadedStage = items.filter((i) => i.stage === "uploaded").length;
  const detecting = items.filter((i) => i.stage === "detecting").length;
  const done = items.filter((i) => i.stage === "done").length;
  const skipped = items.filter((i) => i.stage === "skipped").length;
  const failed = items.filter((i) => i.stage === "error").length;
  const active = Math.max(total - skipped, 0);
  const denom = Math.max(active, 1);
  const uploadedCount = uploadedStage + detecting + done; // past the upload step
  const detectPending = uploadedStage + detecting; // not yet detected
  const uploadComplete = active > 0 && queued === 0 && uploading === 0;
  const allDone = uploadComplete && detectPending === 0;
  const uploadPct = Math.round((uploadedCount / denom) * 100);
  const detectPct = Math.round((done / denom) * 100);
  const totalBibs = items.reduce((s, i) => s + (i.bibCount ?? 0), 0);
  const totalFaces = items.reduce((s, i) => s + (i.faceCount ?? 0), 0);
  // Every item collided with an existing photo — nothing new to upload/detect.
  const allSkipped = total > 0 && active === 0 && skipped > 0;

  // Per-phase elapsed time (live while running via the 1s ticker; frozen once
  // each phase finishes). `now` is read each render so the timers advance.
  const now = Date.now();
  const uploadElapsedMs = uploadMs ?? (batchStartRef.current ? now - batchStartRef.current : null);
  const detectElapsedMs = detectMs ?? (detectStartRef.current ? now - detectStartRef.current : null);

  // ETA for the (long) upload phase, based on uploads completed so far.
  const eta = useMemo(() => {
    if (!isRunning || uploadedCount === 0) return null;
    const elapsed = batchStartRef.current ? Date.now() - batchStartRef.current : 0;
    if (elapsed <= 0) return null;
    const remaining = active - uploadedCount - failed;
    if (remaining <= 0) return null;
    const perItem = elapsed / uploadedCount;
    return Math.round((perItem * remaining) / 1000); // seconds
  }, [isRunning, uploadedCount, active, failed]);

  // Freeze each phase's total time on completion; live timers tick meanwhile.
  useEffect(() => {
    if (uploadComplete && uploadMs === null && batchStartRef.current) {
      setUploadMs(Date.now() - batchStartRef.current);
    }
  }, [uploadComplete, uploadMs]);
  useEffect(() => {
    if (isDetecting && detectStartRef.current === null) detectStartRef.current = Date.now();
  }, [isDetecting]);
  useEffect(() => {
    if (allDone && detectMs === null && detectStartRef.current) {
      setDetectMs(Date.now() - detectStartRef.current);
    }
  }, [allDone, detectMs]);

  // Warn before leaving/refreshing while work is in flight. A refresh can't
  // truly resume (the browser drops File handles), but uploaded photos are safe
  // and re-dropping the same set skips them via dedup — so this just guards
  // against losing the in-progress queue by accident.
  useEffect(() => {
    const working =
      isRunning || isDetecting || queued > 0 || uploading > 0 || detectPending > 0;
    if (!working) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isRunning, isDetecting, queued, uploading, detectPending]);

  // Report progress up (dashboard badges the collapsed row + keeps us mounted).
  useEffect(() => {
    onStatusRef.current?.({
      total,
      uploaded: uploadedCount,
      done,
      detecting,
      skipped,
      failed,
      queued,
      uploadInFlight: uploading,
      running: isRunning,
      detectingPhase: isDetecting,
      paused: isPaused,
      uploadComplete,
      allDone,
      uploadPct,
      detectPct,
      working:
        isRunning ||
        isDetecting ||
        isPaused ||
        queued > 0 ||
        uploading > 0 ||
        detectPending > 0,
    });
  }, [
    total,
    uploadedCount,
    done,
    detecting,
    skipped,
    failed,
    queued,
    uploading,
    isRunning,
    isDetecting,
    isPaused,
    uploadComplete,
    allDone,
    uploadPct,
    detectPct,
    detectPending,
  ]);

  // Consume files injected from outside (e.g. dropped onto a collapsed row).
  useEffect(() => {
    if (pendingFiles && pendingFiles.length > 0) {
      addFiles(pendingFiles);
      onPendingConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles]);

  const showDropzone = items.length === 0 || showMoreZone;

  const title = allSkipped
    ? "All duplicates"
    : allDone
      ? "Upload complete"
      : isRunning
        ? "Uploading…"
        : isPaused
          ? "Paused"
          : isDetecting || detectPending > 0
            ? "Tagging photos…"
            : queued > 0
              ? `${queued} ready to upload`
              : "Upload";

  // Per-phase timing label (e.g. "Upload 1m 04s · Tagging 3m 12s").
  const timingLabel =
    uploadElapsedMs != null
      ? `Upload ${formatEta(Math.round(uploadElapsedMs / 1000))}${
          detectElapsedMs != null
            ? ` · Tagging ${formatEta(Math.round(detectElapsedMs / 1000))}`
            : ""
        }`
      : null;

  // Detection-still-running banner state (upload done, tags backfilling).
  const detectingInBackground = uploadComplete && !allDone && !isRunning && !isPaused;

  return (
    <div>
      {showDropzone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation(); // don't also trigger a parent drop target
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
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
            padding: compact ? "24px 20px" : "40px 24px",
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
              fontSize: compact ? 18 : 22,
              color: "var(--ink)",
              marginBottom: 6,
              letterSpacing: "-.005em",
            }}
          >
            Drop photos here to upload
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
      )}

      {/* Progress view */}
      {items.length > 0 && (
        <div style={{ marginTop: showDropzone ? (compact ? 16 : 22) : 0 }}>
          {/* Header — title + phase progress */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            <span style={{ color: "var(--ink)" }}>{title}</span>
            <span>
              {allSkipped
                ? `${skipped} skipped`
                : !uploadComplete
                  ? `${uploadedCount}/${active} done · ${uploadPct}%`
                  : `${done}/${active} tagged · ${detectPct}%`}
              {eta != null && ` · ~${formatEta(eta)} left`}
            </span>
          </div>

          {allSkipped ? (
            <div
              style={{
                padding: "14px 16px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                fontSize: 13.5,
                color: "var(--ink)",
                lineHeight: 1.5,
              }}
            >
              All {skipped} {skipped === 1 ? "photo was" : "photos were"} already in your
              library — nothing new was uploaded, and no bib OCR or face detection was
              run.
            </div>
          ) : (
            <>
              <ProgressBar
                pct={uploadComplete ? detectPct : uploadPct}
                hasFailures={failed > 0 && allDone}
              />

              {timingLabel && (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {timingLabel}
                </div>
              )}

              {detectingInBackground && (
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    color: "var(--muted)",
                    lineHeight: 1.5,
                  }}
                >
                  All {active} uploaded and live — bib OCR + face detection are still
                  running in the background. You can keep this open to watch, or close
                  it; tagging continues.
                </div>
              )}

              {/* Per-step + tallies. Upload fills fast; Bib OCR + Face rec backfill. */}
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 10,
                }}
              >
                <Metric
                  label="Upload"
                  value={`${uploadedCount}/${active}`}
                  sub={uploading > 0 ? `pushing ${uploading}…` : "to storage"}
                  pct={uploadPct}
                />
                <Metric
                  label="Bib OCR"
                  value={`${done}/${active}`}
                  sub={
                    detecting > 0
                      ? `scanning ${detecting}…`
                      : detectPending > 0
                        ? "queued…"
                        : `${totalBibs} bib${totalBibs === 1 ? "" : "s"} found`
                  }
                  pct={detectPct}
                />
                <Metric
                  label="Face rec"
                  value={`${done}/${active}`}
                  sub={
                    detecting > 0
                      ? `detecting ${detecting}…`
                      : detectPending > 0
                        ? "queued…"
                        : `${totalFaces} face${totalFaces === 1 ? "" : "s"} found`
                  }
                  pct={detectPct}
                />
                {skipped > 0 && (
                  <Metric label="Skipped" value={`${skipped}`} sub="duplicates" />
                )}
                <Metric
                  label="Failed"
                  value={`${failed}`}
                  sub={failed > 0 ? "need retry" : "none"}
                  tone={failed > 0 ? "error" : undefined}
                  muted={failed === 0}
                />
              </div>
            </>
          )}

          {/* Action row */}
          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {isRunning ? (
              <>
                <button className="btn btn--ghost" onClick={() => setShowMoreZone(true)}>
                  Upload more
                </button>
                <button className="btn btn--ghost" onClick={pause}>
                  Pause
                </button>
                <button className="btn btn--ghost" style={{ color: "var(--accent)" }} onClick={cancel}>
                  Cancel
                </button>
              </>
            ) : isPaused ? (
              <>
                <button className="btn btn--ghost" onClick={() => setShowMoreZone(true)}>
                  Upload more
                </button>
                <button className="btn btn--primary" onClick={resume}>
                  Resume{queued > 0 ? ` (${queued})` : ""}
                </button>
                <button className="btn btn--ghost" style={{ color: "var(--accent)" }} onClick={cancel}>
                  Cancel
                </button>
              </>
            ) : !uploadComplete && queued > 0 ? (
              <>
                <button className="btn btn--primary" onClick={processUntilEmpty}>
                  Upload {queued}
                </button>
                <button className="btn btn--ghost" style={{ color: "var(--accent)" }} onClick={cancel}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {failed > 0 && (
                  <button className="btn btn--ghost" onClick={retryFailed}>
                    Retry {failed}
                  </button>
                )}
                <button className="btn btn--ghost" onClick={() => setShowMoreZone(true)}>
                  Upload more
                </button>
                <button className="btn btn--primary" onClick={finish}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function ProgressBar({ pct, hasFailures }: { pct: number; hasFailures: boolean }) {
  return (
    <div
      style={{
        height: 8,
        background: "var(--line)",
        borderRadius: 999,
        overflow: "hidden",
      }}
      aria-label="upload progress"
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: hasFailures ? "var(--accent)" : "var(--green)",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

/** A single progress/tally tile. `pct` adds a thin step progress bar (and a %
 *  in the label); omit it for plain counts (skipped / failed). */
function Metric({
  label,
  value,
  sub,
  pct,
  tone,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number;
  tone?: "error";
  muted?: boolean;
}) {
  const valueColor = tone === "error" ? "var(--accent)" : "var(--ink)";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "12px 14px",
        opacity: muted ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        <span>{label}</span>
        {pct != null && (
          <span style={{ color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
            {Math.max(0, Math.min(100, pct))}%
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 22,
          color: valueColor,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}
      {pct != null && (
        <div
          style={{
            marginTop: 8,
            height: 4,
            background: "var(--line)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(100, pct))}%`,
              background: "var(--green)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}
