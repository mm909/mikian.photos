"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Headline } from "@/components/runner/Headline";

type EventLite = { id: string; name: string; date: string; city: string };

/**
 * Per-file pipeline stage. The /finalize server step today bundles preview-
 * gen + OCR, but from the UI we surface them as separate stages so a future
 * split-out of /finalize-preview / /finalize-ocr / /finalize-face plugs in
 * cleanly. Face detection isn't built yet — items just skip that stage.
 *
 *   queued     → user picked the file but Run hasn't started this one
 *   uploading  → presigned PUT to R2 (bytes-on-wire from the browser)
 *   processing → /finalize is running on the server: preview build + OCR
 *   done       → all stages complete, photo is in the library
 *   error      → any step failed; user can retry the failed bucket
 */
type Stage = "queued" | "uploading" | "processing" | "done" | "error";

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string; // local blob URL — cheap to show in pipeline thumbs
  stage: Stage;
  photoId?: string;
  /** Most recent error message; not surfaced per-item in the new UI but kept
   *  for debugging via the console log. */
  errorMsg?: string;
};

const CONCURRENCY = 3;

export function UploadClient({ event }: { event: EventLite }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [isRunning, setRunning] = useState(false);
  /** When the queue drains and the user explicitly clicks "Upload more →" we
   *  flip this true to bring the dropzone back. Reset when a fresh batch is
   *  in flight. */
  const [showMoreZone, setShowMoreZone] = useState(false);
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
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  /**
   * Run one item through the full pipeline. Stage transitions are surfaced to
   * the UI as they happen so the user sees the current item move through
   * upload → processing.
   *
   * Side-effect: when /finalize completes successfully, the server has
   * already run OCR (Tesseract or Rekognition depending on
   * DEFAULT_OCR_SETTINGS) and written PhotoBib rows. Face detection will
   * plug in here when built — same shape, additional stage.
   */
  async function uploadOne(item: QueueItem): Promise<void> {
    // 1) sign + 2) PUT — both happen in the "uploading" stage from the UI's pov
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

    // 3) finalize — server pulls original from R2, makes preview, runs OCR,
    //    writes PhotoBib rows. From the UI this is the "processing" stage.
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
    try {
      const workers = Array.from({ length: CONCURRENCY }, () => worker());
      await Promise.all(workers);
    } finally {
      setRunning(false);
    }
  }

  async function worker() {
    while (true) {
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

  // Most-recent item per stage — what we show as the "current" thumb.
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

  const showDropzone = !isRunning && (items.length === 0 || showMoreZone);

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
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
          <Link href="/photographer/photos" className="btn btn--ghost">
            View library →
          </Link>
        </div>

        {/* Dropzone — hidden while a batch is in flight, shown again when the
            user clicks "Upload more →" after the queue drains. */}
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
        )}

        {/* Pipeline view — replaces the per-file grid. Shows one thumb per
            active stage + counts + overall progress. */}
        {items.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <ProgressBar pct={progressPct} hasFailures={failed > 0 && isFinished} />

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 10,
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

            {/* Bottom action row */}
            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              {!isFinished && queued > 0 && !isRunning && (
                <button
                  className="btn btn--primary"
                  onClick={processUntilEmpty}
                  disabled={isRunning}
                >
                  Upload {queued}
                </button>
              )}
              {isRunning && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    alignSelf: "center",
                  }}
                >
                  Working — {done}/{total} done
                </span>
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
                  Upload more →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ProgressBar({ pct, hasFailures }: { pct: number; hasFailures: boolean }) {
  return (
    <div
      style={{
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
        border: `1px solid ${tone === "future" ? "var(--line)" : "var(--line)"}`,
        borderRadius: 10,
        padding: 12,
        opacity: tone === "future" ? 0.6 : 1,
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
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

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
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
              fontSize: 10,
              letterSpacing: ".1em",
              color: "var(--muted)",
            }}
          >
            {tally}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            color: tone === "future" ? "var(--muted)" : "var(--ink)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hint}
        </div>
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
