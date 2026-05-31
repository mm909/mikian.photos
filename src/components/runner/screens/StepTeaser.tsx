"use client";

import { useState } from "react";
import { Headline } from "../Headline";
import { PhotoThumb } from "../PhotoThumb";
import { EmptyResultsState } from "../FaceCandidateStrip";
import { FaceScanner } from "../FaceScanner";
import { useRunner } from "../RunnerProvider";
import { DISTANCE_LABELS } from "@/lib/gpx";

// Show a single tidy row of previews (4 across on desktop) rather than a
// second, partially-filled row — the full set opens in the viewer below.
const TEASER_COUNT = 4;

/**
 * Step 2 — Teaser. After a bib (or name) search we show our best guess at the
 * runner's face FIRST (so they can confirm who they are before reading their
 * stats), then the matched photos plus the true total. Confirming with
 * "This is me" FILTERS results to just photos containing that face, dropping
 * bib photos that don't show them; "Not me" tries the next guess. Only once the
 * guesses run out do we offer a face scan. When a bib confidently maps to a
 * single face we skip the question entirely (autoConfirmed).
 *
 * "See all my photos" opens the photo viewer over the full result set rather
 * than navigating to a separate grid screen.
 */
export function StepTeaser({ onBack }: { onBack: () => void }) {
  const {
    resultPhotos,
    resultTotal,
    searchLoading,
    searchedBib,
    matchedRacer,
    faceCandidates,
    autoConfirmed,
    expandingCluster,
    confirmFaceCluster,
    openLightbox,
    runFaceSearch,
    faceScanning,
  } = useRunner();

  // Best-guess face = the top candidate the runner hasn't rejected. "Not me"
  // rejects the current guess and falls through to the next.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const bestGuess = faceCandidates.find((c) => !rejected.has(c.clusterId)) ?? null;
  // Did we ever have face suggestions to offer? (Latches via the rejected set
  // so the blank-avatar fallback shows only after they've run out, never
  // during the initial load when candidates haven't arrived yet.)
  const sawCandidates = faceCandidates.length > 0 || rejected.size > 0;

  function acceptGuess() {
    if (!bestGuess) return;
    setAccepted(true);
    // FILTER to just this face — drop bib photos that don't show the runner.
    void confirmFaceCluster(bestGuess.clusterId, true);
  }
  function notMe() {
    if (bestGuess) setRejected((prev) => new Set(prev).add(bestGuess.clusterId));
  }

  function seeAll() {
    if (resultPhotos.length > 0) openLightbox(resultPhotos[0], resultPhotos);
  }

  // Searching → show a loading screen rather than the optimistic, capped
  // client-side hits (which would jump from a few to the real total).
  if (searchLoading) {
    return (
      <main
        className="screen"
        style={{ padding: "120px 24px 160px", display: "flex", justifyContent: "center" }}
      >
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              border: "3px solid var(--line)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin .8s linear infinite",
            }}
          />
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>
            Finding your photos…
          </div>
          {matchedRacer && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Bib #{matchedRacer.bib} · {matchedRacer.name}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Zero matches → reuse the shared empty state (face-scan nudge for bibs).
  if (resultPhotos.length === 0) {
    return (
      <main className="screen" style={{ padding: "56px 24px 96px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <BackButton onBack={onBack} />
          <EmptyResultsState
            matchedRacer={matchedRacer ? { name: matchedRacer.name, bib: matchedRacer.bib } : null}
            searchedBib={searchedBib}
          />
        </div>
      </main>
    );
  }

  const shownPhotos = resultPhotos.slice(0, TEASER_COUNT);
  // Never undercount what's on screen — accepting a face can grow the set past
  // the bib-direct total. The bib is shown in the racer line above, so the
  // headline stays "photos of you" (true for bib + face matches alike).
  const total = Math.max(resultTotal ?? 0, resultPhotos.length);
  const headlineText = `${total} photo${total === 1 ? "" : "s"} of you.`;
  // While the explicit "This is me" filter refetches, overlay a spinner on the
  // grid so it doesn't visibly reflow as non-matching photos drop out.
  const filtering = accepted && expandingCluster;

  const cardStyle: React.CSSProperties = {
    marginTop: 28,
    padding: "22px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    maxWidth: 420,
    marginLeft: "auto",
    marginRight: "auto",
  };
  const eyebrowStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  };

  // Best guess at the runner's face. Rendered ABOVE the stats (the
  // "Bib · finished" meta line) and the headline/photo count so the runner
  // confirms who they are before reading their numbers. Accept ("This is me")
  // to filter results to just this face; "Not me" tries the next guess. Hidden
  // entirely when we auto-confirmed a single confident face. Once the guesses
  // run out we offer a face scan.
  const faceBlock =
    searchedBib && !accepted && !autoConfirmed && sawCandidates ? (
      <div className="card" style={{ ...cardStyle, marginTop: 0, marginBottom: 28 }}>
        {bestGuess ? (
          <>
            <div style={eyebrowStyle}>Is this you?</div>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 999,
                overflow: "hidden",
                border: "3px solid var(--accent)",
                boxShadow: "var(--shadow)",
                background: "var(--surface)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bestGuess.sampleFaceUrl}
                alt="Best guess at your face"
                width={88}
                height={88}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            {bestGuess.photoCountInEvent > 0 && (
              <div
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 17,
                  color: "var(--ink)",
                  fontWeight: 500,
                }}
              >
                {bestGuess.photoCountInEvent} photo
                {bestGuess.photoCountInEvent === 1 ? "" : "s"} with your face
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn--primary"
                onClick={acceptGuess}
                disabled={expandingCluster}
                style={{ justifyContent: "center" }}
              >
                {expandingCluster ? "Finding your photos…" : "This is me"}
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={notMe}
                disabled={expandingCluster}
              >
                Not me
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={eyebrowStyle}>Don&rsquo;t see yourself?</div>
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed var(--line)",
                background: "var(--cream)",
              }}
            >
              <svg
                width={46}
                height={46}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--warm)"
                strokeWidth={1.6}
                aria-hidden
              >
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M5 19.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
              Scan your face and we&rsquo;ll find your photos.
            </div>
            <button
              className="btn btn--primary"
              onClick={() => setScannerOpen(true)}
              disabled={faceScanning}
              style={{ minWidth: 200, justifyContent: "center" }}
            >
              {faceScanning ? "Scanning…" : "Scan your face"}
            </button>
          </>
        )}
      </div>
    ) : null;

  return (
    <main className="screen" style={{ padding: "56px 24px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        {/* Face selection — ABOVE the stats (Bib · finished) + photo count. */}
        {faceBlock}

        <div style={{ ...eyebrowStyle, marginBottom: 12 }}>
          {matchedRacer
            ? `Bib #${matchedRacer.bib} · ${matchedRacer.name} · ${DISTANCE_LABELS[matchedRacer.distance]} · finished ${matchedRacer.finishTime}`
            : "We found your photos"}
        </div>

        <Headline
          as="h1"
          text={headlineText}
          accent="of you"
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: "clamp(32px, 4.2vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-.015em",
            color: "var(--ink)",
          }}
        />

        {/* A handful of matches — small previews only. Clicking any opens the
            full gallery viewer at that photo. While the "This is me" filter
            runs we overlay a spinner so the grid doesn't jump. */}
        <div style={{ position: "relative", marginTop: 28 }}>
          <div
            style={{
              display: "grid",
              // Cap the column width so a 1–2 photo result doesn't blow each
              // tile up to full width; center the (possibly short) row.
              gridTemplateColumns: "repeat(auto-fit, minmax(110px, 160px))",
              justifyContent: "center",
              gap: 12,
              opacity: filtering ? 0.3 : 1,
              transition: "opacity .2s ease",
              pointerEvents: filtering ? "none" : "auto",
            }}
          >
            {shownPhotos.map((p) => (
              <PhotoThumb
                key={p.id}
                photo={p}
                onClick={() => openLightbox(p, resultPhotos)}
                onExpand={() => openLightbox(p, resultPhotos)}
              />
            ))}
          </div>
          {filtering && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  border: "3px solid var(--line)",
                  borderTopColor: "var(--accent)",
                  borderRadius: "50%",
                  animation: "spin .8s linear infinite",
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                Finding your photos…
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn--ghost btn--lg" onClick={onBack}>
            ← Search again
          </button>
          <button className="btn btn--primary btn--lg" onClick={seeAll}>
            See all my photos →
          </button>
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

/** "← Search again" — returns to the landing search (e.g. after a typo). */
function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        background: "transparent",
        border: 0,
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        cursor: "pointer",
        padding: 0,
        marginBottom: 16,
      }}
    >
      ← Search again
    </button>
  );
}
