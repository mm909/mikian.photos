import type { Metadata } from "next";
import "./globals.css";
import { RunnerProvider } from "@/components/runner/RunnerProvider";
import { RunnerChrome } from "@/components/runner/RunnerChrome";
import { DevBanner } from "@/components/dev/DevBanner";
import { SessionProviderWrapper } from "@/components/auth/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Mikian.Photos — Long Beach Half Marathon",
  description: "Find your Long Beach Half Marathon photos. Search by face scan or bib number.",
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
      </body>
    </html>
  );
}
