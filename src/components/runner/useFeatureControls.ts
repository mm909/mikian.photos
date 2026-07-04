"use client";

import { useSession } from "next-auth/react";
import { useRunner } from "./RunnerProvider";
import type { FeatureControls } from "./PhotoViewer";

/**
 * Owner-only photo featuring, packaged for the PhotoViewer's `feature` prop.
 * `canFeature` is true ONLY for the platform owner — favoriting is Mikian's
 * curation tool, not a per-event-manager one (the API is likewise owner-gated).
 * The returned closures read the latest featuredIds each render; the viewer
 * captures them freshly so the ★ button and `f` key never act on stale state.
 */
export function useFeatureControls(): FeatureControls {
  const { data: session } = useSession();
  const { featuredIds, toggleFeatured } = useRunner();
  const canFeature = Boolean(session?.roles?.includes("owner"));
  return {
    canFeature,
    isFeatured: (id: string) => featuredIds.has(id),
    toggle: (id: string) => void toggleFeatured(id, !featuredIds.has(id)),
  };
}
