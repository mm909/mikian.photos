"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Toast } from "./Toast";
import { useRunner } from "./RunnerProvider";

export function RunnerChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { event, activeEventId, toast } = useRunner();

  // Bare (no nav chrome): the sign-in screen (nothing to navigate to yet) and
  // the immersive TSP map + stats views (full-screen; they carry their own
  // floating menu). /tsp/manage keeps the nav.
  const bare =
    pathname === "/photographer/sign-in" ||
    pathname === "/tsp" ||
    pathname === "/tsp/stats" ||
    pathname === "/tsp/plan";

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
