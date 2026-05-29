"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Headline } from "../Headline";
import { useRunner } from "../RunnerProvider";
import { currentEvent } from "@/lib/data";

// CourseCard + FinishTimeChart imports removed — components currently
// unmounted from this page (they belong on the not-yet-built Race Director
// dashboard). Re-import + drop into the empty right column when RD ships.

export function LandingScreen() {
  const router = useRouter();
  const { runSearch, runFaceSearch, faceScanning } = useRunner();
  const [tab, setTab] = useState<"face" | "bib">("face");
  const [bib, setBib] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submitBib(e: React.FormEvent) {
    e.preventDefault();
    if (!bib.trim()) {
      setErr("Enter your bib number to search.");
      return;
    }
    setErr("");
    runSearch({ kind: "bib", value: bib.trim() });
    router.push("/results");
  }

  /** Fired when the user picks a selfie from the file dialog. We navigate
   *  to /results first so the user sees the scanning state, then fire the
   *  request in parallel — the results screen reads `faceScanning` to show
   *  the spinner while it runs. */
  async function pickedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    router.push("/results");
    await runFaceSearch(file);
    // Reset the input so picking the same file again re-fires onChange.
    if (fileRef.current) fileRef.current.value = "";
  }

  const raceName = `${currentEvent.name[0]} ${currentEvent.name[1]} ${currentEvent.name[2]}`.trim();
  const raceAccent = currentEvent.name[0]; // just the city in italic-terracotta

  return (
    <main className="screen" style={{ padding: "64px 32px 96px" }}>
      {/* Right column (CourseCard + finish-time chart) was moved to the
          not-yet-built RD dashboard; with no right pane we drop the grid
          and center the search card on the page. Original two-column
          layout will come back when the right rail has content again. */}
      <div
        className="landing-grid"
        style={{
          maxWidth: 600,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Left — hook + search. Flex column so the search card can stretch
            to match the right column's height. */}
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
            Photos Live · {currentEvent.date}
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
          <p
            style={{
              marginTop: 18,
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              color: "var(--muted)",
              lineHeight: 1.55,
              maxWidth: 440,
            }}
          >
            Search by face scan or bib number.
          </p>

          {/* Search card. Flex column so the LegalFooter pins to the
              bottom when the card stretches to match the right column. */}
          <div
            className="card"
            style={{
              padding: 24,
              marginTop: 28,
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                background: "var(--cream)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 4,
                gap: 4,
                marginBottom: 18,
              }}
            >
              {([
                ["face", "Scan My Face"],
                ["bib", "Search by Bib"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    padding: "10px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    border: 0,
                    background: tab === k ? "var(--surface)" : "transparent",
                    color: tab === k ? "var(--ink)" : "var(--muted)",
                    boxShadow: tab === k ? "var(--shadow)" : "none",
                    fontWeight: tab === k ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab body — content sits at the top, LegalFooter pins to the
                bottom of the card via the parent flex stretch. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
              }}
            >
              <div>
                {tab === "face" ? (
                  <>
                    <button
                      className="btn btn--dark btn--block"
                      onClick={() => fileRef.current?.click()}
                      disabled={faceScanning}
                    >
                      {faceScanning ? "Scanning…" : "Upload a selfie to find your photos"}
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={pickedFile}
                    />
                  </>
                ) : (
                  <form onSubmit={submitBib}>
                    <label className="field-label" htmlFor="bib-in">
                      Bib number
                    </label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        id="bib-in"
                        className="input"
                        placeholder="e.g. 1248"
                        inputMode="numeric"
                        value={bib}
                        onChange={(e) => {
                          setBib(e.target.value);
                          if (err) setErr("");
                        }}
                        autoFocus
                      />
                      <button type="submit" className="btn btn--primary">
                        Search
                      </button>
                    </div>
                    {err && (
                      <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 6 }}>{err}</div>
                    )}
                  </form>
                )}
              </div>

              {/* Spacer pushes the footer to the bottom of the (now-stretched)
                  card. With minHeight gone there's no dead space on the
                  short tab. */}
              <div style={{ flex: 1 }} />
              <LegalFooter />
            </div>
          </div>
        </div>

      </div>
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
