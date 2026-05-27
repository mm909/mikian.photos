"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Headline } from "../Headline";
import { CourseCard } from "../CourseCard";
import { FinishTimeChart } from "../FinishTimeChart";
import { useRunner } from "../RunnerProvider";
import { currentEvent, racers } from "@/lib/data";
import type { DistanceKey } from "@/lib/gpx";

const REQUIRED_DISTANCES: DistanceKey[] = ["5k", "10k", "half"];
// Show the finish-time distribution only when every distance has results.
// Right now only the half is populated, so the chart hides on its own.
const hasFinishTimesForAllDistances = REQUIRED_DISTANCES.every((d) =>
  racers.some((r) => r.distance === d)
);

export function LandingScreen() {
  const router = useRouter();
  const { runSearch } = useRunner();
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

  function pickedFile() {
    runSearch({ kind: "face", value: "self" });
    router.push("/results");
  }

  const raceName = `${currentEvent.name[0]} ${currentEvent.name[1]} ${currentEvent.name[2]}`.trim();
  const raceAccent = currentEvent.name[0]; // just the city in italic-terracotta

  return (
    <main className="screen" style={{ padding: "64px 32px 96px" }}>
      <div
        className="landing-grid"
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 64,
          alignItems: "start",
        }}
      >
        {/* Left — hook + search */}
        <div>
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

          {/* Search card */}
          <div
            className="card"
            style={{
              padding: 24,
              marginTop: 28,
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

            {/* Equal-height tab body */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 132,
              }}
            >
              <div>
                {tab === "face" ? (
                  <>
                    <button className="btn btn--dark btn--block" onClick={() => fileRef.current?.click()}>
                      Upload a selfie to find your photos
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

              <LegalFooter />
            </div>
          </div>
        </div>

        {/* Right — course / GPX / elevation + finish-time distribution (when all distances have data) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <CourseCard />
          {hasFinishTimesForAllDistances && <FinishTimeChart />}
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
