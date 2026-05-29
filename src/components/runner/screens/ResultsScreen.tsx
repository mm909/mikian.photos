"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Headline } from "../Headline";
import { PhotoThumb } from "../PhotoThumb";
import { FaceSuggestBanner } from "../FaceSuggestBanner";
import { BibSuggestBanner } from "../BibSuggestBanner";
import { useRunner, type FaceCandidate } from "../RunnerProvider";
import { currentEvent, prices } from "@/lib/data";

export function ResultsScreen() {
  const router = useRouter();
  const {
    catalog,
    catalogLoading,
    resultPhotos,
    matchedRacer,
    searchedBib,
    searchFellBack,
    faceSuggest,
    bibSuggest,
    acceptFaceSuggest,
    dismissFaceSuggest,
    acceptBibSuggest,
    dismissBibSuggest,
    addBundle,
    bundleInCart,
    openLightbox,
    addBib,
    runFaceSearch,
    faceScanning,
    faceScanStatus,
    faceDone,
    faceCandidates,
    confirmedClusterId,
    expandingCluster,
    confirmFaceCluster,
  } = useRunner();

  // Pre-select the only face when there's just one candidate. No need to
  // make the runner click — the disambiguation only matters with 2+
  // faces in the bib's photos. Guarded so we don't re-fire while a
  // confirmation request is already in flight.
  useEffect(() => {
    if (
      faceCandidates.length === 1 &&
      !confirmedClusterId &&
      !expandingCluster
    ) {
      void confirmFaceCluster(faceCandidates[0].clusterId);
    }
  }, [faceCandidates, confirmedClusterId, expandingCluster, confirmFaceCluster]);

  // Real event totals derived from the fetched catalog. The synthetic
  // currentEvent.photoCount / .photographers are placeholders — don't show
  // those.
  const realPhotoCount = catalog.length;
  const realPhotographerCount = new Set(
    catalog.map((p) => p.photographerId).filter(Boolean)
  ).size;

  const [drawerOpen, setDrawer] = useState(false);
  const [bib, setBib] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const event = currentEvent;

  const headlineStyle = {
    fontFamily: "var(--font-serif)",
    fontWeight: 500 as const,
    fontSize: 40,
    lineHeight: 1.05,
    letterSpacing: "-.012em",
    color: "var(--ink)",
  };

  function onBundleAdd() {
    if (!bundleInCart) addBundle();
    router.push("/checkout");
  }

  return (
    <main className="screen">
      {/* Header band */}
      <header style={{ background: "var(--ink-deep)", color: "var(--paper)", padding: "44px 32px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#bfb6a3",
              marginBottom: 12,
            }}
          >
            {event.org}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: "clamp(36px, 4.4vw, 56px)",
              lineHeight: 1,
              letterSpacing: "-.018em",
              color: "var(--paper)",
            }}
          >
            <em className="acc-l">{event.name[0]}</em> {event.name[1]} {event.name[2]}
          </h1>
          <div
            style={{
              marginTop: 18,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "#bfb6a3",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span>{event.date}</span>
            <span>·</span>
            <span>{event.city}</span>
            <span>·</span>
            <span>{realPhotoCount.toLocaleString()} photo{realPhotoCount === 1 ? "" : "s"}</span>
            {realPhotographerCount > 0 && (
              <>
                <span>·</span>
                <span>
                  {realPhotographerCount} photographer{realPhotographerCount === 1 ? "" : "s"}
                </span>
              </>
            )}
            <span>·</span>
            <span style={{ color: "#5dbf85", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="live-dot" style={{ background: "#5dbf85" }} /> Live
            </span>
          </div>
        </div>
      </header>

      {/* Match summary bar */}
      <section
        style={{
          background: "var(--paper)",
          padding: "32px 32px 28px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          {matchedRacer && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 8,
              }}
            >
              Bib #{matchedRacer.bib} · {matchedRacer.name} · finished {matchedRacer.finishTime}
            </div>
          )}
          {/* Headline + inline buy CTA on one row. Drops the standalone
              BundleBar visual block in favour of price + button right next
              to the photos-found count. */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 24,
              flexWrap: "wrap",
            }}
          >
            <div>
              {catalogLoading ? (
                <Headline
                  as="div"
                  text="Loading photos…"
                  accent="photos…"
                  style={headlineStyle}
                />
              ) : searchFellBack && searchedBib ? (
                <Headline
                  as="div"
                  text={`No photos tagged #${searchedBib} yet.`}
                  accent="No photos"
                  style={headlineStyle}
                />
              ) : (
                <Headline
                  as="div"
                  text={`${resultPhotos.length} photo${resultPhotos.length === 1 ? "" : "s"} found.`}
                  accent="found."
                  style={headlineStyle}
                />
              )}
            </div>
            {resultPhotos.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontWeight: 500,
                    color: "var(--accent)",
                    fontSize: 36,
                    lineHeight: 1,
                    fontVariantNumeric: "lining-nums tabular-nums",
                  }}
                >
                  ${prices.bundle}
                </span>
                <button className="btn btn--primary btn--lg" onClick={onBundleAdd}>
                  {bundleInCart ? "Checkout →" : "Get them all →"}
                </button>
              </div>
            )}
          </div>

          {faceSuggest && (
            <div style={{ marginTop: 22 }}>
              <FaceSuggestBanner
                bib={faceSuggest.bib}
                count={faceSuggest.count}
                sampleTones={faceSuggest.tones}
                onYes={acceptFaceSuggest}
                onNo={dismissFaceSuggest}
              />
            </div>
          )}

          {bibSuggest && (
            <div style={{ marginTop: faceSuggest ? 0 : 22 }}>
              <BibSuggestBanner
                bib={bibSuggest.bib}
                count={bibSuggest.count}
                sampleTones={bibSuggest.tones}
                onYes={acceptBibSuggest}
                onNo={dismissBibSuggest}
              />
            </div>
          )}

          <div
            style={{
              marginTop: faceSuggest || bibSuggest ? 4 : 20,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {drawerOpen ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (bib.trim()) {
                    addBib(bib.trim());
                    setBib("");
                    setDrawer(false);
                  }
                }}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  className="input"
                  autoFocus
                  placeholder="bib #"
                  value={bib}
                  onChange={(e) => setBib(e.target.value)}
                  style={{ width: 140, padding: "8px 12px", fontSize: 14 }}
                />
                <button type="submit" className="btn btn--primary btn--sm">
                  Add
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setDrawer(false);
                    setBib("");
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button className="btn btn--ghost btn--sm" onClick={() => setDrawer(true)}>
                ＋ Add a bib number
              </button>
            )}

            <button
              className="btn btn--ghost btn--sm"
              onClick={() => fileRef.current?.click()}
              disabled={faceScanning}
              style={faceDone ? { borderColor: "var(--green)", color: "var(--green)" } : undefined}
            >
              {faceScanning
                ? "Scanning…"
                : faceDone
                  ? "✓ Face scan applied"
                  : "Scan your face"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runFaceSearch(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>

      {/* "Is this you?" — disambiguation strip for bib searches that turn
          up multiple distinct faces. Click a candidate to expand the
          result set with that face's other photos in the event. */}
      {searchedBib && faceCandidates.length > 0 && (
        <FaceCandidateStrip
          candidates={faceCandidates}
          confirmedClusterId={confirmedClusterId}
          expandingCluster={expandingCluster}
          onConfirm={confirmFaceCluster}
          // "+N more photos" reflects only photos NOT already on screen —
          // accounts for bib match, Add-a-bib expansions, and previously
          // confirmed face clusters.
          resultPhotoIds={resultPhotos.map((p) => p.id)}
        />
      )}

      {/* Grid or empty state. The bundle CTA used to live in a standalone
          BundleBar row here — it now sits inline with the photos-found
          headline above for a tighter buy-flow. */}
      <section style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
        {resultPhotos.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 14,
            }}
          >
            {resultPhotos.map((p) => (
              <PhotoThumb
                key={p.id}
                photo={p}
                onClick={() => openLightbox(p)}
                onExpand={() => openLightbox(p)}
              />
            ))}
          </div>
        ) : (
          <EmptyResultsState
            matchedRacer={matchedRacer ? { name: matchedRacer.name, bib: matchedRacer.bib } : null}
            searchedBib={searchedBib}
          />
        )}
      </section>
    </main>
  );
}

/** Shown when a bib search returned no photos. Encourages the user to try a
 *  face scan instead of re-typing bibs, since auto-tagging coverage may be
 *  patchy on a fresh event. */
function NoBibMatchPrompt({ searchedBib }: { searchedBib: string }) {
  const { runFaceSearch, faceScanning, faceScanStatus } = useRunner();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      style={{
        maxWidth: 560,
        margin: "32px auto",
        textAlign: "center",
        padding: "48px 24px",
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}
    >
      <Headline
        as="h2"
        text={`No photos tagged #${searchedBib} yet.`}
        accent={`#${searchedBib}`}
        style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.2,
          letterSpacing: "-.012em",
          color: "var(--ink)",
        }}
      />
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12, lineHeight: 1.5 }}>
        Bib auto-detection misses sometimes. A face scan finds your photos
        even when the bib didn&rsquo;t come through clean.
      </p>
      <button
        className="btn btn--primary"
        onClick={() => fileRef.current?.click()}
        disabled={faceScanning}
        style={{ marginTop: 18 }}
      >
        {faceScanning ? "Scanning…" : "Scan your face instead →"}
      </button>
      {faceScanStatus === "empty" && !faceScanning && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--accent)" }}>
          No matches yet — try a clearer, well-lit photo of just your face.
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void runFaceSearch(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function EmptyResultsState({
  matchedRacer,
  searchedBib,
}: {
  matchedRacer: { name: string; bib: number } | null;
  searchedBib: string | null;
}) {
  if (matchedRacer) {
    return (
      <div
        style={{
          maxWidth: 640,
          margin: "32px auto",
          textAlign: "center",
          padding: "48px 24px",
          background: "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 10,
        }}
      >
        <Headline
          as="h2"
          text={`Hi, ${matchedRacer.name.split(" ")[0]} — we're still sorting your photos.`}
          accent={`Hi, ${matchedRacer.name.split(" ")[0]}`}
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 28,
            lineHeight: 1.15,
            letterSpacing: "-.012em",
            color: "var(--ink)",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 14, lineHeight: 1.55 }}>
          We found you in the bib #{matchedRacer.bib} results, and photos are on the way. Check
          back in a few days — we&rsquo;ll have you covered.
        </p>
      </div>
    );
  }
  if (searchedBib) {
    return (
      <NoBibMatchPrompt searchedBib={searchedBib} />
    );
  }
  return (
    <div
      style={{
        maxWidth: 540,
        margin: "32px auto",
        textAlign: "center",
        padding: "48px 24px",
        background: "var(--cream)",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}
    >
      <Headline
        as="h2"
        text="Photos are on the way."
        accent="on the way."
        style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: "-.012em",
          color: "var(--ink)",
        }}
      />
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>
        We&rsquo;re still processing photos from the race. Check back in a few days.
      </p>
    </div>
  );
}

/* ============================================================
 * FaceCandidateStrip
 * ------------------------------------------------------------
 * Renders the "Is this you?" disambiguation row above the photo
 * grid. One round avatar tile per cluster present in the bib's
 * photos; click to confirm the face → server expands the result
 * set with that cluster's other photos.
 *
 * Visual: a horizontal scroller (works on narrow viewports) of
 * 72px face crops with the photo count below each. Selected
 * cluster has an accent ring + "✓ you" label.
 * ============================================================ */
function FaceCandidateStrip({
  candidates,
  confirmedClusterId,
  expandingCluster,
  onConfirm,
  resultPhotoIds,
}: {
  candidates: FaceCandidate[];
  confirmedClusterId: string | null;
  expandingCluster: boolean;
  onConfirm: (clusterId: string | null) => void | Promise<void>;
  /** IDs of photos already on screen. Drives the "+N more photos"
   *  subtitle so we don't double-count what the runner already sees. */
  resultPhotoIds: string[];
}) {
  // Memoize the set lookup so each candidate row doesn't pay an O(N) walk.
  const alreadyShown = new Set(resultPhotoIds);
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        // Breathing room above the box so it doesn't hug the photo strip
        // above it — the candidate row deserves to feel like its own
        // moment ("hey, is this you?") rather than a tag-on.
        padding: "20px 32px 0",
      }}
    >
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 220 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginBottom: 6,
            }}
          >
            Is this you?
          </div>
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 18,
              color: "var(--ink)",
              lineHeight: 1.3,
            }}
          >
            {confirmedClusterId
              ? "Pulled in more photos by face."
              : "Tap your face to find more of you."}
          </div>
          {confirmedClusterId && (
            <button
              type="button"
              onClick={() => onConfirm(null)}
              disabled={expandingCluster}
              style={{
                marginTop: 8,
                background: "transparent",
                border: 0,
                color: "var(--muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ← Undo
            </button>
          )}
        </div>

        {/* Split into "selected" (left, kept visible after confirm so the
            runner can see what they picked) and "others" (right) with a
            vertical divider between. Switching picks just moves a tile
            from one side to the other. */}
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 4,
            flex: 1,
            alignItems: "center",
          }}
        >
          {(() => {
            const selected = candidates.filter(
              (c) => c.clusterId === confirmedClusterId
            );
            const others = candidates.filter(
              (c) => c.clusterId !== confirmedClusterId
            );
            const renderTile = (c: FaceCandidate, isSelected: boolean) => {
              const newPhotosUnlocked = c.photoIdsInEvent.reduce(
                (n, id) => (alreadyShown.has(id) ? n : n + 1),
                0
              );
              const subtitle = isSelected
                ? "✓ added"
                : newPhotosUnlocked > 0
                  ? `+${newPhotosUnlocked} more photo${newPhotosUnlocked === 1 ? "" : "s"}`
                  : `already in results`;
              return (
                <button
                  key={c.clusterId}
                  type="button"
                  onClick={() => onConfirm(isSelected ? null : c.clusterId)}
                  disabled={expandingCluster}
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 84,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 999,
                      overflow: "hidden",
                      border: isSelected
                        ? "3px solid var(--accent)"
                        : "2px solid var(--line)",
                      boxShadow: isSelected ? "var(--shadow)" : "none",
                      transition: "border-color 0.12s, box-shadow 0.12s",
                      background: "var(--surface)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.sampleFaceUrl}
                      alt="Face candidate"
                      width={72}
                      height={72}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: isSelected ? "var(--accent)" : "var(--muted)",
                      textAlign: "center",
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    {subtitle}
                  </div>
                </button>
              );
            };
            return (
              <>
                {selected.map((c) => renderTile(c, true))}
                {selected.length > 0 && others.length > 0 && (
                  <div
                    aria-hidden
                    style={{
                      width: 1,
                      alignSelf: "stretch",
                      background: "var(--line)",
                      margin: "0 4px",
                    }}
                  />
                )}
                {others.map((c) => renderTile(c, false))}
              </>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
