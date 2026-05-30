"use client";

import { useEffect, useState } from "react";
import { useRunner } from "../RunnerProvider";
import { StepSearch } from "./StepSearch";
import { StepTeaser } from "./StepTeaser";

export type FlowStep = "search" | "teaser";

/**
 * RunnerFlow — the runner search funnel: search → teaser.
 *
 * "/" is always the landing. A bib (or name) search advances to the teaser,
 * which shows the matches and opens the full-gallery photo viewer in place
 * (there's no separate grid screen anymore). The provider holds the search
 * state so the teaser survives opening/closing the viewer within a session.
 */
export function RunnerFlow() {
  const { faceScanStatus, clearSearch } = useRunner();
  const [step, setStep] = useState<FlowStep>("search");

  // Face-first path: once a selfie scan matches while on Search, advance to the
  // teaser. (The bib path advances synchronously from StepSearch.)
  useEffect(() => {
    if (step === "search" && faceScanStatus === "matched") setStep("teaser");
  }, [step, faceScanStatus]);

  // Back / "search again" — reset the search and return to the landing so a
  // mistyped bib can be re-entered. clearSearch() also drops the matched
  // face status so the effect above doesn't immediately bounce us forward.
  function goSearchAgain() {
    clearSearch();
    setStep("search");
  }

  if (step === "teaser") return <StepTeaser onBack={goSearchAgain} />;
  return <StepSearch onAdvance={() => setStep("teaser")} />;
}
