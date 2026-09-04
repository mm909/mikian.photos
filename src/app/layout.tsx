import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { RunnerProvider } from "@/components/runner/RunnerProvider";
import { RunnerChrome } from "@/components/runner/RunnerChrome";
import { DevBanner } from "@/components/dev/DevBanner";
import { SessionProviderWrapper } from "@/components/auth/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Mikian Musser",
  description: "Rowtember, LASD26, and race photos — Mikian Musser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <RunnerProvider>
            <DevBanner />
            <div className="app-root">
              <RunnerChrome>{children}</RunnerChrome>
            </div>
          </RunnerProvider>
        </SessionProviderWrapper>
        <Analytics />
      </body>
    </html>
  );
}
