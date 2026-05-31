"use client";

import { useRef, useState } from "react";
import { Headline } from "./Headline";
import { useRunner, type FaceCandidate } from "./RunnerProvider";
import { BibSearchForm } from "./BibSearchForm";

/* ============================================================
 * Shared runner-flow pieces extracted from the old ResultsScreen so
 * both the Teaser step and the All-photos step can render them:
 *   - FaceCandidateStrip — the "Is this you?" disambiguation row
 *   - NoBibMatchPrompt    — empty state nudging a face scan
 *   - EmptyResultsState   — picks the right empty message
 * ============================================================ */

/** Shown when a bib search returned no photos. Encourages the user to try a
 *  face scan instead of re-typing bibs, since auto-tagging coverage may be
 *  patchy on a fresh event. */
export function NoBibMatchPrompt({ searchedBib }: { searchedBib: string }) {
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
        Double-check the bib and search again — or scan your face, which finds
        your photos even when bib auto-detection missed.
      </p>

      {/* Search another bib — the same search model from the landing page. */}
      <div style={{ maxWidth: 380, margin: "18px auto 0", textAlign: "left" }}>
        <BibSearchForm />
      </div>

      {/* or */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 380,
          margin: "18px auto 0",
          color: "var(--muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span>or</span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

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

export function EmptyResultsState({
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
 *
 * When there are many "other" faces we show only the first few and
 * collapse the rest behind a clickable "+N more faces" tile — tap it
 * to reveal (and re-tap to collapse) the remaining selectable faces.
 * ============================================================ */
// How many non-selected face tiles to show before collapsing the rest
// behind the "+N more faces" toggle.
const MAX_VISIBLE_OTHERS = 6;

export function FaceCandidateStrip({
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
  // Reveal-all toggle for the collapsed "other faces" overflow.
  const [showAllFaces, setShowAllFaces] = useState(false);
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
            from one side to the other. The "others" list collapses past
            MAX_VISIBLE_OTHERS behind a clickable "+N more faces" tile. */}
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
            const hiddenCount = Math.max(0, others.length - MAX_VISIBLE_OTHERS);
            const visibleOthers =
              showAllFaces || hiddenCount === 0
                ? others
                : others.slice(0, MAX_VISIBLE_OTHERS);
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
                {selected.length > 0 && visibleOthers.length > 0 && (
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
                {visibleOthers.map((c) => renderTile(c, false))}
                {/* Clickable overflow affordance. Tapping reveals the rest of
                    the faces (each still selectable); tapping again collapses
                    them back to the first MAX_VISIBLE_OTHERS. */}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFaces((v) => !v)}
                    aria-expanded={showAllFaces}
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px dashed var(--line)",
                        background: "var(--surface)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-serif)",
                        fontWeight: 500,
                        fontSize: 18,
                        transition: "border-color 0.12s, background 0.12s",
                      }}
                    >
                      {showAllFaces ? "–" : `+${hiddenCount}`}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        textAlign: "center",
                        fontWeight: 500,
                      }}
                    >
                      {showAllFaces
                        ? "Show fewer"
                        : `${hiddenCount} more face${hiddenCount === 1 ? "" : "s"}`}
                    </div>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
