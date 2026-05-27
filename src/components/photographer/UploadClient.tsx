"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Headline } from "@/components/runner/Headline";

type EventLite = { id: string; name: string; date: string; city: string };

type QueueItem = {
  uid: string;
  file: File;
  previewUrl: string;
  bib: string;
  mile: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  photoId?: string;
};

export function UploadClient({ event }: { event: EventLite }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isDragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: QueueItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({
        uid: `q-${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        previewUrl: URL.createObjectURL(f),
        bib: "",
        mile: "",
        status: "queued",
        progress: 0,
      }));
    setItems((curr) => [...curr, ...next]);
  }

  function updateItem(uid: string, patch: Partial<QueueItem>) {
    setItems((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function removeItem(uid: string) {
    setItems((curr) => {
      const target = curr.find((i) => i.uid === uid);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return curr.filter((i) => i.uid !== uid);
    });
  }

  async function uploadOne(item: QueueItem) {
    updateItem(item.uid, { status: "uploading", progress: 0, error: undefined });
    try {
      const form = new FormData();
      form.append("file", item.file);
      form.append("eventId", event.id);
      if (item.bib) form.append("bib", item.bib);
      if (item.mile) form.append("mile", item.mile);

      const res = await fetch("/api/photographer/photos", { method: "POST", body: form });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Upload failed (${res.status})`);
      }
      const j = (await res.json()) as { photo: { id: string } };
      updateItem(item.uid, { status: "done", progress: 100, photoId: j.photo.id });
    } catch (e) {
      updateItem(item.uid, {
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function uploadAll() {
    // Sequential to avoid spiky bandwidth + serverless cold-start storms.
    // Two-at-a-time would be a reasonable upgrade later.
    const pending = items.filter((i) => i.status === "queued" || i.status === "error");
    for (const item of pending) {
      // Re-read latest copy of the item (bib may have been edited)
      const fresh = items.find((i) => i.uid === item.uid) ?? item;
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(fresh);
    }
  }

  const queuedCount = items.filter((i) => i.status === "queued" || i.status === "error").length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const uploadingCount = items.filter((i) => i.status === "uploading").length;

  return (
    <main className="screen" style={{ padding: "48px 24px 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
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
            padding: "48px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "background var(--dur-hover) var(--ease), border-color var(--dur-hover) var(--ease)",
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
            JPEG or HEIC, any size. EXIF GPS + time are read automatically.
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = ""; // allow re-selecting the same files
            }}
          />
        </div>

        {/* Queue stats + action */}
        {items.length > 0 && (
          <div
            style={{
              marginTop: 18,
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
              {items.length} in queue · {doneCount} uploaded · {uploadingCount} in flight
            </div>
            <span style={{ flex: 1 }} />
            <button
              className="btn btn--primary"
              disabled={queuedCount === 0 || uploadingCount > 0}
              onClick={uploadAll}
            >
              Upload all {queuedCount > 0 ? `(${queuedCount})` : ""}
            </button>
          </div>
        )}

        {/* Queue rows */}
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <QueueRow
              key={it.uid}
              item={it}
              onChange={(patch) => updateItem(it.uid, patch)}
              onRemove={() => removeItem(it.uid)}
              onRetry={() => uploadOne(it)}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function QueueRow({
  item,
  onChange,
  onRemove,
  onRetry,
}: {
  item: QueueItem;
  onChange: (patch: Partial<QueueItem>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const statusLabel = {
    queued: "Queued",
    uploading: "Uploading",
    done: "Live",
    error: "Failed",
  }[item.status];
  const statusColor = {
    queued: "var(--muted)",
    uploading: "var(--accent)",
    done: "var(--green)",
    error: "var(--accent)",
  }[item.status];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 8,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.previewUrl}
        alt={item.file.name}
        style={{ width: 64, height: 88, objectFit: "cover", borderRadius: 4 }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.file.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginTop: 4,
          }}
        >
          {(item.file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
          <span style={{ color: statusColor }}>{statusLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="bib #"
            value={item.bib}
            disabled={item.status === "uploading"}
            onChange={(e) => onChange({ bib: e.target.value.replace(/[^0-9]/g, "") })}
            className="input"
            style={{ width: 100, padding: "6px 10px", fontSize: 13 }}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="mile"
            value={item.mile}
            disabled={item.status === "uploading"}
            onChange={(e) => onChange({ mile: e.target.value.replace(/[^0-9]/g, "") })}
            className="input"
            style={{ width: 80, padding: "6px 10px", fontSize: 13 }}
          />
        </div>
        {item.error && (
          <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 6 }}>
            {item.error}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {item.status === "error" && (
          <button className="btn btn--ghost btn--sm" onClick={onRetry}>
            Retry
          </button>
        )}
        {item.status !== "done" && (
          <button
            onClick={onRemove}
            disabled={item.status === "uploading"}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--muted)",
              fontSize: 12,
              cursor: item.status === "uploading" ? "not-allowed" : "pointer",
              textDecoration: "underline",
              textDecorationColor: "var(--line)",
              textUnderlineOffset: 3,
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
