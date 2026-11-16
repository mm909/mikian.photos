import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/**
 * THE TSP PAGES AS AN APP ON THE PHONE (owner, 2026-11-16: "Lets format this
 * like an app on my phone rather than a website … this will eventually be an
 * app"). The manifest and the Apple tags let "Add to Home Screen" open the
 * team site with no browser bars; viewport-fit=cover hands the page the
 * notch and the home-indicator strip, which the bar and the tab bar pad
 * with env(safe-area-inset-*) (tspCss.ts). The frame itself is TspPage.
 */
export const metadata: Metadata = {
  manifest: "/tsp/app/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TSP", statusBarStyle: "default" },
  icons: { apple: "/tsp/app/icon-180.png" },
};
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#F4F3EE" };

export default function TspLayout({ children }: { children: ReactNode }) {
  return children;
}
