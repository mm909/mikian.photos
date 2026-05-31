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

  /* --- Add to Photos (Web Share) -------------------------------------- */

  const [sharing, setSharing] = useState(false);
  /** Live device-save progress while fetching blobs: { done, total }. Null
   *  whenever a save isn't in flight — it is ALWAYS reset to null in a finally
   *  block so the "Preparing…" label can never stick at 0/N. */
  const [shareProgress, setShareProgress] = useState<{ done: number; total: number } | null>(null);

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
    // Older spec level: `share` exists but no `canShare` to confirm files.
    // Treat as unsupported for files to avoid the stuck-progress trap.
    return false;
  }

  /**
   * Save the target photos (selection, else all) into the device's Photos
   * library via the Web Share API.
   *
   * Robustness contract (fixes the "stuck at 0/N preparing" bug):
   *   - Feature-detect FIRST. If files can't be shared, alert and return early
   *     WITHOUT ever setting shareProgress — so no "preparing" UI appears.
   *   - shareProgress increments as each blob downloads.
   *   - shareProgress is reset to null in `finally`, so it never sticks at 0/N
   *     on error, on cancel (AbortError), or on success.
   *   - iOS caps batch size, so we hand the share sheet SHARE_CHUNK files at a
   *     time and loop until the whole target set is delivered.
   */
  async function shareAll() {
    if (sharing || targetCount === 0) return;

    // Feature-detect with a tiny probe BEFORE showing any progress UI.
    const probe = new File(["x"], "x.jpg", { type: "image/jpeg" });
    if (!canShareFiles([probe])) {
      alert(
        "This device or browser can't save photos directly to your library. " +
          "Use Save to Dropbox, the ZIP download, or tap and hold a photo to save it."
      );
      return; // never leaves shareProgress set
    }

    setSharing(true);
    setShareProgress({ done: 0, total: targetCount });
    try {
      let done = 0;
      // Walk the target set in iOS-friendly chunks.
      for (let start = 0; start < targetCount; start += SHARE_CHUNK) {
        const chunk = targetPhotos.slice(start, start + SHARE_CHUNK);
        const files: File[] = [];
        for (const p of chunk) {
          const res = await fetch(downloadHref(p.id));
          if (!res.ok) throw new Error(`Couldn't fetch a photo (${res.status}).`);
          const blob = await res.blob();
          files.push(new File([blob], `${p.id}.jpg`, { type: "image/jpeg" }));
          done += 1;
          setShareProgress({ done, total: targetCount });
        }
        // Re-check this exact batch — canShare can reject a too-large set.
        if (!canShareFiles(files)) {
          throw new Error("This batch is too large for your device to share at once.");
        }
        await navigator.share({
          title: "Race photos",
          text: `${files.length} race photo${files.length === 1 ? "" : "s"}`,
          files,
        });
      }
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name !== "AbortError") {
        // AbortError === the user dismissed the share sheet; stay quiet.
        console.warn("share failed:", e);
        alert(
          (e instanceof Error && e.message ? e.message + " " : "") +
            "Use Save to Dropbox, the ZIP download, or tap and hold a photo to save it."
        );
      }
    } finally {
      // Always clear — success, cancel, or error — so it never sticks at 0/N.
      setShareProgress(null);
      setSharing(false);
    }
  }

  // Label for the device-save button: reflects real fetch progress, and the
  // selection-vs-all target so the buyer knows what one tap will grab.
  let deviceLabel: string;
  if (shareProgress) deviceLabel = `Preparing… ${shareProgress.done}/${shareProgress.total}`;
  else if (sharing) deviceLabel = "Opening share sheet…";
  else if (selectedCount > 0) deviceLabel = `Save ${selectedCount} selected to device`;
  else deviceLabel = `Save all ${total} to device`;

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

          {/* Device save is mobile-only: the share sheet has no Photos target
              on desktop. Hidden until hydration confirms a phone. */}
          {isMobile && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={shareAll}
              disabled={sharing || total === 0 || shareProgress !== null}
              title="Save into your device's Photos library"
            >
              {deviceLabel}
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
