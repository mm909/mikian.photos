"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Headline } from "../Headline";
import { PhotoThumb } from "../PhotoThumb";
import { BundleBar } from "../BundleBar";
import { FaceSuggestBanner } from "../FaceSuggestBanner";
import { BibSuggestBanner } from "../BibSuggestBanner";
import { useRunner } from "../RunnerProvider";
import { currentEvent } from "@/lib/data";

export function ResultsScreen() {
  const router = useRouter();
  const {
    resultPhotos,
    matchedRacer,
    searchedBib,
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
    scanFaceOnResults,
    faceDone,
  } = useRunner();

  const [drawerOpen, setDrawer] = useState(false);
  const [bib, setBib] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const event = currentEvent;

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
            {event.name[0]} <em className="acc-l">{event.name[1]}</em> {event.name[2]}
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
            <span>{event.photoCount.toLocaleString()} photos</span>
            <span>·</span>
            <span>{event.photographers} photographers</span>
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
          <Headline
            as="div"
            text={`${resultPhotos.length} photos found`}
            accent="found"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              fontSize: 40,
              lineHeight: 1.05,
              letterSpacing: "-.012em",
              color: "var(--ink)",
            }}
          />

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
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Find more —
            </span>

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
              style={faceDone ? { borderColor: "var(--green)", color: "var(--green)" } : undefined}
            >
              {faceDone ? "✓ Face scan applied" : "Scan your face"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={() => scanFaceOnResults()}
            />
          </div>
        </div>
      </section>

      {/* Bundle bar — only show when there's something to buy */}
      {resultPhotos.length > 0 && <BundleBar inCart={bundleInCart} onClick={onBundleAdd} />}

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
          text={`No runner with bib #${searchedBib}.`}
          accent="No runner"
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.15,
            letterSpacing: "-.012em",
            color: "var(--ink)",
          }}
        />
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12 }}>
          Double-check your number — bib numbers from this event run 251 to 400.
        </p>
      </div>
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
