"use client";

import { useState } from "react";
import { Headline } from "../Headline";
import { PhotoThumb } from "../PhotoThumb";
import { EmptyResultsState } from "../FaceCandidateStrip";
import { FaceScanner } from "../FaceScanner";
import { useRunner } from "../RunnerProvider";

const TEASER_COUNT = 6;

/**
 * Step 2 — Teaser. After a bib (or name) search we show a handful of matches
 * plus the true total. We also present our single best guess at the runner's
 * face: they can accept it (pulls in the photos the bib OCR missed), say "Not
 * me" to see the next guess, or scan their face to find themselves directly.
 * When the suggestions run out we keep a blank-avatar "scan your face" option.
 */
export function StepTeaser({ onSeeAll }: { onSeeAll: () => void }) {
  const {
    resultPhotos,
    resultTotal,
    searchLoading,
    searchedBib,
    matchedRacer,
    faceCandidates,
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
  const shownIds = new Set(resultPhotos.map((p) => p.id));
  const addCount = bestGuess
    ? bestGuess.photoIdsInEvent.filter((id) => !shownIds.has(id)).length
    : 0;
  // Did we ever have face suggestions to offer? (Latches via the rejected set
  // so the blank-avatar fallback shows only after they've run out, never
  // during the initial load when candidates haven't arrived yet.)
  const sawCandidates = faceCandidates.length > 0 || rejected.size > 0;

  function acceptGuess() {
    if (!bestGuess) return;
    setAccepted(true);
    void confirmFaceCluster(bestGuess.clusterId);
  }
  function notMe() {
    if (bestGuess) setRejected((prev) => new Set(prev).add(bestGuess.clusterId));
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

  // Zero matches → reuse the shared empty state (face-scan nudge for bibs),
  // but still let the runner continue to the full gallery.
  if (resultPhotos.length === 0) {
    return (
      <main className="screen" style={{ padding: "56px 24px 96px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <EmptyResultsState
            matchedRacer={matchedRacer ? { name: matchedRacer.name, bib: matchedRacer.bib } : null}
            searchedBib={searchedBib}
          />
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={onSeeAll}>
              See the full gallery →
            </button>
          </div>
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

  const cardStyle: React.CSSProperties = {
    marginTop: 26,
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

  return (
    <main className="screen" style={{ padding: "56px 24px 96px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
        <div style={{ ...eyebrowStyle, marginBottom: 12 }}>
          {matchedRacer
            ? `Bib #${matchedRacer.bib} · ${matchedRacer.name} · finished ${matchedRacer.finishTime}`
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

        {/* Best guess at the runner's face — accept to pull in the photos the
            bib OCR missed, "Not me" to try the next guess, or scan to find
            yourself directly. Once the guesses run out we keep a blank-avatar
            "scan your face" option. */}
        {searchedBib && !accepted && sawCandidates && (
          <div className="card" style={cardStyle}>
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
                {addCount > 0 && (
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 17,
                      color: "var(--ink)",
                      fontWeight: 500,
                    }}
                  >
                    Adds {addCount} more photo{addCount === 1 ? "" : "s"}
                  </div>
                )}
                <button
                  className="btn btn--primary"
                  onClick={acceptGuess}
                  disabled={expandingCluster}
                  style={{ minWidth: 200, justifyContent: "center" }}
                >
                  {expandingCluster ? "Adding…" : "Yes, that's me"}
                </button>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="btn btn--ghost btn--sm" onClick={notMe} disabled={expandingCluster}>
                    Not me
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setScannerOpen(true)}
                    disabled={faceScanning}
                  >
                    {faceScanning ? "Scanning…" : "Scan your face"}
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
        )}

        {/* A handful of matches — small previews only, full grid comes next.
            The preview window is scoped to just these so it doesn't page
            through the whole capped result set. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 12,
            marginTop: 28,
          }}
        >
          {shownPhotos.map((p) => (
            <PhotoThumb
              key={p.id}
              photo={p}
              onClick={() => openLightbox(p, shownPhotos)}
              onExpand={() => openLightbox(p, shownPhotos)}
            />
          ))}
        </div>

        <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
          <button className="btn btn--primary btn--lg" onClick={onSeeAll}>
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
