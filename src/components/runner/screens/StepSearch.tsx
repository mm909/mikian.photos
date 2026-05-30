"use client";

import { useState } from "react";
import { Headline } from "../Headline";
import { FaceScanner } from "../FaceScanner";
import { useRunner } from "../RunnerProvider";
import { BibSearchForm } from "../BibSearchForm";
import { currentEvent } from "@/lib/data";

/**
 * Step 1 — Search. The runner lands here. Bib number is the primary path
 * (default, autofocused); "scan your face" is the softer secondary for those
 * without a bib. On a bib submit we advance to the teaser immediately — the
 * provider's optimistic results are already on screen and upgrade in place.
 *
 * The face path opens the live camera scanner; once a scan matches, the
 * orchestrator (RunnerFlow) advances to the teaser by watching faceScanStatus.
 */
export function StepSearch({ onAdvance }: { onAdvance: () => void }) {
  const { runFaceSearch, faceScanning, catalog, catalogLoading, catalogTotal } = useRunner();
  const [scannerOpen, setScannerOpen] = useState(false);

  const raceName = `${currentEvent.name[0]} ${currentEvent.name[1]} ${currentEvent.name[2]}`.trim();
  const raceAccent = currentEvent.name[0];
  // Live count = the true uncapped event total. The catalog array is capped by
  // the API cost guardrail, so catalog.length undercounts; fall back to it only
  // if the total didn't come back.
  const photoCount = catalogLoading ? null : catalogTotal ?? (catalog.length || null);

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
            {photoCount ? `${photoCount.toLocaleString()} photos live` : "Photos live"} · {currentEvent.date}
          </div>

          <Headline
            as="h1"
            text={`Find your ${raceName} photos.`}
            accent={raceAccent}
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

          {/* Event meta — date · city · distances · live count. One combined
              event; the bib tells us which distance, so no chooser. */}
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
            <span>{currentEvent.city}</span>
            <span aria-hidden>·</span>
            <span>Half · 10K · 5K</span>
          </div>

          <div
            className="card"
            style={{ padding: 24, marginTop: 28, display: "flex", flexDirection: "column" }}
          >
            {/* Primary: bib number — shared search model (also reused in the
                empty-results state). */}
            <BibSearchForm onSearched={onAdvance} autoFocus />

            {/* Softer secondary: face scan for those without a bib */}
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
              <span>No bib?</span>
              <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <button
              className="btn btn--ghost btn--block"
              onClick={() => setScannerOpen(true)}
              disabled={faceScanning}
            >
              {faceScanning ? "Scanning…" : "Scan your face instead"}
            </button>

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
        subtitle="Center your face in the circle. We only use this to find your race photos."
      />
    </main>
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
