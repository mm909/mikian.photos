"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Headline } from "../Headline";
import { JustifiedPhotoGrid } from "../JustifiedPhotoGrid";
import { PhotoViewer } from "../PhotoViewer";
import { useFeatureControls } from "../useFeatureControls";
import { EmptyResultsState } from "../FaceCandidateStrip";
import { FaceScanner } from "../FaceScanner";
import { useRunner } from "../RunnerProvider";
import { DISTANCE_LABELS } from "@/lib/gpx";

/**
 * Step 2 — the single results page (search → HERE → checkout).
 *
 * The old teaser (4 thumbnails + "See all my photos") and the full gallery
 * were merged into this one screen: a Google-Photos-style justified grid over
 * the WHOLE matched set, with the teaser's pieces folded in —
 *   - the loading screen while the bib search's server fetch is in flight,
 *   - the "Is this you?" face-confirm card (accept FILTERS results to that
 *     face; "Not me" tries the next guess; once confirmed, a clear control
 *     restores the full bib set),
 *   - the racer meta line (bib · name · distance · finish),
 *   - the empty state (face-scan nudge) when nothing matched.
 *
 * The checkout CTA lives at the TOP of the page (next to the count headline)
 * and again in the full-screen viewer's action slot — no bottom bar.
 */
export function StepAll({ onBack }: { onBack: () => void }) {
  const {
    resultPhotos,
    resultTotal,
    resultIds,
    searchLoading,
    searchedBib,
    matchedRacer,
    faceCandidates,
    autoConfirmed,
    expandingCluster,
    confirmedClusterId,
    confirmFaceCluster,
    runFaceSearch,
    faceScanning,
    faceScanStatus,
    faceDone,
    event,
    bundlePrice,
    isFree,
    bundleInCart,
    addBundle,
  } = useRunner();
  const router = useRouter();
  const feature = useFeatureControls();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Best-guess face state (ported from the retired teaser step). "Not me"
  // rejects the current guess and falls through to the next candidate.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [accepted, setAccepted] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Auto-close the face scanner once a scan FINISHES with a match — otherwise
  // the modal (live camera feed) stays open over the freshly-updated results
  // grid and the user has to dismiss it manually to see their photos. Gated on
  // the faceScanning true→false edge (not just status === "matched") so a
  // re-scan after an earlier match still closes; a no-match leaves it open for
  // an in-place retry.
  const wasScanning = useRef(false);
  useEffect(() => {
    if (wasScanning.current && !faceScanning && faceScanStatus === "matched") {
      setScannerOpen(false);
    }
    wasScanning.current = faceScanning;
  }, [faceScanning, faceScanStatus]);

  const bestGuess = faceCandidates.find((c) => !rejected.has(c.clusterId)) ?? null;
  // Did we ever have face suggestions to offer? (Latches via the rejected set
  // so the fallback shows only after they've run out, never during the initial
  // load when candidates haven't arrived yet.)
  const sawCandidates = faceCandidates.length > 0 || rejected.size > 0;

  function acceptGuess() {
    if (!bestGuess) return;
    setAccepted(true);
    // UNION — ADD the photos we matched to this face ON TOP of the bib set
    // (this rescues photos where the bib wasn't readable), rather than
    // filtering the bib set down to only face-bearing photos. Confirming
    // "this is me" should only ever grow a runner's results, never shrink them.
    void confirmFaceCluster(bestGuess.clusterId, false);
  }
  function notMe() {
    if (bestGuess) setRejected((prev) => new Set(prev).add(bestGuess.clusterId));
  }
  // Undo the face match: drop the face-rescued photos and go back to the bib
  // set, re-showing the guess card.
  function clearFace() {
    setAccepted(false);
    setRejected(new Set());
    void confirmFaceCluster(null);
  }

  /* ---- Loading: bib search's server fetch in flight -------------------- */
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

  /* ---- Empty: nothing matched — nudge a face scan ---------------------- */
  if (resultPhotos.length === 0) {
    return (
      <main className="screen" style={{ padding: "56px 24px 96px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <button className="btn btn--ghost btn--sm" onClick={onBack} style={{ marginBottom: 16 }}>
            ← Search again
          </button>
          <EmptyResultsState
            matchedRacer={matchedRacer ? { name: matchedRacer.name, bib: matchedRacer.bib } : null}
            searchedBib={searchedBib}
          />
        </div>
      </main>
    );
  }

  /* ---- Results ---------------------------------------------------------- */

  // Grid/viewer take {id, src}. previewUrl is the public CDN url from the
  // catalog; fall back to the access-gated preview route on the rare miss.
  const gridPhotos = resultPhotos.map((p) => ({
    id: p.id,
    src: p.previewUrl ?? `/api/photos/${p.id}/preview`,
  }));
  // Never undercount what a bundle covers: resultIds is the full matched set
  // (resultPhotos is display-capped), and a confirmed face can grow the set
  // past the bib-direct total.
  const total = Math.max(resultTotal ?? 0, resultIds.length, resultPhotos.length);

  // Personal set (bib/face search) vs. a whole-event browse.
  const personal = Boolean(searchedBib) || faceScanStatus === "matched" || faceDone;
  const headlineText = personal
    ? `${total} photo${total === 1 ? "" : "s"} of you.`
    : `All ${total} photo${total === 1 ? "" : "s"}.`;
  const headlineAccent = personal ? "of you." : "photos.";

  // While the explicit "This is me" filter refetches, overlay a spinner on the
  // grid so it doesn't visibly reflow as non-matching photos drop out.
  const filtering = accepted && expandingCluster;

  function goCheckout() {
    // Snapshot the currently-matched set into the bundle, then to checkout.
    addBundle();
    router.push("/checkout");
  }

  const ctaLabel = bundleInCart
    ? "Checkout →"
    : isFree
      ? `Get all ${total} photos`
      : `Get all ${total} — $${bundlePrice}`;

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: "var(--muted)",
  };
  const cardStyle: React.CSSProperties = {
    padding: "22px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    maxWidth: 420,
    margin: "0 auto 26px",
  };

  // Face selection — only one of these is ever non-null: the guess card before
  // a face is confirmed, or the clear control while a face filter is active.
  const faceFilterActive = accepted && Boolean(confirmedClusterId);
  const clearControl = faceFilterActive ? (
    <div className="card" style={cardStyle}>
      <div style={eyebrowStyle}>Including photos we matched to your face</div>
      <button className="btn btn--ghost btn--sm" onClick={clearFace} disabled={expandingCluster}>
        ← Show bib photos only
      </button>
    </div>
  ) : null;

  const faceBlock =
    searchedBib && !confirmedClusterId && !autoConfirmed && sawCandidates ? (
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
              <button className="btn btn--ghost btn--sm" onClick={notMe} disabled={expandingCluster}>
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

  // Meta line above the headline: the racer's stats when the roster knows
  // them, else the bib, else the event name.
  const metaLine = matchedRacer
    ? `Bib #${matchedRacer.bib} · ${matchedRacer.name} · ${DISTANCE_LABELS[matchedRacer.distance]} · finished ${matchedRacer.finishTime}`
    : searchedBib
      ? `Bib #${searchedBib}${event?.name ? ` · ${event.name}` : ""}`
      : event?.name ?? "";

  return (
    <main className="screen" style={{ padding: "36px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Back — return to search (e.g. after a typo). */}
        <div style={{ marginBottom: 18 }}>
          <button className="btn btn--ghost btn--sm" onClick={onBack}>
            ← Search again
          </button>
        </div>

        {/* Face selection card — confirm who you are before the numbers. */}
        {faceBlock}
        {clearControl}

        {/* Headline row — count on the left, price + checkout CTA on the
            right (the top-of-page buy affordance; it repeats inside the
            viewer's action slot). */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "14px 28px",
            flexWrap: "wrap",
          }}
        >
          <div>
            {metaLine && <div style={{ ...eyebrowStyle, marginBottom: 10 }}>{metaLine}</div>}
            <Headline
              as="h1"
              text={headlineText}
              accent={headlineAccent}
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 500,
                fontSize: "clamp(28px, 3.6vw, 42px)",
                lineHeight: 1.05,
                letterSpacing: "-.015em",
                color: "var(--ink)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              paddingBottom: 4,
            }}
          >
            {!isFree && (
              <span className="price" style={{ fontSize: 28, lineHeight: 1 }}>
                ${bundlePrice}
              </span>
            )}
            <button className="btn btn--primary btn--lg" onClick={goCheckout}>
              {ctaLabel}
            </button>
          </div>
        </div>
        <div style={{ ...eyebrowStyle, fontSize: 10, marginTop: 8 }}>
          Full resolution · yours to keep
        </div>

        {/* The grid — dimmed under a spinner while the face filter refetches
            so it doesn't visibly reflow as photos drop out. */}
        <div style={{ position: "relative", marginTop: 20 }}>
          <div
            style={{
              opacity: filtering ? 0.3 : 1,
              transition: "opacity .2s ease",
              pointerEvents: filtering ? "none" : "auto",
            }}
          >
            <JustifiedPhotoGrid photos={gridPhotos} onOpen={(i) => setViewerIndex(i)} />
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
              <div style={eyebrowStyle}>Finding your photos…</div>
            </div>
          )}
        </div>
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={gridPhotos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndex={(i) => setViewerIndex(i)}
          feature={feature}
          actions={() => (
            <button className="btn btn--primary btn--sm" onClick={goCheckout}>
              {ctaLabel}
            </button>
          )}
        />
      )}

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
