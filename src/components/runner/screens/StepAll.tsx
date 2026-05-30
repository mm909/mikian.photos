"use client";

import { useRouter } from "next/navigation";
import { Headline } from "../Headline";
import { PhotoThumb } from "../PhotoThumb";
import { EmptyResultsState } from "../FaceCandidateStrip";
import { useRunner } from "../RunnerProvider";
import { prices } from "@/lib/data";

/**
 * Step 3 — All photos. The full grid plus the bundle buy CTA. Buying hands off
 * to the existing /checkout. (The event banner lives on the landing/teaser; the
 * results page stays focused on the photos.)
 */
export function StepAll() {
  const router = useRouter();
  const {
    catalogLoading,
    resultPhotos,
    matchedRacer,
    searchedBib,
    searchFellBack,
    addBundle,
    bundleInCart,
    openLightbox,
  } = useRunner();

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
      {/* Match summary bar — the event banner lives on the landing/teaser, so
          the results page leads straight with the runner's match + buy. */}
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
                <Headline as="div" text="Loading photos…" accent="photos…" style={headlineStyle} />
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
        </div>
      </section>

      {/* Grid or empty state */}
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
              <PhotoThumb key={p.id} photo={p} onClick={() => openLightbox(p)} onExpand={() => openLightbox(p)} />
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
