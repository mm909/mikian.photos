import type { Metadata } from "next";
import {
  Hero,
  ValueStrip,
  BuyingFlow,
  MatchingTech,
  CoverageSection,
  InsightsSection,
  DownloadOptions,
  TwoPaths,
  FinalCta,
  DirectorFooter,
} from "@/components/director/sections";

export const metadata: Metadata = {
  title: "For Race Directors — Mikian.Photos",
  description:
    "Race photography your runners actually buy. Face + bib matching, GPS course coverage, finish-time analytics, and sales reporting. Book a demo.",
};

/**
 * /for-race-directors — the sales page for race organizers.
 *
 * Pitches both models (we shoot it / bring your own photographers) and shows
 * off the platform: the runner buying flow, face + bib matching, the GPS
 * course-coverage map, and the director insights dashboard. Built on the real
 * Lighthouse course + finisher data where it exists.
 *
 * Note: while the whole-site sign-in gate is on (see src/middleware.ts), this
 * page is gated too. To share it publicly, open the site (SITE_PUBLIC=true) or
 * add this path to the middleware allow-list.
 */
export default function ForRaceDirectorsPage() {
  return (
    <main className="screen" style={{ display: "flex", flexDirection: "column" }}>
      <Hero />
      <ValueStrip />
      <BuyingFlow />
      <MatchingTech />
      <CoverageSection />
      <InsightsSection />
      <DownloadOptions />
      <TwoPaths />
      <FinalCta />
      <DirectorFooter />
    </main>
  );
}
