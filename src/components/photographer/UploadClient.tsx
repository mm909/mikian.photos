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
 *   queued     → user picked the file but Ingest hasn't started this one
 *   uploading  → presigned PUT to R2 (bytes-on-wire from the browser)
 *   processing → /finalize is running on the server: preview build + OCR
 *   done       → all stages complete, photo is in the library
 *   error      → any step failed; user can retry the failed bucket
 */
type Stage = "queued" | "uploading" | "processing" | "done" | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  stage: Stage;
  photoId?: string;
  errorMsg?: string;
};

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
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  async function uploadOne(item: QueueItem): Promise<void> {
    updateItem(item.uid, { stage: "uploading" });

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
  const failed = items.filter((i) => i.stage === "error").length;
  const inFlight = uploading + processing;
  const isFinished = total > 0 && queued === 0 && inFlight === 0;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

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
