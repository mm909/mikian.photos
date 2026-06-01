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
 * file batches and holding many full-res blobs in memory can crash mobile
 * Safari, so we save the set a chunk at a time. Kept small (10 ≈ ~50MB held
 * briefly) for reliability — a selection saves in one tap; a big "save all" is
 * a short stepper (and the ZIP is the better path for the whole set anyway).
 */
const SHARE_CHUNK = 10;

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
 *      - Save to device — Web Share API (mobile only; the share sheet has no
 *        Photos target on desktop, so the button is hidden there). On iPhone
 *        the share sheet's "Save N Images" drops them straight into the Apple
 *        Photos library (Android: the gallery / Photos). Because iOS caps
 *        batch size we share SHARE_CHUNK at a time in a loop, so the *whole*
 *        target set reaches Photos — not just the first handful. Operates on
 *        the buyer's tap-selection, or the whole order when nothing is picked.
 *      - Tap a tile to select it (accent outline + check) for the bulk
 *        actions; tap-and-hold the full-res tile image for the browser's
 *        native "Save to Photos" on a single shot.
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
   *  instead of rebuilding. We tag the cached blob with the exact selection it
   *  was built for (`sig`) so a zip built for "all" is never re-saved when the
   *  buyer later picks a subset — and vice-versa. A null ref means "nothing
   *  cached yet". */
  const zipBlobRef = useRef<{ sig: string; blob: Blob } | null>(null);

  function downloadHref(id: string): string {
    return `/api/photos/${id}/download?token=${encodeURIComponent(downloadToken)}`;
  }

  /** ZIP URL — token goes as `?key=` (matches the order-page route param). */
  const orderTag = formatOrderNumber(orderNumber);

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
    // Selection-aware: zip the buyer's pick when there is one, else the whole
    // order. `zipDownloadUrl`, `zipSig`, and `zipFilename` are all derived from
    // the live selection further down in this component (safe to read here —
    // this runs on click, long after the component body has evaluated).
    const url = zipDownloadUrl;
    const sig = zipSig;

    // Re-save only if the cached blob was built for *this same* selection.
    // Keying on the selection signature is what stops an "all" zip from being
    // re-handed out when the buyer later narrows to 5 (and vice-versa).
    if (zipBlobRef.current && zipBlobRef.current.sig === sig) {
      saveBlob(zipBlobRef.current.blob, zipFilename);
      return;
    }
    setZipBusy(true);
    setZipErr(null);
    setZipProgress({ received: 0, total: 0 });
    try {
      // Fetch the zip (rather than navigating an anchor) so we can surface a
      // server error instead of failing silently — and so a dev-mode streaming
      // hiccup doesn't leave the buyer with nothing.
      const res = await fetch(url);
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
      zipBlobRef.current = { sig, blob }; // cache, tagged with this selection
      setZipReady(true);
      saveBlob(blob, zipFilename);
    } catch (e) {
      setZipErr(e instanceof Error ? e.message : String(e));
    } finally {
      setZipBusy(false);
      setZipProgress(null);
    }
  }

  const total = photos.length;
  // Paginate the grid so a large order doesn't render hundreds of tiles at
  // once. Bulk download/share still operate over the whole set (or selection).
  const pageCount = Math.max(1, Math.ceil(total / PHOTOS_PER_PAGE));
  const pagePhotos = photos.slice((page - 1) * PHOTOS_PER_PAGE, page * PHOTOS_PER_PAGE);

  /* --- Device detection ----------------------------------------------- */

  // The "Add to Photos" (Web Share) path only has a Photos target on a phone;
  // on desktop the share sheet (when present at all) has nowhere to put images.
  // Detected in an effect so the server and first client render agree (no SSR
  // mismatch), then the mobile-only UI appears after hydration.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMobile(/iphone|ipad|ipod|android/i.test(navigator.userAgent));
  }, []);

  /* --- Tap-to-select --------------------------------------------------- */

  // Ids the buyer has tapped. Empty set === "act on everything" (so a single
  // tap on a bulk button still grabs the whole order). A non-empty set narrows
  // device-save and Dropbox to just those photos.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }
  const selectedCount = selected.size;
  // The set the actions operate on: the explicit selection, or everything when
  // nothing is picked.
  const targetPhotos = selectedCount > 0 ? photos.filter((p) => selected.has(p.id)) : photos;
  const targetCount = targetPhotos.length;

  /* --- ZIP: selection-aware URL, cache key, filename ------------------- */

  // Ids in stable grid order (so the cache signature is order-independent of
  // the tap order). Empty when nothing is picked → whole-order zip.
  const selectedIds = targetPhotos.filter((p) => selected.has(p.id)).map((p) => p.id);

  // When the buyer has a selection, pass it as a comma-separated `ids=` param;
  // the route intersects it with the order's own photoIds (so it can only ever
  // narrow, never widen). When nothing is picked we omit `ids` → the whole
  // order. Orders are small, so a comma-joined querystring stays well within
  // URL-length limits; a selection of many hundreds would need a POST body, but
  // we're nowhere near that.
  const zipDownloadUrl =
    selectedCount > 0
      ? `/api/orders/${orderTag}/zip?key=${encodeURIComponent(downloadToken)}&ids=${selectedIds
          .map((id) => encodeURIComponent(id))
          .join(",")}`
      : `/api/orders/${orderTag}/zip?key=${encodeURIComponent(downloadToken)}`;

  // Cache signature for the built zip: "all" when no selection, else the sorted
  // id list. Sorted so picking the same photos in a different order reuses the
  // cached blob; any change in *which* photos are picked invalidates it.
  const zipSig = selectedCount > 0 ? [...selectedIds].sort().join(",") : "ALL";

  // Mirrors the route's filename so the saved file matches the streamed one.
  const zipFilename =
    selectedCount > 0 ? `${orderTag}-${selectedCount}-photos.zip` : `${orderTag}-photos.zip`;

  // Has THIS exact selection already been built this session? Drives the
  // "Download again" label so it only appears when re-clicking would be instant
  // (not after the buyer changes the selection to one we haven't zipped yet).
  const zipCachedForSelection = zipReady && zipBlobRef.current?.sig === zipSig;

  // Exactly one photo picked → hand back the single original directly instead
  // of a one-file zip (a zip of one photo is clunky). The button becomes a
  // plain download anchor in that case.
  const singleSelectedId = selectedCount === 1 ? selectedIds[0] : null;

  /* --- Save to device (Web Share, iOS-safe stepper) ------------------- *
   *
   * Saving full-res photos into the phone's Photos library has two iOS gotchas
   * the share path MUST respect, or it fails with "Load failed" / silent
   * NotAllowedError:
   *
   *   1. CORS. `navigator.share({files})` needs the bytes as File objects, so
   *      we fetch() each original. The download route 302-redirects to a
   *      cross-origin presigned R2 URL, and a browser fetch() that follows
   *      that redirect can't read the body (R2 sends no CORS header) → Safari
   *      throws "Load failed". Fix: fetch the `&inline=1` variant, which
   *      streams the bytes same-origin through our route.
   *
   *   2. User activation. iOS only honors navigator.share() while the tap's
   *      transient activation is alive. `await fetch(); share()` loses it
   *      (the awaits outlast the window) → NotAllowedError. Fix: PRE-FETCH the
   *      chunk's blobs in the background (an effect), so the tap calls share()
   *      SYNCHRONOUSLY with files already in hand.
   *
   * Flow: the buyer taps "Save … to device" once to engage (kicks off the
   * background prep); when the chunk is ready the label flips to "Save N to
   * Photos" and a tap opens the share sheet immediately. After each saved
   * chunk we advance a cursor and auto-prep the next, so subsequent chunks are
   * a single tap. Prep is lazy (only after engaging) so buyers who prefer the
   * ZIP/Dropbox never pay the bandwidth.
   */

  /** Can this browser actually share image *files*? Probes
   *  `canShare({ files })` (Web Share level 2) — `share` alone isn't enough,
   *  and on desktop there's no Photos target regardless. */
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
  // Index into targetPhotos of the next photo not yet saved. Advances by the
  // chunk size after each successful share.
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

  // Signature of the current target set — when the selection changes we reset
  // the cursor and re-prep from the top.
  const targetSig = targetPhotos.map((p) => p.id).join(",");
  useEffect(() => {
    setShareCursor(0);
    setReadyFiles([]);
    readyCursorRef.current = -1;
    setShareErr(null);
  }, [targetSig]);

  const shareDone = engaged && targetCount > 0 && shareCursor >= targetCount;
  const chunkEnd = Math.min(shareCursor + SHARE_CHUNK, targetCount);
  const prepChunkSize = Math.max(0, chunkEnd - shareCursor);
  const multiChunk = targetCount > SHARE_CHUNK;

  // Pre-fetch the current chunk (same-origin inline bytes) once engaged.
  useEffect(() => {
    if (!isMobile || !engaged) return;
    if (targetCount === 0 || shareCursor >= targetCount) return;
    if (readyCursorRef.current === shareCursor) return; // already have this chunk
    const chunk = targetPhotos.slice(shareCursor, shareCursor + SHARE_CHUNK);
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
  }, [isMobile, engaged, shareCursor, targetSig, prepNonce, targetCount]);

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
        title: "Race photos",
        text: `${files.length} race photo${files.length === 1 ? "" : "s"}`,
        files,
      })
      .then(() => {
        setReadyFiles([]);
        readyCursorRef.current = -1;
        setShareCursor((c) => Math.min(c + files.length, targetCount));
      })
      .catch((e) => {
        if ((e as { name?: string }).name === "AbortError") return; // dismissed
        console.warn("share failed:", e);
        setShareErr(
          "Couldn't open the share sheet. Tap to retry, or use the ZIP / tap-and-hold a photo."
        );
      })
      .finally(() => setSharing(false));
  }

  /** The device-save button handler. First tap engages (starts prep); once the
   *  chunk is ready, a tap shares; a tap after a prep error retries. */
  function onDeviceTap() {
    if (sharing || prepping || shareDone || targetCount === 0) return;
    // Confirm the device can share files at all before engaging.
    const probe = new File(["x"], "x.jpg", { type: "image/jpeg" });
    if (!canShareFiles([probe])) {
      setShareErr(
        "This device can't save straight to Photos. Use the ZIP, Dropbox, or tap-and-hold a photo to save it."
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

  // Label reflects the stepper state + selection-vs-all target.
  let deviceLabel: string;
  if (sharing) deviceLabel = "Opening share sheet…";
  else if (shareDone) deviceLabel = multiChunk ? `All ${targetCount} saved ✓` : "Saved to Photos ✓";
  else if (!engaged)
    deviceLabel = selectedCount > 0 ? `Save ${targetCount} to device` : `Save all ${targetCount} to device`;
  else if (prepping || readyFiles.length === 0) deviceLabel = `Preparing… ${prepDone}/${prepChunkSize}`;
  else if (multiChunk) deviceLabel = `Save ${shareCursor + 1}–${chunkEnd} to Photos`;
  else deviceLabel = `Save ${targetCount} to Photos`;

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
    // Operate on the current target set: the buyer's selection, or the whole
    // order when nothing is picked.
    // Dropbox's servers fetch each absolute URL directly — the token rides in
    // the URL and is valid for 30 days (DOWNLOAD_TOKEN_TTL_DAYS), so they have
    // ample time to pull every file.
    dbx.save({
      files: targetPhotos.map((p) => ({
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
          {/* Exactly one photo picked → a plain download anchor for that single
              original (skips the clunky one-file zip). 2+ or none → the ZIP
              button, which zips the selection (or the whole order). The anchor
              is styled as the primary button so the row looks identical. */}
          {singleSelectedId ? (
            <a
              className="btn btn--primary"
              href={downloadHref(singleSelectedId)}
              download={`${singleSelectedId}.jpg`}
            >
              Download 1 selected photo
            </a>
          ) : (
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
                : selectedCount > 0
                  ? zipCachedForSelection
                    ? `Download ${selectedCount} selected again (ZIP)`
                    : `Download ${selectedCount} selected (ZIP)`
                  : zipCachedForSelection
                    ? `Download ZIP again (${total})`
                    : `Download all (${total}) as ZIP`}
            </button>
          )}

          {/* Device save is mobile-only: the share sheet has no Photos target
              on desktop. Hidden until hydration confirms a phone. */}
          {isMobile && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onDeviceTap}
              // Tappable while ready (to share) or after a prep error (to
              // retry); inert (disabled) while actively sharing/prepping or
              // once the whole set is saved.
              disabled={sharing || prepping || shareDone || targetCount === 0}
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
            help={
              selectedCount > 0
                ? `Sends your ${selectedCount} selected photo${selectedCount === 1 ? "" : "s"} to your Dropbox — confirm in the popup and Dropbox pulls them in for you.`
                : `Sends all ${total} photo${total === 1 ? "" : "s"} to your Dropbox — confirm in the popup and Dropbox pulls them in for you.`
            }
          >
            <button
              type="button"
              className="btn btn--ghost"
              onClick={saveToDropbox}
              disabled={total === 0}
              title="Save photos to your Dropbox"
            >
              {selectedCount > 0
                ? `Save ${selectedCount} selected to Dropbox`
                : `Save all ${total} to Dropbox`}
            </button>
          </DeliveryRow>
        )}
      </section>

      {/* Selection / status bar — sits above the grid. Shows what one tap on
          a save button will grab, a way to clear the selection, and an
          "Updated <date, time>" stamp. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          {selectedCount > 0 ? (
            <strong>{selectedCount} selected</strong>
          ) : (
            <span style={{ color: "var(--muted)" }}>
              Tap photos to pick some — or save all {total}
            </span>
          )}
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              style={{
                background: "transparent",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--muted)",
                fontSize: 12,
                padding: "3px 9px",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Photo grid. Each tile shows the 1600px preview — fast + cached +
          zero-egress (full-res across a whole page would be ~100MB on mobile).
          A tap-and-hold on mobile still surfaces the browser's native "Save to
          Photos / Add to Library" option for a one-off save (of the preview).
          A quick tap toggles selection for the bulk save buttons, which fetch
          the full-resolution originals. We don't preventDefault, so the
          long-press menu and tap-to-select coexist. Full-resolution downloads
          go through the Save-to-device / Dropbox / ZIP actions above. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {pagePhotos.map((p) => {
          const isSel = selected.has(p.id);
          return (
            <div
              key={p.id}
              role="button"
              aria-pressed={isSel}
              aria-label={isSel ? "Selected — tap to deselect" : "Tap to select"}
              onClick={() => toggleSelect(p.id)}
              style={{
                position: "relative",
                aspectRatio: "2 / 3",
                background: "var(--cream)",
                border: isSel ? "2px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
                cursor: "pointer",
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
              {/* Selection checkmark badge. pointerEvents:none so a tap on it
                  still toggles the tile (and long-press still hits the image). */}
              {isSel && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "var(--paper)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    lineHeight: 1,
                    boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                    pointerEvents: "none",
                  }}
                >
                  ✓
                </span>
              )}
            </div>
          );
        })}
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
