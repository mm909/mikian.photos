"use client";

import { useEffect, useRef, useState } from "react";
import { Pager } from "@/components/photographer/Pager";
import { formatOrderNumber } from "@/lib/orderId";

type Props = {
  photos: { id: string }[];
  /** JWT minted at order capture — required to authorize hi-res download. */
  downloadToken: string;
  /** Order's human-readable number (e.g. 42), for the ZIP endpoint URL. */
  orderNumber: number;
  /** Dropbox app key for the Saver widget. When omitted the Dropbox
   *  button is hidden — keeps the UI honest about which integrations
   *  are configured on this deploy. */
  dropboxAppKey?: string;
};

/**
 * How many photos we hand to the Web Share sheet per tap. iOS rejects large
 * file batches (and holding many full-res blobs in memory can crash mobile
 * Safari), so we save the set a chunk at a time. For a single photo or a
 * small pick this is one tap; for a bundle it's a short stepper.
 */
const SHARE_CHUNK = 20;

/** Photos per page in the order grid. */
const PHOTOS_PER_PAGE = 24;

/**
 * Order-page photo grid + delivery toolbar.
 *
 * Two ways to take photos away, mapped to how buyers actually asked for them:
 *
 *   1. To your device
 *      - Download all (ZIP) — the everywhere path. One file, no prompts.
 *        Hits /api/orders/[N]/zip?key= which streams the whole order. On
 *        desktop it lands in Downloads; on iPhone it lands in Files.
 *      - Add to Photos — Web Share API. On iPhone the share sheet's
 *        "Save N Images" drops them straight into the Apple Photos library
 *        (Android: the gallery / Photos). Because iOS caps batch size we
 *        share SHARE_CHUNK at a time and advance a cursor, so the *whole*
 *        set reaches Photos — not just the first handful. Hidden on desktop
 *        where the share sheet has no Photos target.
 *      - Per-tile click — single photo download for cherry-picking.
 *   2. To Dropbox
 *      - Dropbox Saver widget; Dropbox fetches each /download URL server-side
 *        and lands them in the buyer's account. Hidden until
 *        NEXT_PUBLIC_DROPBOX_APP_KEY is configured on the deploy.
 *
 * (Google Photos is intentionally not a dedicated target — on Android it's
 * already one of the share-sheet options, and a first-party integration
 * needs Google's restricted-scope verification, which we're deferring.)
 */
export function OrderPhotoGrid({
  photos,
  downloadToken,
  orderNumber,
  dropboxAppKey,
}: Props) {
  const [zipBusy, setZipBusy] = useState(false);
  const [zipReady, setZipReady] = useState(false);
  const [page, setPage] = useState(1);
  const [zipErr, setZipErr] = useState<string | null>(null);
  /** Live ZIP download progress while building: { received bytes, total bytes
   *  (0 when the server streams without a Content-Length) }. */
  const [zipProgress, setZipProgress] = useState<{ received: number; total: number } | null>(null);
  /** Built ZIP, cached for the session so re-clicking re-saves it instantly
   *  instead of rebuilding (the order's photo set doesn't change). */
  const zipBlobRef = useRef<Blob | null>(null);

  function downloadHref(id: string): string {
    return `/api/photos/${id}/download?token=${encodeURIComponent(downloadToken)}`;
  }

  /** ZIP URL — token goes as `?key=` (matches the order-page route param). */
  const orderTag = formatOrderNumber(orderNumber);
  const zipHref = `/api/orders/${orderTag}/zip?key=${encodeURIComponent(downloadToken)}`;

  function saveBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orderTag}-photos.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function downloadZip() {
    // Already built this session → just re-save it, no rebuild.
    if (zipBlobRef.current) {
      saveBlob(zipBlobRef.current);
      return;
    }
    setZipBusy(true);
    setZipErr(null);
    setZipProgress({ received: 0, total: 0 });
    try {
      // Fetch the zip (rather than navigating an anchor) so we can surface a
      // server error instead of failing silently — and so a dev-mode streaming
      // hiccup doesn't leave the buyer with nothing.
      const res = await fetch(zipHref);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `ZIP download failed (${res.status})`);
      }
      // Stream the body so we can show live progress as the server builds the
      // zip. It's streamed without a Content-Length, so we report MB received
      // (and a % when a length happens to be present).
      const total = Number(res.headers.get("Content-Length")) || 0;
      let blob: Blob;
      const reader = res.body?.getReader();
      if (reader) {
        const chunks: BlobPart[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            setZipProgress({ received, total });
          }
        }
        blob = new Blob(chunks, { type: "application/zip" });
      } else {
        blob = await res.blob();
      }
      zipBlobRef.current = blob; // cache for instant re-download
      setZipReady(true);
      saveBlob(blob);
    } catch (e) {
      setZipErr(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
      setZipProgress(null);
    }
  }

  /* --- Add to Photos (Web Share, chunked) ----------------------------- */

  // Web Share API support detection. We feature-test for `canShare` with a
  // file (Share API with `files` is the level-2 spec; older browsers expose
  // `share` but not file sharing). On desktop the native share sheet has no
  // Photos target, so we hide the button when no `files` capability exists.
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    try {
      const probe = new File(["x"], "x.jpg", { type: "image/jpeg" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (typeof nav.canShare === "function" && nav.canShare({ files: [probe] })) {
        setCanShareFiles(true);
      }
    } catch {
      /* no support — leave false */
    }
  }, []);

  // Cursor into `photos`: index of the next photo not yet handed to a share
  // sheet. Each successful share advances it by up to SHARE_CHUNK, so a
  // multi-photo order is saved to Photos a batch per tap.
  const [shareCursor, setShareCursor] = useState(0);
  const [sharing, setSharing] = useState(false);
  const total = photos.length;
  // Paginate the grid so a large order doesn't render hundreds of tiles at
  // once. Bulk download/share still operate over the whole set.
  const pageCount = Math.max(1, Math.ceil(total / PHOTOS_PER_PAGE));
  const pagePhotos = photos.slice((page - 1) * PHOTOS_PER_PAGE, page * PHOTOS_PER_PAGE);
  const shareDone = total > 0 && shareCursor >= total;
  const multiChunk = total > SHARE_CHUNK;
  const chunkEnd = Math.min(shareCursor + SHARE_CHUNK, total);

  // Pre-fetch the current chunk's files so the actual navigator.share() can run
  // SYNCHRONOUSLY on tap. iOS Safari drops the user-activation if you await
  // anything (like a fetch) before share() — that's what produced "Couldn't
  // open the share sheet." We hold one chunk in memory at a time.
  const [readyFiles, setReadyFiles] = useState<File[]>([]);
  const [prepping, setPrepping] = useState(false);
  /** How many of the current chunk's files have downloaded (for the progress
   *  label, so "Preparing photos…" visibly moves). */
  const [prepDone, setPrepDone] = useState(0);
  const readyCursorRef = useRef(-1);
  useEffect(() => {
    if (!canShareFiles || shareDone || total === 0) return;
    if (readyCursorRef.current === shareCursor) return; // already prepped
    const slice = photos.slice(shareCursor, shareCursor + SHARE_CHUNK);
    if (slice.length === 0) return;
    let cancelled = false;
    let done = 0;
    setPrepping(true);
    setPrepDone(0);
    setReadyFiles([]);
    Promise.all(
      slice.map(async (p) => {
        const res = await fetch(downloadHref(p.id));
        if (!res.ok) throw new Error(`fetch ${p.id} ${res.status}`);
        const blob = await res.blob();
        if (!cancelled) {
          done += 1;
          setPrepDone(done);
        }
        return new File([blob], `${p.id}.jpg`, { type: "image/jpeg" });
      })
    )
      .then((files) => {
        if (cancelled) return;
        setReadyFiles(files);
        readyCursorRef.current = shareCursor;
      })
      .catch((e) => {
        if (!cancelled) console.warn("prep share chunk failed:", e);
      })
      .finally(() => {
        if (!cancelled) setPrepping(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShareFiles, shareCursor, shareDone, total]);

  /** Size of the chunk currently being prepped (for the progress label). */
  const prepChunkSize = Math.max(0, chunkEnd - shareCursor);

  /**
   * Save the prepped chunk to the device's Photos library via the Web Share
   * API. Called SYNCHRONOUSLY from the tap (files are already fetched) so iOS
   * keeps the user-activation and actually opens the share sheet. On success
   * we advance the cursor; the effect above then preps the next chunk.
   */
  function addToPhotos() {
    if (sharing || shareDone || readyFiles.length === 0) return;
    const files = readyFiles;
    setSharing(true);
    navigator
      .share({
        title: "Race photos",
        text: `${files.length} race photo${files.length === 1 ? "" : "s"}`,
        files,
      })
      .then(() => {
        setReadyFiles([]);
        readyCursorRef.current = -1;
        setShareCursor((c) => Math.min(c + files.length, total));
      })
      .catch((e) => {
        const name = (e as { name?: string }).name;
        if (name === "AbortError") return; // user dismissed — keep the prepped chunk
        console.warn("share failed:", e);
        alert(
          "Couldn't open the share sheet here. Use Download all (ZIP), or tap a photo to save it on its own."
        );
      })
      .finally(() => setSharing(false));
  }

  let addLabel: string;
  if (sharing) addLabel = "Opening share sheet…";
  else if (shareDone) addLabel = multiChunk ? `All ${total} saved ✓` : "Saved to Photos ✓";
  else if (prepping || readyFiles.length === 0)
    addLabel = `Preparing photos… ${prepDone}/${prepChunkSize}`;
  else if (multiChunk)
    addLabel = `Save ${shareCursor + 1}–${chunkEnd} of ${total} to Photos`;
  else addLabel = `Save all ${total} to Photos`;

  /* --- Save to Dropbox (Saver widget) --------------------------------- */

  // We render the button only when both the app key is set (the script
  // refuses without it) and the lazily-injected dropins.js has loaded.
  const [dropboxReady, setDropboxReady] = useState(false);
  useEffect(() => {
    if (!dropboxAppKey || typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).Dropbox) {
      setDropboxReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.dropbox.com/static/api/2/dropins.js";
    script.id = "dropboxjs";
    script.setAttribute("data-app-key", dropboxAppKey);
    script.async = true;
    script.onload = () => setDropboxReady(true);
    script.onerror = () => console.warn("Dropbox dropins.js failed to load");
    document.body.appendChild(script);
  }, [dropboxAppKey]);

  function saveToDropbox() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbx = (window as unknown as { Dropbox?: any }).Dropbox;
    if (!dbx) return;
    const origin = window.location.origin;
    // Dropbox's servers fetch each absolute URL directly — the token rides in
    // the URL and is valid for 30 days (DOWNLOAD_TOKEN_TTL_DAYS), so they have
    // ample time to pull every file.
    dbx.save({
      files: photos.map((p) => ({
        url: `${origin}${downloadHref(p.id)}`,
        filename: `${p.id}.jpg`,
      })),
      success: () => console.info("dropbox save dispatched"),
      cancel: () => console.info("dropbox save cancelled"),
      error: (err: unknown) => console.warn("dropbox save error:", err),
    });
  }

  const dropboxAvailable = Boolean(dropboxAppKey && dropboxReady);

  return (
    <div>
      {/* Delivery panel — how the buyer takes their photos away. */}
      <section
        aria-label="Delivery"
        style={{
          background: "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          display: "grid",
          gap: 18,
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
          Get your {total} photo{total === 1 ? "" : "s"}
        </div>

        {/* Method 1 — to your device */}
        <DeliveryRow title="To your device" help="">
          <button
            className="btn btn--primary"
            onClick={downloadZip}
            disabled={zipBusy || total === 0}
          >
            {zipBusy
              ? zipProgress
                ? `Preparing ZIP… ${(zipProgress.received / 1048576).toFixed(1)} MB${
                    zipProgress.total > 0
                      ? ` · ${Math.round((zipProgress.received / zipProgress.total) * 100)}%`
                      : ""
                  }`
                : "Preparing ZIP…"
              : zipReady
                ? `Download ZIP again (${total})`
                : `Download all (${total}) as ZIP`}
          </button>

          {canShareFiles && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={addToPhotos}
              disabled={sharing || shareDone || total === 0 || prepping || readyFiles.length === 0}
              title="Save into your device's Photos library"
            >
              {addLabel}
            </button>
          )}
        </DeliveryRow>

        {zipErr && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              color: "var(--accent)",
              fontSize: 13,
            }}
          >
            {zipErr}
          </div>
        )}

        {/* Method 2 — to Dropbox (only when configured on this deploy) */}
        {dropboxAvailable && (
          <DeliveryRow
            title="To Dropbox"
            help={`Sends all ${total} photo${total === 1 ? "" : "s"} to your Dropbox — confirm in the popup and Dropbox pulls them in for you.`}
          >
            <button
              type="button"
              className="btn btn--ghost"
              onClick={saveToDropbox}
              disabled={total === 0}
              title="Save all photos to your Dropbox"
            >
              Save to Dropbox
            </button>
          </DeliveryRow>
        )}
      </section>

      {/* Photo grid — a preview of the photos in this order. Downloads happen
          via the buttons above (your whole set at once). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {pagePhotos.map((p) => (
          <div
            key={p.id}
            style={{
              aspectRatio: "2 / 3",
              background: "var(--cream)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${p.id}/preview`}
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

      {pageCount > 1 && (
        <Pager
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={PHOTOS_PER_PAGE}
          onGo={setPage}
        />
      )}
    </div>
  );
}

/**
 * One delivery method: a title, a short "what happens" line, and the
 * action button(s). Keeps the panel rows visually consistent.
 */
function DeliveryRow({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        paddingTop: 4,
        borderTop: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 17,
          fontWeight: 500,
          color: "var(--ink)",
          marginTop: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
      {help && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--muted)",
            maxWidth: 560,
          }}
        >
          {help}
        </p>
      )}
    </div>
  );
}
