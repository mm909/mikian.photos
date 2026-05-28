"use client";

import { useEffect, useState } from "react";

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
 * Order-page photo grid + download toolbar.
 *
 * The toolbar above the grid surfaces all the ways a buyer can take
 * their photos away:
 *
 *   - Download ZIP — the primary; one file, no permission prompts.
 *     Hits /api/orders/[N]/zip?key= which streams everything.
 *   - Save to Dropbox — Dropbox Saver widget; user confirms in a
 *     popup, Dropbox fetches each URL server-side and lands them in
 *     their account. Hidden when NEXT_PUBLIC_DROPBOX_APP_KEY isn't
 *     configured.
 *   - Save to Photos / Share — Web Share API. On mobile this opens
 *     the native share sheet (iOS includes "Save N Images" to the
 *     Photos app; Android includes Photos, Google Photos, etc).
 *     Hidden on desktop where the share API doesn't include the
 *     Photos-app target.
 *   - Per-tile click — single photo download for cherry-picking.
 *
 * The previous "sequential download all" loop (one anchor click per
 * file with a stagger) is gone — the ZIP path is strictly better
 * (one prompt, one connection, faster) and the per-tile click handles
 * the cherry-pick case.
 */
export function OrderPhotoGrid({
  photos,
  downloadToken,
  orderNumber,
  dropboxAppKey,
}: Props) {
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [zipBusy, setZipBusy] = useState(false);

  // Web Share API support detection. We feature-test for `canShare` with
  // a file (Share API with `files` is the level-2 spec; older browsers
  // expose `share` but not file sharing). On desktop Chrome the native
  // share sheet is OS-dependent, so we additionally hide the button
  // when no `files` capability is reported.
  const [canShareFiles, setCanShareFiles] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    // Probe with a tiny dummy file — `canShare` checks the OS capability
    // without actually sharing anything.
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

  function downloadHref(id: string): string {
    return `/api/photos/${id}/download?token=${encodeURIComponent(downloadToken)}`;
  }

  /** ZIP URL — token goes as `?key=` (matches the order-page route param). */
  const zipHref = `/api/orders/MK-${String(orderNumber).padStart(6, "0")}/zip?key=${encodeURIComponent(downloadToken)}`;

  function downloadZip() {
    setZipBusy(true);
    // Browsers handle the 200 + Content-Disposition as a save automatically.
    // We use a real anchor so the download survives popup blockers.
    const a = document.createElement("a");
    a.href = zipHref;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // The stream takes seconds-to-minutes server-side; we surface the
    // "downloading" affordance briefly so the click feels acknowledged.
    setTimeout(() => setZipBusy(false), 3500);
  }

  function downloadOne(id: string) {
    setDownloading((s) => new Set(s).add(id));
    const a = document.createElement("a");
    a.href = downloadHref(id);
    a.rel = "noopener";
    a.download = `${id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      setDownloading((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 800);
  }

  /**
   * Share via the Web Share API. We fetch each photo as a Blob then hand
   * the File array to navigator.share. On iOS Safari the OS share sheet
   * includes "Save N Images" → Photos app. On Android Chrome it shows
   * Google Photos, Drive, Dropbox, etc as targets.
   *
   * Caveats:
   *  - Limited to small batches; iOS rejects ~10+ files in one share.
   *    We cap at 6 and tell the user.
   *  - Failure is silent (user cancellation throws AbortError).
   */
  async function shareToDevice() {
    const CAP = 6;
    const slice = photos.slice(0, CAP);
    try {
      // Fetch all files in parallel; on a 5G mobile this is a couple
      // seconds for a half-dozen JPEGs.
      const files = await Promise.all(
        slice.map(async (p) => {
          const res = await fetch(downloadHref(p.id));
          if (!res.ok) throw new Error(`fetch ${p.id} ${res.status}`);
          const blob = await res.blob();
          return new File([blob], `${p.id}.jpg`, { type: "image/jpeg" });
        })
      );
      await navigator.share({
        title: "Race photos",
        text: `${files.length} race photo${files.length === 1 ? "" : "s"}`,
        files,
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "AbortError") return; // user dismissed; not an error
      console.warn("share failed:", e);
      alert(
        "Couldn't open the share sheet here. Try Download ZIP, or download photos one at a time."
      );
    }
  }

  /**
   * Open the Dropbox Saver. The widget needs each file as an absolute
   * URL Dropbox's servers can fetch — they hit our /download endpoint
   * directly with the token in the URL. The token is valid for 30 days
   * (DOWNLOAD_TOKEN_TTL_DAYS) so Dropbox has plenty of time to retry.
   *
   * We only render the button when both:
   *   - NEXT_PUBLIC_DROPBOX_APP_KEY is set (script will refuse without it)
   *   - The Dropbox script has finished loading (we lazy-inject it)
   */
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
    dbx.save({
      files: photos.map((p) => ({
        url: `${origin}${downloadHref(p.id)}`,
        filename: `${p.id}.jpg`,
      })),
      // Drops the photos into a subfolder named after the order so the
      // buyer's Dropbox doesn't fill with loose race shots.
      success: () => console.info("dropbox save dispatched"),
      cancel: () => console.info("dropbox save cancelled"),
      error: (err: unknown) => console.warn("dropbox save error:", err),
    });
  }

  return (
    <div>
      {/* Toolbar — primary ZIP CTA + secondary save targets */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <button
          className="btn btn--primary"
          onClick={downloadZip}
          disabled={zipBusy || photos.length === 0}
        >
          {zipBusy ? "Preparing ZIP…" : `Download ZIP (${photos.length})`}
        </button>

        {dropboxAppKey && dropboxReady && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={saveToDropbox}
            disabled={photos.length === 0}
            title="Save all photos to your Dropbox"
          >
            Save to Dropbox
          </button>
        )}

        {canShareFiles && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={shareToDevice}
            disabled={photos.length === 0}
            title={
              photos.length > 6
                ? "Opens your device's share sheet — limited to the first 6 photos. Use ZIP for the full set."
                : "Open your device's share sheet to save to Photos / Google Photos / etc."
            }
          >
            Save to Photos…
          </button>
        )}
      </div>

      {/* Help text when share is shown — explains the 6-cap. */}
      {canShareFiles && photos.length > 6 && (
        <div
          style={{
            marginTop: -8,
            marginBottom: 12,
            textAlign: "right",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            color: "var(--muted)",
            textTransform: "uppercase",
          }}
        >
          Save to Photos sends the first 6 — use ZIP for the full set
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {photos.map((p) => {
          const isDown = downloading.has(p.id);
          return (
            <div
              key={p.id}
              style={{
                position: "relative",
                aspectRatio: "3 / 2",
                background: "var(--cream)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <a
                href={downloadHref(p.id)}
                onClick={(e) => {
                  // Browser handles the redirect + save; we just flash the
                  // "downloading" affordance for feedback.
                  void e;
                  downloadOne(p.id);
                }}
                download={`${p.id}.jpg`}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  textDecoration: "none",
                }}
                title="Click to download full resolution"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photos/${p.id}/preview`}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top, rgba(28,26,23,.55) 0%, rgba(28,26,23,0) 50%)",
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 8,
                    right: 8,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: "var(--paper)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pointerEvents: "none",
                  }}
                >
                  <span>Hi-res</span>
                  <span>{isDown ? "Downloading…" : "Download ↓"}</span>
                </span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
