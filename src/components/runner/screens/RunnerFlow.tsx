"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRunner } from "../RunnerProvider";
import { StepSearch } from "./StepSearch";
import { StepTeaser } from "./StepTeaser";
import { StepAll } from "./StepAll";

export type FlowStep = "search" | "teaser" | "all";

/**
 * RunnerFlow — the runner search funnel.
 *
 *   "/"        → search → teaser   (in-memory steps; "/" is ALWAYS the landing)
 *   "/results" → all photos        (initialStep="all")
 *
 * The full grid lives on its own route so it has a stable URL: "back from
 * checkout" returns to the grid, while a fresh visit to "/" always shows the
 * search landing instead of resuming a stale prior search. The provider holds
 * the search state, so navigating "/" → "/results" carries the results over;
 * a cold load of "/results" rebuilds them from the persisted photo ids.
 */
export function RunnerFlow({ initialStep }: { initialStep?: FlowStep }) {
  const router = useRouter();
  const { faceScanStatus } = useRunner();

  const [step, setStep] = useState<FlowStep>(initialStep ?? "search");

  // Face-first path: once a selfie scan matches while on Search, advance to the
  // teaser. (The bib path advances synchronously from StepSearch.) The teaser
  // owns face-cluster confirmation via its best-guess UI.
  useEffect(() => {
    if (step === "search" && faceScanStatus === "matched") setStep("teaser");
  }, [step, faceScanStatus]);

  if (step === "all") return <StepAll />;
  if (step === "teaser") return <StepTeaser onSeeAll={() => router.push("/results")} />;
  return <StepSearch onAdvance={() => setStep("teaser")} />;
}
