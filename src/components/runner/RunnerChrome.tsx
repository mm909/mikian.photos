"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Toast } from "./Toast";
import { useRunner } from "./RunnerProvider";

export function RunnerChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { event, activeEventId, toast } = useRunner();

  // Bare (no nav chrome): the sign-in screen (nothing to navigate to yet),
  // the immersive TSP map + stats views (full-screen; they carry their own
  // floating menu), and the LASD26 crew-call one-pager (self-contained
  // standalone design). /tsp/manage keeps the nav.
  const bare =
    pathname === "/photographer/sign-in" ||
    pathname === "/tsp" ||
    pathname === "/tsp/stats" ||
    pathname === "/tsp/plan" ||
    pathname === "/lasd26";

  return (
    <>
      {!bare && (
        <Nav
          onLogo={() => router.push("/")}
          eventName={event?.name}
          activeEventId={activeEventId}
        />
      )}
      {children}
      {/* The full-screen photo experience now lives inside the runner flow
          (StepAll's JustifiedPhotoGrid + PhotoViewer); the old two-pane
          shopping Lightbox has been retired. */}
      <Toast text={toast} />
    </>
  );
}
