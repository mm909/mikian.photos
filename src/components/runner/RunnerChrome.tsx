"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Toast } from "./Toast";
import { Lightbox } from "./screens/Lightbox";
import { useRunner } from "./RunnerProvider";

export function RunnerChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { cart, lightbox, lightboxScope, resultPhotos, bundleInCart, bundlePrice, isFree, event, activeEventId, toast, closeLightbox, lbPrev, lbNext, openLightbox, addOneToCart, addBundle } = useRunner();

  // The sign-in screen drops the nav chrome — nothing to navigate to yet.
  const bare = pathname === "/photographer/sign-in";

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
      {lightbox && (
        <Lightbox
          photo={lightbox}
          photos={lightboxScope ?? resultPhotos}
          cart={cart}
          totalCount={resultPhotos.length}
          bundleInCart={bundleInCart}
          price={bundlePrice}
          isFree={isFree}
          eventName={event?.name}
          onClose={closeLightbox}
          onPrev={lbPrev}
          onNext={lbNext}
          onJump={(p) => openLightbox(p)}
          onAdd={(p, alreadyIn) => {
            // bundle-only: keep single-add no-op for legacy
            if (alreadyIn) {
              closeLightbox();
              router.push("/checkout");
              return;
            }
            addOneToCart(p);
          }}
          onBundle={() => {
            // Always re-snapshot to the photos currently in view before going to
            // checkout — even if a bundle is already in the cart, it may be a
            // stale/empty one whose ids no longer match this search.
            closeLightbox();
            addBundle();
            router.push("/checkout");
          }}
        />
      )}
      <Toast text={toast} />
    </>
  );
}
