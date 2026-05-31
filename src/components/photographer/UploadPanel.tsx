"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDuplicatePolicy } from "@/lib/uploadSettings";

export type EventLite = { id: string; name: string; date: string; city: string };

/**
 * Per-file pipeline stage.
 *
 *   queued       → picked but Upload hasn't started this one
 *   uploading    → presigned PUT to R2
 *   processing   → /finalize is running: preview build + bib OCR + face index
 *   done         → all stages complete, photo is in the library
 *   skipped      → fingerprint collided with an existing photo and the
 *                  duplicate policy is "skip" (see src/lib/uploadSettings.ts)
 *   error        → any step failed; user can retry the failed bucket
 */
type Stage = "queued" | "uploading" | "processing" | "done" | "skipped" | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  stage: Stage;
  photoId?: string;
  /** Client-side SHA-256 of the file bytes, computed once on enqueue. */
  fingerprint?: string;
  /** Bibs detected by OCR during finalize (set when stage === "done"). */
  bibCount?: number;
  /** Faces indexed by Rekognition during finalize (set when stage === "done"). */
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

// Parallel upload+finalize workers. The browser caps ~6 concurrent connections
// per origin (sign + finalize are same-origin), so 6 is the practical ceiling
// before requests just queue in the browser anyway.
const CONCURRENCY = 6;

/** Compact progress summary the dashboard reads to badge a collapsed row. */
export type UploadStatus = {
  total: number;
  done: number;
  skipped: number;
  failed: number;
  queued: number;
  inFlight: number;
  running: boolean;
  paused: boolean;
  finished: boolean;
  pct: number;
  /** True while there's anything in motion (so the row keeps its panel mounted
   *  and shows a badge even when collapsed). */
  working: boolean;
};

/**
 * The upload engine + progress UI, with no page chrome of its own. Rendered
 * full-bleed on /photographer/upload and inline (compact) inside an expanded
 * event row on the dashboard, so both ingest surfaces share one code path.
 *
 * Deliberately no per-photo thumbnails — the focus is the progress of each
 * step (upload, bib OCR, face detection) plus skipped-duplicate and failure
 * counts and an ETA.
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
  /** Fired when a batch finishes draining — lets the dashboard refresh counts. */
  onChanged?: () => void;
  /** "Done" handler — e.g. collapse the dashboard row, or route home. When
   *  omitted, Done just resets the panel back to an empty dropzone. */
  onDone?: () => void;
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [isRunning, setRunning] = useState(false);
  /** Paused: workers finished their current item and stopped pulling new ones,
   *  but the queue is preserved so Resume can pick up where it left off. */
  const [isPaused, setPaused] = useState(false);
  /** Pause flag — workers finish their current item and bail out when set.
   *  Used by Pause and Cancel to stop the pool. */
  const pausedRef = useRef(false);
  /** Ref mirror of isRunning so autoStart can avoid spawning a second worker
   *  pool from a stale closure. */
  const runningRef = useRef(false);
  /** Ref mirror of items so uploadOne can read the freshest fingerprint even
   *  when an item was claimed before its hash finished computing. */
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;
  /** Ref to onStatus so the report effect fires on status *value* changes only,
   *  not when the parent passes a fresh inline callback (which would loop). */
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  /** When the queue drains (or the user clicks "Upload more") we flip this
   *  true to bring the dropzone back. */
  const [showMoreZone, setShowMoreZone] = useState(false);

  /** Per-batch timing for ETA. */
  const batchStartRef = useRef<number | null>(null);
  const [, forceTick] = useState(0); // rerender every second for ETA
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    for (const it of next) {
      fingerprintFile(it.file)
        .then((fp) => updateItem(it.uid, { fingerprint: fp }))
        .catch(() => {
          /* fingerprint failure is silent — dedup just won't fire for it. */
        });
    }

    // Drop-to-upload: start the engine right away unless it's already draining
    // (existing workers pick up newly-queued items on their own).
    if (autoStart && !runningRef.current) {
      void processUntilEmpty();
    }
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  async function uploadOne(item: QueueItem, opts: { force?: boolean } = {}): Promise<void> {
    updateItem(item.uid, { stage: "uploading" });

    // Read the freshest fingerprint — the hash is computed async on enqueue and
    // may have landed after this item was claimed (esp. with autoStart).
    const fingerprint =
      itemsRef.current.find((i) => i.uid === item.uid)?.fingerprint ?? item.fingerprint;

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
      // Apply the admin-set duplicate policy automatically — no prompt.
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

    updateItem(item.uid, { stage: "processing" });

    const finRes = await fetch("/api/photographer/photos/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (!finRes.ok) throw new Error(`finalize ${finRes.status}`);

    // Finalize reports what detection found — surface it as live progress.
    const fin = (await finRes.json().catch(() => null)) as {
      photo?: { detectedBibs?: number[]; indexedFaceCount?: number };
    } | null;
    const det = fin?.photo;
    updateItem(item.uid, {
      stage: "done",
      bibCount: Array.isArray(det?.detectedBibs) ? det!.detectedBibs!.length : 0,
      faceCount: typeof det?.indexedFaceCount === "number" ? det!.indexedFaceCount : 0,
    });
  }

  async function processUntilEmpty() {
    if (runningRef.current) return; // already draining — don't double the pool
    runningRef.current = true;
    setRunning(true);
    setPaused(false);
    setShowMoreZone(false);
    pausedRef.current = false;
    if (batchStartRef.current === null) batchStartRef.current = Date.now();
    try {
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
    } finally {
      runningRef.current = false;
      setRunning(false);
      // Stay "paused" only if pause() asked us to; otherwise we're truly idle.
      if (!pausedRef.current) setPaused(false);
      onChanged?.();
    }
  }

  /** Pause: workers finish their current item, then stop pulling new ones. The
   *  queue is preserved so Resume continues where it left off. */
  function pause() {
    pausedRef.current = true;
    setPaused(true);
  }

  /** Resume a paused batch. */
  function resume() {
    if (runningRef.current) return;
    void processUntilEmpty();
  }

  async function worker() {
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
          return curr.map((i) =>
            i.uid === target.uid ? { ...i, stage: "uploading" } : i
          );
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

  async function retryFailed() {
    setItems((curr) =>
      curr.map((i) => (i.stage === "error" ? { ...i, stage: "queued", errorMsg: undefined } : i))
    );
    await processUntilEmpty();
  }

  /**
   * Abort the batch: stop the workers, wipe the local queue, and delete any
   * photo that already made it to R2 so a cancel leaves nothing behind.
   */
  async function cancel() {
    pausedRef.current = true;
    runningRef.current = false;
    setRunning(false);
    setPaused(false);
    const photoIds = items.map((i) => i.photoId).filter((x): x is string => Boolean(x));
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    batchStartRef.current = null;
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
    batchStartRef.current = null;
    setShowMoreZone(true);
  }

  // Aggregate counts
  const total = items.length;
  const queued = items.filter((i) => i.stage === "queued").length;
  const uploading = items.filter((i) => i.stage === "uploading").length;
  const processing = items.filter((i) => i.stage === "processing").length;
  const done = items.filter((i) => i.stage === "done").length;
  const skipped = items.filter((i) => i.stage === "skipped").length;
  const failed = items.filter((i) => i.stage === "error").length;
  const inFlight = uploading + processing;
  const isFinished = total > 0 && queued === 0 && inFlight === 0;
  // Items actually being uploaded (skips excluded from the denominators).
  const active = Math.max(total - skipped, 0);
  const denom = Math.max(active, 1);
  const uploaded = done + processing; // PUT complete (processing = finalizing)
  const progressPct = Math.round((done / denom) * 100);
  const totalBibs = items.reduce((s, i) => s + (i.bibCount ?? 0), 0);
  const totalFaces = items.reduce((s, i) => s + (i.faceCount ?? 0), 0);

  const eta = useMemo(() => {
    if (!isRunning || done === 0 || total === done + failed + skipped) return null;
    const elapsed = batchStartRef.current ? Date.now() - batchStartRef.current : 0;
    if (elapsed <= 0) return null;
    const perItem = elapsed / done;
    const remaining = total - done - failed - skipped;
    return Math.round((perItem * remaining) / 1000); // seconds
  }, [isRunning, done, failed, skipped, total]);

  // Report progress up (dashboard badges the collapsed row + keeps us mounted).
  useEffect(() => {
    onStatusRef.current?.({
      total,
      done,
      skipped,
      failed,
      queued,
      inFlight,
      running: isRunning,
      paused: isPaused,
      finished: isFinished,
      pct: progressPct,
      working: isRunning || isPaused || queued > 0 || inFlight > 0,
    });
  }, [total, done, skipped, failed, queued, inFlight, isRunning, isPaused, isFinished, progressPct]);

  // Consume files injected from outside (e.g. dropped onto a collapsed row).
  // Parent passes a fresh array per drop and clears it via onPendingConsumed.
  useEffect(() => {
    if (pendingFiles && pendingFiles.length > 0) {
      addFiles(pendingFiles);
      onPendingConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles]);

  const showDropzone = items.length === 0 || showMoreZone;

  const title = isFinished
    ? "Upload complete"
    : isRunning
      ? "Uploading…"
      : isPaused
        ? "Paused"
        : queued > 0
          ? `${queued} ready to upload`
          : "Upload";

  return (
    <div>
      {showDropzone && (
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
          {/* Header — title + ETA */}
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
              {done}/{active} done
              {eta != null && ` · ~${formatEta(eta)} left`}
            </span>
          </div>

          <ProgressBar pct={progressPct} hasFailures={failed > 0 && isFinished} />

          {/* Per-step + tallies — no photo previews, just progress. */}
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
              value={`${uploaded}/${active}`}
              sub={uploading > 0 ? `pushing ${uploading}…` : "to storage"}
              pct={Math.round((uploaded / denom) * 100)}
            />
            <Metric
              label="Bib OCR"
              value={`${done}/${active}`}
              sub={
                processing > 0
                  ? `scanning ${processing}…`
                  : `${totalBibs} bib${totalBibs === 1 ? "" : "s"} found`
              }
              pct={progressPct}
            />
            <Metric
              label="Face rec"
              value={`${done}/${active}`}
              sub={
                processing > 0
                  ? `detecting ${processing}…`
                  : `${totalFaces} face${totalFaces === 1 ? "" : "s"} found`
              }
              pct={progressPct}
            />
            <Metric label="Skipped" value={`${skipped}`} sub="duplicates" muted={skipped === 0} />
            <Metric
              label="Failed"
              value={`${failed}`}
              sub={failed > 0 ? "need retry" : "none"}
              tone={failed > 0 ? "error" : undefined}
              muted={failed === 0}
            />
          </div>

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
            ) : isFinished ? (
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
            ) : (
              <>
                {queued > 0 && (
                  <button className="btn btn--primary" onClick={processUntilEmpty}>
                    Upload {queued}
                  </button>
                )}
                <button className="btn btn--ghost" style={{ color: "var(--accent)" }} onClick={cancel}>
                  Cancel
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
          width: `${pct}%`,
          background: hasFailures ? "var(--accent)" : "var(--green)",
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

/** A single progress/tally tile. `pct` adds a thin step progress bar; omit it
 *  for plain counts (skipped / failed). */
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
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
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
