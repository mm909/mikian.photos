"use client";

import { useEffect, useState } from "react";
import { useRunner } from "../RunnerProvider";
import { StepSearch } from "./StepSearch";
import { StepAll } from "./StepAll";

export type FlowStep = "search" | "all";

/**
 * RunnerFlow — the runner search funnel: search → results.
 *
 * "/" is always the landing. A bib (or name) search advances straight to the
 * full results page (StepAll): the justified grid over the whole matched set,
 * the "Is this you?" face confirmation, the full-screen viewer, and the
 * checkout CTA. (The old intermediate teaser step — 4 previews + "See all my
 * photos" — was merged into StepAll so there's exactly one page between
 * search and checkout.) The provider holds the search state so the flow
 * survives moving between steps in a session.
 */
export function RunnerFlow() {
  const { faceScanStatus, clearSearch } = useRunner();
  const [step, setStep] = useState<FlowStep>("search");

  // Face-first path: once a selfie scan matches while on Search, advance to
  // the results. (The bib path advances synchronously from StepSearch.)
  useEffect(() => {
    if (step === "search" && faceScanStatus === "matched") setStep("all");
  }, [step, faceScanStatus]);

  // Back / "search again" — reset the search and return to the landing so a
  // mistyped bib can be re-entered. clearSearch() also drops the matched
  // face status so the effect above doesn't immediately bounce us forward.
  function goSearchAgain() {
    clearSearch();
    setStep("search");
  }

  if (step === "all") return <StepAll onBack={goSearchAgain} />;
  return <StepSearch onAdvance={() => setStep("all")} />;
}
