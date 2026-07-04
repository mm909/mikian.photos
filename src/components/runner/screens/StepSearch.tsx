"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Headline } from "../Headline";
import { FaceScanner } from "../FaceScanner";
import { JustifiedPhotoGrid } from "../JustifiedPhotoGrid";
import { PhotoViewer } from "../PhotoViewer";
import { useFeatureControls } from "../useFeatureControls";
import { useRunner } from "../RunnerProvider";
import { BibSearchForm } from "../BibSearchForm";
import { ROSTER_EVENT_ID } from "@/lib/data";

/** Format an ISO event date as MM.DD.YY (UTC, to match the stored event time). */
function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

/**
 * Step 1 — Search, as a PORTFOLIO landing.
 *
 * The photos lead: a justified mosaic of the owner's featured shots (or a
 * random sample when nothing is pinned) is the visual centerpiece, with a
 * compact, understated search affordance above it — scoped to the event's TYPE:
 *   - race    → bib number is primary, face the softer secondary.
 *   - gallery → selfie find and/or browse-all (no bib/roster).
 *
 * Tapping a mosaic photo opens the full-screen viewer; for the owner that
 * viewer carries the ★ toggle, so featured photos can be curated right here.
 */
export function StepSearch({ onAdvance }: { onAdvance: () => void }) {
  const {
    runFaceSearch,
    faceScanning,
    catalog,
    catalogLoading,
    catalogTotal,
    event,
    capabilities,
    activeEventId,
    featuredPhotos,
  } = useRunner();
  const feature = useFeatureControls();
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  // Full-screen peek at a mosaic photo (and the owner's ★ curation surface).
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Render strictly from capabilities. Until they load, show a neutral loading
  // state — never flash the race bib/name form (e.g. on a camp event).
  const loadingCaps = !capabilities;
  const hasBib = capabilities?.searchModes.includes("bib") ?? false;
  const hasFace = capabilities?.searchModes.includes("face") ?? false;
  // The "Half · 10K · 5K" lineup is Lighthouse's actual distance set — only
  // show it on that event. Other races have their own (unknown to us) distances,
  // so showing Lighthouse's here would be cross-event misinformation.
  const showDistances = activeEventId === ROSTER_EVENT_ID;

  const raceName = event
    ? `${event.nameParts[0]} ${event.nameParts[1]} ${event.nameParts[2]}`.trim()
    : "";
  const raceAccent = event?.nameParts[0] || "";
  const dateLabel = event ? formatEventDate(event.date) : "";
  const photoCount = catalogLoading ? null : catalogTotal ?? (catalog.length || null);

  // Owner-set custom headline wins; otherwise only a race (bib) event
  // personalizes the headline with the event name.
  const customHeadline = event?.searchHeadline?.trim();
  const headlineText =
    customHeadline || (hasBib && raceName ? `Find your ${raceName} photos.` : "Find your photos.");
  const headlineAccent = customHeadline
    ? customHeadline.split(/\s+/).slice(-1)[0] || ""
    : hasBib && raceName
      ? raceAccent
      : "photos.";

  const externalBrowse = event?.externalBrowseUrl || null;
  // Whether "Browse all photos" is offered here. The gallery is the browse
  // destination, so honor the same owner-only visibility as the Gallery tab
  // (feature.canFeature == owner). An external album link is always allowed.
  const galleryPublic = (event?.galleryVisibility ?? "public") !== "owner";
  const showBrowse = Boolean(externalBrowse) || galleryPublic || feature.canFeature;

  function browseAll() {
    if (externalBrowse) {
      window.open(externalBrowse, "_blank", "noopener,noreferrer");
      return;
    }
    // Go to the SAME place as the Gallery tab — the in-app browse wall — not the
    // old in-flow browse (which showed a buy CTA).
    if (activeEventId) router.push(`/e/${activeEventId}/gallery`);
  }

  const browseLabel = `Browse all photos${externalBrowse ? " ↗" : ""}`;

  // Mosaic photos for the portfolio hero (owner-featured first, then random).
  const heroPhotos = featuredPhotos.map((f) => ({ id: f.id, src: f.previewUrl }));

  return (
    <main className="screen" style={{ padding: "44px 24px 72px" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        {/* Editorial header + compact search — kept tight so the photos lead. */}
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 16,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="live-dot" />
            {photoCount ? `${photoCount.toLocaleString()} photos live` : "Photos live"}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </div>

          <Headline
            as="h1"
            text={headlineText}
            accent={headlineAccent}
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(34px, 4.6vw, 58px)",
              lineHeight: 1.02,
              letterSpacing: "-.018em",
              color: "var(--ink)",
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          />

          {(event?.city || showDistances) && (
            <div
              style={{
                marginTop: 14,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--muted)",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {event?.city ? (
                <>
                  <span>{event.city}</span>
                  {showDistances ? <span aria-hidden>·</span> : null}
                </>
              ) : null}
              {showDistances ? <span>Half · 10K · 5K</span> : null}
            </div>
          )}

          {/* Compact search card — the single primary action + subtle
              secondaries. Much lighter than the old full-height card. */}
          <div className="portfolio-search">
            {loadingCaps ? (
              <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 14 }}>Loading…</div>
            ) : hasBib ? (
              <>
                <BibSearchForm onSearched={onAdvance} autoFocus />
                <Divider label="No bib?" />
                <button
                  className="btn btn--primary btn--block"
                  onClick={() => setScannerOpen(true)}
                  disabled={faceScanning}
                >
                  {faceScanning ? "Scanning…" : "Scan your face"}
                </button>
                {showBrowse && (
                  <div className="portfolio-search__secondary">
                    <button type="button" className="link-quiet" onClick={browseAll}>
                      {browseLabel}
                    </button>
                  </div>
                )}
              </>
            ) : hasFace ? (
              <>
                <button
                  className="btn btn--primary btn--block"
                  onClick={() => setScannerOpen(true)}
                  disabled={faceScanning}
                >
                  {faceScanning ? "Scanning…" : "Find yourself by selfie"}
                </button>
                {showBrowse && (
                  <div className="portfolio-search__secondary">
                    <button type="button" className="link-quiet" onClick={browseAll}>
                      {browseLabel}
                    </button>
                  </div>
                )}
              </>
            ) : showBrowse ? (
              <button className="btn btn--primary btn--block" onClick={browseAll}>
                {browseLabel}
              </button>
            ) : (
              <div style={{ padding: "10px 0", color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
                Search for your photos above.
              </div>
            )}
          </div>
        </div>

        {/* Portfolio mosaic — the visual anchor. Tapping a photo opens the
            viewer (owner sees the ★ toggle there for in-place curation). */}
        {heroPhotos.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <JustifiedPhotoGrid
              photos={heroPhotos}
              onOpen={(i) => setViewerIndex(i)}
              targetRowHeight={210}
            />
          </div>
        )}

        <LegalFooter />
      </div>

      <FaceScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCapture={runFaceSearch}
        busy={faceScanning}
        subtitle="Center your face in the circle. We only use this to find your photos."
      />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={heroPhotos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndex={(i) => setViewerIndex(i)}
          feature={feature}
        />
      )}
    </main>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "18px 0 14px",
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: ".14em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span>{label}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function LegalFooter() {
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--muted)",
        marginTop: 40,
        textAlign: "center",
        display: "flex",
        gap: 12,
        justifyContent: "center",
      }}
    >
      <a href="/terms" style={{ color: "var(--muted)" }}>
        Terms
      </a>
      <span aria-hidden>·</span>
      <a href="/privacy" style={{ color: "var(--muted)" }}>
        Privacy
      </a>
    </div>
  );
}
