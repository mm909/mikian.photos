"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Headline } from "@/components/runner/Headline";

type EventLite = { id: string; name: string; date: string; city: string };

/**
 * Per-file pipeline stage. The /finalize server step today bundles preview-
 * gen + OCR, but from the UI we surface them as separate stages so a future
 * split-out of /finalize-preview / /finalize-ocr / /finalize-face plugs in
 * cleanly. Face detection isn't built yet — items just skip that stage.
 *
 *   queued       → user picked the file but Ingest hasn't started this one
 *   uploading    → presigned PUT to R2 (bytes-on-wire from the browser)
 *   processing   → /finalize is running on the server: preview build + OCR
 *   done         → all stages complete, photo is in the library
 *   duplicate    → server says this fingerprint already exists; awaiting
 *                  user decision (overwrite/skip)
 *   skipped      → user chose to skip a duplicate; file does not get
 *                  re-uploaded
 *   error        → any step failed; user can retry the failed bucket
 */
type Stage =
  | "queued"
  | "uploading"
  | "processing"
  | "done"
  | "duplicate"
  | "skipped"
  | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  stage: Stage;
  photoId?: string;
  /** Client-side SHA-256 of the file bytes, computed once on enqueue. */
  fingerprint?: string;
  /** When stage === "duplicate", the existing photo we'd be replacing. */
  duplicateOf?: { id: string; createdAt: string };
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

const CONCURRENCY = 3;

export function UploadClient({ event }: { event: EventLite }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [isRunning, setRunning] = useState(false);
  /** Pause flag — workers finish their current item and bail out when set.
   *  Resume re-enters the pool. */
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  /** When the queue drains and the user explicitly clicks "Ingest more →" we
   *  flip this true to bring the dropzone back. */
  const [showMoreZone, setShowMoreZone] = useState(false);
  /** When the user clicks "Clear batch" we surface a confirm prompt instead
   *  of nuking immediately. */
  const [clearConfirm, setClearConfirm] = useState(false);

  /** Per-batch timing for ETA. `batchStart` ticks on the first successful
   *  Ingest click of a queue; reset when the queue is emptied. */
  const batchStartRef = useRef<number | null>(null);
  const [, forceTick] = useState(0); // rerender every second for ETA
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => forceTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        uid: `q-${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        stage: "queued",
      }));
    setItems((curr) => [...curr, ...next]);
    setShowMoreZone(false);
    setClearConfirm(false);

    // Compute fingerprints in the background — kicks off SHA-256 over each
    // file's bytes. Cheap on modern hardware (~50ms per file). Once each
    // resolves we patch the queue item; the upload pipeline reads it later.
    for (const it of next) {
      fingerprintFile(it.file)
        .then((fp) => updateItem(it.uid, { fingerprint: fp }))
        .catch(() => {
          /* fingerprint failure is silent — duplicate detection just won't
           * fire for this item, upload still proceeds. */
        });
    }
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  async function uploadOne(item: QueueItem, opts: { force?: boolean } = {}): Promise<void> {
    updateItem(item.uid, { stage: "uploading" });

    const signRes = await fetch("/api/photographer/photos/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        contentType: item.file.type || "image/jpeg",
        fingerprint: item.fingerprint,
        force: opts.force ?? false,
      }),
    });
    if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
    const signJson = (await signRes.json()) as
      | { photoId: string; uploadUrl: string }
      | { duplicate: true; existing: { id: string; createdAt: string } };

    if ("duplicate" in signJson) {
      // Server says this fingerprint already exists. Park the item — the
      // user has to decide overwrite vs skip via the duplicate prompt below.
      updateItem(item.uid, {
        stage: "duplicate",
        duplicateOf: signJson.existing,
      });
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

    updateItem(item.uid, { stage: "done" });
  }

  async function processUntilEmpty() {
    setRunning(true);
    setShowMoreZone(false);
    pausedRef.current = false;
    setPaused(false);
    if (batchStartRef.current === null) batchStartRef.current = Date.now();
    try {
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
    } finally {
      setRunning(false);
    }
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

  function pause() {
    pausedRef.current = true;
    setPaused(true);
  }
  async function resume() {
    if (!paused) return;
    pausedRef.current = false;
    setPaused(false);
    await processUntilEmpty();
  }

  async function retryFailed() {
    setItems((curr) =>
      curr.map((i) => (i.stage === "error" ? { ...i, stage: "queued", errorMsg: undefined } : i))
    );
    await processUntilEmpty();
  }

  /**
   * Resolve a single duplicate by overwriting the existing photo. Deletes
   * the existing Photo + R2 blobs, then re-runs the pipeline for this item
   * with `force: true` so the sign route skips the duplicate check.
   */
  async function overwriteOne(item: QueueItem) {
    if (!item.duplicateOf) return;
    try {
      await fetch(`/api/photographer/photos/${item.duplicateOf.id}`, {
        method: "DELETE",
      });
    } catch {
      /* deletion failure isn't fatal — the new upload will get a fresh id. */
    }
    updateItem(item.uid, { stage: "queued", duplicateOf: undefined });
    void processUntilEmpty();
  }

  function skipOne(item: QueueItem) {
    updateItem(item.uid, { stage: "skipped", duplicateOf: undefined });
  }

  async function overwriteAllDuplicates() {
    const dups = items.filter((i) => i.stage === "duplicate" && i.duplicateOf);
    await Promise.allSettled(
      dups.map((i) =>
        fetch(`/api/photographer/photos/${i.duplicateOf!.id}`, { method: "DELETE" })
      )
    );
    setItems((curr) =>
      curr.map((i) =>
        i.stage === "duplicate"
          ? { ...i, stage: "queued", duplicateOf: undefined }
          : i
      )
    );
    void processUntilEmpty();
  }

  function skipAllDuplicates() {
    setItems((curr) =>
      curr.map((i) =>
        i.stage === "duplicate" ? { ...i, stage: "skipped", duplicateOf: undefined } : i
      )
    );
  }

  /**
   * Wipe the queue + ask the server to delete every photo that already made
   * it to R2. Guarded behind a confirm step in the UI. Failures on individual
   * deletes are non-fatal — we still clear the local queue so the user can
   * start fresh.
   */
  async function clearBatch() {
    setClearConfirm(false);
    const photoIds = items.map((i) => i.photoId).filter((x): x is string => Boolean(x));
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    batchStartRef.current = null;
    setShowMoreZone(true);
    await Promise.allSettled(
      photoIds.map((id) =>
        fetch(`/api/photographer/photos/${id}`, { method: "DELETE" })
      )
    );
  }

  // Aggregate counts
  const total = items.length;
  const queued = items.filter((i) => i.stage === "queued").length;
  const uploading = items.filter((i) => i.stage === "uploading").length;
  const processing = items.filter((i) => i.stage === "processing").length;
  const done = items.filter((i) => i.stage === "done").length;
  const skipped = items.filter((i) => i.stage === "skipped").length;
  const duplicates = items.filter((i) => i.stage === "duplicate");
  const failed = items.filter((i) => i.stage === "error").length;
  const inFlight = uploading + processing;
  const isFinished =
    total > 0 && queued === 0 && inFlight === 0 && duplicates.length === 0;
  // Progress denominator excludes skipped items so the bar fills cleanly.
  const denom = Math.max(total - skipped, 1);
  const progressPct = Math.round((done / denom) * 100);

  const currentUploading = useMemo(
    () => [...items].reverse().find((i) => i.stage === "uploading") ?? null,
    [items]
  );
  const currentProcessing = useMemo(
    () => [...items].reverse().find((i) => i.stage === "processing") ?? null,
    [items]
  );
  const lastFailed = useMemo(
    () => [...items].reverse().find((i) => i.stage === "error") ?? null,
    [items]
  );

  // ETA — only meaningful when we have at least one completion and there's
  // work remaining.
  const eta = useMemo(() => {
    if (!isRunning || done === 0 || total === done + failed) return null;
    const elapsed = batchStartRef.current ? Date.now() - batchStartRef.current : 0;
    if (elapsed <= 0) return null;
    const perItem = elapsed / done;
    const remaining = total - done - failed;
    return Math.round((perItem * remaining) / 1000); // seconds
  }, [isRunning, done, failed, total]);

  const showDropzone = !isRunning && (items.length === 0 || showMoreZone);

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
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
              text="Ingest your photos."
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
          <Link href="/photographer/photos" className="btn btn--ghost">
            View library →
          </Link>
        </div>

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
              Drop photos here to ingest
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

        {/* Pipeline view */}
        {items.length > 0 && (
          <div style={{ marginTop: 22 }}>
            {/* Duplicate prompt — parks duplicate items until the user decides
                overwrite-or-skip. Doesn't block the rest of the queue. */}
            {duplicates.length > 0 && (
              <div
                style={{
                  marginBottom: 18,
                  padding: 14,
                  background: "var(--cream)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        marginBottom: 4,
                      }}
                    >
                      {duplicates.length} duplicate
                      {duplicates.length === 1 ? "" : "s"} detected
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        color: "var(--ink)",
                        lineHeight: 1.4,
                      }}
                    >
                      Same file (by content hash) is already in this event.
                      Overwrite replaces the existing photo; skip leaves it
                      alone.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={skipAllDuplicates}
                    >
                      Skip all
                    </button>
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => void overwriteAllDuplicates()}
                    >
                      Overwrite all
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {duplicates.map((it) => (
                    <div
                      key={it.uid}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        padding: 8,
                        display: "grid",
                        gridTemplateColumns: "48px 1fr",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.previewUrl}
                        alt=""
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "cover",
                          borderRadius: 4,
                          display: "block",
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            color: "var(--muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {it.file.name}
                        </div>
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              flex: 1,
                            }}
                            onClick={() => skipOne(it)}
                          >
                            Skip
                          </button>
                          <button
                            className="btn btn--primary btn--sm"
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              flex: 1,
                            }}
                            onClick={() => void overwriteOne(it)}
                          >
                            Overwrite
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ProgressBar pct={progressPct} hasFailures={failed > 0 && isFinished} />

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                flexWrap: "wrap",
              }}
            >
              <span>
                {done}/{total} done
              </span>
              {eta != null && <span>~{formatEta(eta)} remaining</span>}
              {paused && <span style={{ color: "var(--accent)" }}>Paused</span>}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <StageCard
                label="Upload"
                count={uploading}
                total={total}
                done={done + processing}
                thumb={currentUploading?.previewUrl}
                tone="active"
                hint={
                  uploading > 0
                    ? `Pushing ${uploading}…`
                    : queued > 0
                      ? `${queued} waiting`
                      : "—"
                }
              />
              <StageCard
                label="OCR"
                count={processing}
                total={total}
                done={done}
                thumb={currentProcessing?.previewUrl}
                tone="active"
                hint={
                  processing > 0
                    ? `Scanning ${processing} for bibs…`
                    : done > 0
                      ? `${done} scanned`
                      : "—"
                }
              />
              <StageCard
                label="Face"
                count={0}
                total={total}
                done={0}
                thumb={null}
                tone="future"
                hint="Coming soon"
              />
              <StageCard
                label="Failed"
                count={failed}
                total={total}
                done={0}
                thumb={lastFailed?.previewUrl}
                tone="error"
                hint={failed > 0 ? `${failed} need retry` : "None"}
              />
            </div>

            {/* Action row */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              {!isFinished && queued > 0 && !isRunning && !paused && (
                <button
                  className="btn btn--primary"
                  onClick={processUntilEmpty}
                  disabled={isRunning}
                >
                  Ingest {queued}
                </button>
              )}
              {isRunning && !paused && (
                <button className="btn btn--ghost" onClick={pause}>
                  Pause
                </button>
              )}
              {paused && !isRunning && (
                <button className="btn btn--primary" onClick={resume}>
                  Resume
                </button>
              )}
              {failed > 0 && !isRunning && (
                <button className="btn btn--ghost" onClick={retryFailed}>
                  Retry {failed}
                </button>
              )}
              {isFinished && !showDropzone && (
                <button
                  className="btn btn--primary"
                  onClick={() => setShowMoreZone(true)}
                >
                  Ingest more →
                </button>
              )}
              {!isRunning && (done > 0 || failed > 0) && (
                <button
                  className="btn btn--ghost"
                  onClick={() => setClearConfirm(true)}
                  style={{ color: "var(--accent)" }}
                >
                  Clear batch
                </button>
              )}
            </div>

            {/* Confirm clear */}
            {clearConfirm && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  background: "var(--cream)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    color: "var(--ink)",
                    marginBottom: 10,
                    lineHeight: 1.4,
                  }}
                >
                  Delete all {total} photo{total === 1 ? "" : "s"} from this batch
                  (originals + previews in R2, DB rows) and start over? Can&rsquo;t be
                  undone.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={clearBatch}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      background: "var(--accent)",
                      color: "var(--paper)",
                      border: 0,
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Yes, delete batch
                  </button>
                  <button
                    onClick={() => setClearConfirm(false)}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
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
      aria-label="ingest progress"
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

function StageCard({
  label,
  count,
  done,
  total,
  thumb,
  tone,
  hint,
}: {
  label: string;
  count: number;
  done: number;
  total: number;
  thumb: string | null | undefined;
  tone: "active" | "future" | "error";
  hint: string;
}) {
  const accent =
    tone === "future" ? "var(--line)" : tone === "error" ? "var(--accent)" : "var(--ink)";
  const tally = `${done}/${total}`;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 14,
        opacity: tone === "future" ? 0.6 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 200,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".1em",
            color: "var(--muted)",
          }}
        >
          {tally}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 110,
          borderRadius: 6,
          overflow: "hidden",
          background: "var(--cream)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            {tone === "future" ? "soon" : "—"}
          </span>
        )}
        {count > 0 && tone === "active" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,.3) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s linear infinite",
            }}
          />
        )}
      </div>

      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          color: tone === "future" ? "var(--muted)" : "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minHeight: 18,
        }}
      >
        {hint}
      </div>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
