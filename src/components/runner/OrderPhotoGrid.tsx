"use client";

import { useEffect, useRef, useState } from "react";
import { JustifiedPhotoGrid } from "./JustifiedPhotoGrid";
import { PhotoViewer } from "./PhotoViewer";
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
 * file batches and holding many full-res blobs in memory can crash mobile
 * Safari, so we save the set a chunk at a time. Sized for fewer taps while
 * staying within reach of mobile memory (20 ≈ ~100MB held briefly) — a big
 * "save all" becomes a short stepper (and the ZIP is the better path for the
 * whole set anyway).
 */
const SHARE_CHUNK = 20;

/**
 * Order-page photo grid + delivery.
 *
 * The buyer already paid for every photo, so we don't make them pick: the
 * bulk actions always take the *whole* order. Two ways to get everything at
 * once —
 *   1. To your device
 *      - Download all (ZIP) — the everywhere path. One file, no prompts.
 *      - Save all to device — Web Share API (mobile only), stepped in
 *        SHARE_CHUNK batches so the whole set reaches the Photos library.
 *   2. To Dropbox — Saver widget (hidden until NEXT_PUBLIC_DROPBOX_APP_KEY set).
 *
 * ...and one way to grab a single shot: tap any photo to open it full-screen
 * (Google-Photos-style viewer) and hit "Save photo". No selection UI — the
 * viewer is the single-photo download path.
 */
export function OrderPhotoGrid({ photos, downloadToken, orderNumber, dropboxAppKey }: Props) {
  const [zipBusy, setZipBusy] = useState(false);
  const [zipReady, setZipReady] = useState(false);
  const [zipErr, setZipErr] = useState<string | null>(null);
  /** Live ZIP download progress while building: { received bytes, total bytes
   *  (0 when the server streams without a Content-Length) }. */
  const [zipProgress, setZipProgress] = useState<{ received: number; total: number } | null>(null);
  /** Built ZIP, cached for the session so re-clicking re-saves it instantly
   *  instead of rebuilding. */
  const zipBlobRef = useRef<Blob | null>(null);

  function downloadHref(id: string): string {
    return `/api/photos/${id}/download?token=${encodeURIComponent(downloadToken)}`;
  }
  function previewHref(id: string): string {
    // Carry the order's download token so the access-gated preview route
    // authorizes delivery even for a locked (secure-link) event where the
    // viewer has no secret-link cookie.
    return `/api/photos/${id}/preview?key=${encodeURIComponent(downloadToken)}`;
  }

  const orderTag = formatOrderNumber(orderNumber);
  const total = photos.length;

  /* --- Full-screen viewer (single-photo path) ------------------------- */

  const gridPhotos = photos.map((p) => ({ id: p.id, src: previewHref(p.id) }));
  // null = closed; otherwise the index into gridPhotos being viewed.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  /* --- ZIP: whole-order URL, filename --------------------------------- */

  const zipDownloadUrl = `/api/orders/${orderTag}/zip?key=${encodeURIComponent(downloadToken)}`;
  const zipFilename = `${orderTag}-photos.zip`;

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function downloadZip() {
    // Re-save the cached blob instantly if we already built it this session.
    if (zipBlobRef.current) {
      saveBlob(zipBlobRef.current, zipFilename);
      return;
    }
    setZipBusy(true);
    setZipErr(null);
    setZipProgress({ received: 0, total: 0 });
    try {
      // Fetch the zip (rather than navigating an anchor) so we can surface a
      // server error instead of failing silently — and stream the body to show
      // live progress as the server builds it.
      const res = await fetch(zipDownloadUrl);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `ZIP download failed (${res.status})`);
      }
      const totalBytes = Number(res.headers.get("Content-Length")) || 0;
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
            setZipProgress({ received, total: totalBytes });
          }
        }
        blob = new Blob(chunks, { type: "application/zip" });
      } else {
        blob = await res.blob();
      }
      zipBlobRef.current = blob;
      setZipReady(true);
      saveBlob(blob, zipFilename);
    } catch (e) {
      setZipErr(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
      setZipProgress(null);
    }
  }

  /* --- Device detection ----------------------------------------------- */

  // The "Save to device" (Web Share) path only has a Photos target on a phone;
  // on desktop the share sheet (when present) has nowhere to put images.
  // Detected in an effect so server and first client render agree (no SSR
  // mismatch), then the mobile-only UI appears after hydration.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMobile(/iphone|ipad|ipod|android/i.test(navigator.userAgent));
  }, []);

  /* --- Save to device (Web Share, iOS-safe stepper) ------------------- *
   *
   * Saving full-res photos into the phone's Photos library has two iOS gotchas
   * the share path MUST respect, or it fails with "Load failed" / silent
   * NotAllowedError:
   *
   *   1. CORS. `navigator.share({files})` needs the bytes as File objects, so
   *      we fetch() each original. The download route 302-redirects to a
   *      cross-origin presigned R2 URL, and a browser fetch() that follows that
   *      redirect can't read the body (R2 sends no CORS header) → Safari throws
   *      "Load failed". Fix: fetch the `&inline=1` variant, which streams the
   *      bytes same-origin through our route.
   *
   *   2. User activation. iOS only honors navigator.share() while the tap's
   *      transient activation is alive. `await fetch(); share()` loses it → the
   *      awaits outlast the window. Fix: PRE-FETCH the chunk's blobs in the
   *      background (an effect), so the tap calls share() SYNCHRONOUSLY with
   *      files already in hand.
   */

  function canShareFiles(files: File[]): boolean {
    if (typeof navigator === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (typeof nav.share !== "function") return false;
    if (typeof nav.canShare === "function") {
      try {
        return nav.canShare({ files });
      } catch {
        return false;
      }
    }
    return false;
  }

  const [sharing, setSharing] = useState(false);
  // Index into `photos` of the next photo not yet saved. Advances by the chunk
  // size after each successful share.
  const [shareCursor, setShareCursor] = useState(0);
  // The buyer tapped "Save to device" at least once → start pre-fetching.
  const [engaged, setEngaged] = useState(false);
  // Pre-fetched File[] for the CURRENT chunk, ready to hand to share() with no
  // await between gesture and share (iOS activation).
  const [readyFiles, setReadyFiles] = useState<File[]>([]);
  const [prepping, setPrepping] = useState(false);
  const [prepDone, setPrepDone] = useState(0);
  const [shareErr, setShareErr] = useState<string | null>(null);
  // Bumped to force a re-prep after a failed chunk (retry).
  const [prepNonce, setPrepNonce] = useState(0);
  // Which cursor position readyFiles were fetched for (-1 = none ready).
  const readyCursorRef = useRef(-1);

  const shareDone = engaged && total > 0 && shareCursor >= total;
  const chunkEnd = Math.min(shareCursor + SHARE_CHUNK, total);
  const prepChunkSize = Math.max(0, chunkEnd - shareCursor);
  const multiChunk = total > SHARE_CHUNK;

  // Pre-fetch the current chunk (same-origin inline bytes) once engaged.
  useEffect(() => {
    if (!isMobile || !engaged) return;
    if (total === 0 || shareCursor >= total) return;
    if (readyCursorRef.current === shareCursor) return; // already have this chunk
    const chunk = photos.slice(shareCursor, shareCursor + SHARE_CHUNK);
    if (chunk.length === 0) return;
    let cancelled = false;
    setPrepping(true);
    setPrepDone(0);
    setReadyFiles([]);
    (async () => {
      try {
        let done = 0;
        const files = await Promise.all(
          chunk.map(async (p) => {
            // &inline=1 → bytes stream same-origin (no cross-origin R2 CORS).
            const res = await fetch(`${downloadHref(p.id)}&inline=1`);
            if (!res.ok) throw new Error(`fetch ${res.status}`);
            const blob = await res.blob();
            if (!cancelled) {
              done += 1;
              setPrepDone(done);
            }
            return new File([blob], `${p.id}.jpg`, { type: "image/jpeg" });
          })
        );
        if (cancelled) return;
        setReadyFiles(files);
        readyCursorRef.current = shareCursor;
      } catch (e) {
        if (!cancelled) {
          console.warn("prep share chunk failed:", e);
          setShareErr("Couldn't prepare those photos. Tap to retry, or use the ZIP.");
        }
      } finally {
        if (!cancelled) setPrepping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, engaged, shareCursor, prepNonce, total]);

  /** Open the share sheet SYNCHRONOUSLY with the pre-fetched files (keeps iOS
   *  user activation). Advances the cursor on success so the next chunk preps. */
  function doShare(files: File[]) {
    if (!canShareFiles(files)) {
      setShareErr("This batch is too large to share at once. Use the ZIP instead.");
      return;
    }
    setSharing(true);
    setShareErr(null);
    navigator
      .share({
        title: "Photos",
        text: `${files.length} photo${files.length === 1 ? "" : "s"}`,
        files,
      })
      .then(() => {
        setReadyFiles([]);
        readyCursorRef.current = -1;
        setShareCursor((c) => Math.min(c + files.length, total));
      })
      .catch((e) => {
        if ((e as { name?: string }).name === "AbortError") return; // dismissed
        console.warn("share failed:", e);
        setShareErr(
          "Couldn't open the share sheet. Tap to retry, or use the ZIP / open a photo to save it."
        );
      })
      .finally(() => setSharing(false));
  }

  /** The device-save button handler. First tap engages (starts prep); once the
   *  chunk is ready, a tap shares; a tap after a prep error retries. */
  function onDeviceTap() {
    if (sharing || prepping || shareDone || total === 0) return;
    const probe = new File(["x"], "x.jpg", { type: "image/jpeg" });
    if (!canShareFiles([probe])) {
      setShareErr(
        "This device can't save straight to Photos. Use the ZIP, Dropbox, or open a photo to save it."
      );
      return;
    }
    if (!engaged) {
      setEngaged(true); // kicks the prefetch effect
      return;
    }
    if (readyCursorRef.current === shareCursor && readyFiles.length > 0) {
      doShare(readyFiles);
      return;
    }
    // Engaged but nothing ready and not prepping → a prior prep errored; retry.
    if (!prepping && readyFiles.length === 0) {
      setShareErr(null);
      readyCursorRef.current = -1;
      setPrepNonce((n) => n + 1);
    }
  }

  // Label reflects the stepper state.
  let deviceLabel: string;
  if (sharing) deviceLabel = "Opening share sheet…";
  else if (shareDone) deviceLabel = multiChunk ? `All ${total} saved ✓` : "Saved to Photos ✓";
  else if (!engaged) deviceLabel = `Save all ${total} to device`;
  else if (prepping || readyFiles.length === 0) deviceLabel = `Preparing… ${prepDone}/${prepChunkSize}`;
  else if (multiChunk) deviceLabel = `Save ${shareCursor + 1}–${chunkEnd} to Photos`;
  else deviceLabel = `Save ${total} to Photos`;

  /* --- Save to Dropbox (Saver widget) --------------------------------- */

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
    // the URL and is valid for 30 days (DOWNLOAD_TOKEN_TTL_DAYS), ample time.
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
      {/* Delivery panel — how the buyer takes ALL their photos away. */}
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
          Get all {total} photo{total === 1 ? "" : "s"}
        </div>

        {/* Method 1 — to your device */}
        <DeliveryRow title="To your device" help="Every photo, full resolution, in one download.">
          <button className="btn btn--primary" onClick={downloadZip} disabled={zipBusy || total === 0}>
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

          {/* Device save is mobile-only: the share sheet has no Photos target
              on desktop. Hidden until hydration confirms a phone. */}
          {isMobile && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onDeviceTap}
              disabled={sharing || prepping || shareDone || total === 0}
              title="Save into your device's Photos library"
            >
              {deviceLabel}
            </button>
          )}
        </DeliveryRow>

        {/* On a phone, once they've saved everything, point them at the ZIP for
            anything that didn't land — keeps the path honest. */}
        {isMobile && shareDone && (
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Saved to your Photos. Missing any? Grab the ZIP above.
          </div>
        )}

        {(zipErr || shareErr) && (
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
            {zipErr ?? shareErr}
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
              title="Save photos to your Dropbox"
            >
              Save all {total} to Dropbox
            </button>
          </DeliveryRow>
        )}
      </section>

      {/* Caption — how to grab a single shot. */}
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        Tap any photo to view it full screen — save one from there, or grab them all above.
      </div>

      {/* Google-Photos-style justified grid. Tapping a tile opens the full-screen
          viewer at that photo; the viewer's "Save photo" button downloads that
          single original in full resolution. */}
      <JustifiedPhotoGrid photos={gridPhotos} onOpen={(i) => setViewerIndex(i)} />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={gridPhotos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndex={(i) => setViewerIndex(i)}
          actions={(photo) => (
            <a
              className="btn btn--primary btn--sm"
              href={downloadHref(photo.id)}
              // Match the server's Content-Disposition name (the route forces
              // attachment; this hint only applies in the rare same-origin case).
              download={`${orderTag}-${photo.id}.jpg`}
            >
              Save photo
            </a>
          )}
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
