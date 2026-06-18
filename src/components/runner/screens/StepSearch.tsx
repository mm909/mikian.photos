"use client";

import { useState } from "react";
import { Headline } from "../Headline";
import { FaceScanner } from "../FaceScanner";
import { useRunner } from "../RunnerProvider";
import { BibSearchForm } from "../BibSearchForm";

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
 * Step 1 — Search. The landing screen, scoped to the event's TYPE:
 *   - race    → bib number is the primary path (autofocused), face the softer
 *               secondary. Bib submit advances to the teaser.
 *   - gallery → no bib/roster. "Find yourself by selfie" (when face detection is
 *               on) and/or "Browse all photos". No race distances or course.
 */
export function StepSearch({ onAdvance }: { onAdvance: () => void }) {
  const {
    runFaceSearch,
    runSearch,
    faceScanning,
    catalog,
    catalogLoading,
    catalogTotal,
    event,
    capabilities,
  } = useRunner();
  const [scannerOpen, setScannerOpen] = useState(false);

  // Render strictly from capabilities. Until they load, show a neutral loading
  // state — never flash the race bib/name form (e.g. on a camp event).
  const loadingCaps = !capabilities;
  const hasBib = capabilities?.searchModes.includes("bib") ?? false;
  const hasFace = capabilities?.searchModes.includes("face") ?? false;

  const raceName = event
    ? `${event.nameParts[0]} ${event.nameParts[1]} ${event.nameParts[2]}`.trim()
    : "";
  const raceAccent = event?.nameParts[0] || "";
  const dateLabel = event ? formatEventDate(event.date) : "";
  // Live count = the true uncapped event total. The catalog array is capped by
  // the API cost guardrail, so catalog.length undercounts; fall back to it only
  // if the total didn't come back.
  const photoCount = catalogLoading ? null : catalogTotal ?? (catalog.length || null);

  // Only a race (bib) event personalizes the headline with the event name.
  const headlineText = hasBib && raceName ? `Find your ${raceName} photos.` : "Find your photos.";
  const headlineAccent = hasBib && raceName ? raceAccent : "photos.";

  // When the owner has set an external album link (e.g. a shared Google Photos
  // album), "Browse all photos" links out to it instead of opening the in-app
  // gallery — the album's own unlisted-link sharing is the access boundary.
  const externalBrowse = event?.externalBrowseUrl || null;

  function browseAll() {
    if (externalBrowse) {
      window.open(externalBrowse, "_blank", "noopener,noreferrer");
      return;
    }
    runSearch({ kind: "browse" });
    onAdvance();
  }

  const browseLabel = `Browse all photos${externalBrowse ? " ↗" : ""}`;

  return (
    <main className="screen" style={{ padding: "64px 32px 96px" }}>
      <div
        className="landing-grid"
        style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column" }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 18,
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
              fontSize: "clamp(40px, 5.2vw, 64px)",
              lineHeight: 1.02,
              letterSpacing: "-.018em",
              color: "var(--ink)",
              textWrap: "balance" as React.CSSProperties["textWrap"],
            }}
          />

          {/* Event meta — city (+ race distances only for race events). */}
          <div
            style={{
              marginTop: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--muted)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {event?.city ? (
              <>
                <span>{event.city}</span>
                {hasBib ? <span aria-hidden>·</span> : null}
              </>
            ) : null}
            {hasBib ? <span>Half · 10K · 5K</span> : null}
          </div>

          <div
            className="card"
            style={{ padding: 24, marginTop: 28, display: "flex", flexDirection: "column" }}
          >
            {loadingCaps ? (
              <div
                style={{
                  padding: "16px 0",
                  textAlign: "center",
                  color: "var(--muted)",
                  fontSize: 14,
                }}
              >
                Loading…
              </div>
            ) : hasBib ? (
              <>
                {/* Primary: bib number (also reused in the empty-results state). */}
                <BibSearchForm onSearched={onAdvance} autoFocus />
                <Divider label="No bib?" />
                <button
                  className="btn btn--ghost btn--block"
                  onClick={() => setScannerOpen(true)}
                  disabled={faceScanning}
                >
                  {faceScanning ? "Scanning…" : "Scan your face instead"}
                </button>
              </>
            ) : hasFace ? (
              <>
                {/* Gallery with face detection: selfie find, or browse everything. */}
                <button
                  className="btn btn--primary btn--block"
                  onClick={() => setScannerOpen(true)}
                  disabled={faceScanning}
                >
                  {faceScanning ? "Scanning…" : "Find yourself by selfie"}
                </button>
                <Divider label="or" />
                <button className="btn btn--ghost btn--block" onClick={browseAll}>
                  {browseLabel}
                </button>
              </>
            ) : (
              // Browse-only gallery (no face/bib).
              <button className="btn btn--primary btn--block" onClick={browseAll}>
                {browseLabel}
              </button>
            )}

            <div style={{ flex: 1 }} />
            <LegalFooter />
          </div>
        </div>
      </div>

      <FaceScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCapture={runFaceSearch}
        busy={faceScanning}
        subtitle="Center your face in the circle. We only use this to find your photos."
      />
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
        margin: "20px 0 16px",
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
        marginTop: 16,
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
