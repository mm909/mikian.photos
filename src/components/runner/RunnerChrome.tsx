"use client";

import { usePathname, useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Toast } from "./Toast";
import { Lightbox } from "./screens/Lightbox";
import { useRunner } from "./RunnerProvider";

export function RunnerChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { cart, lightbox, lightboxScope, resultPhotos, bundleInCart, bundlePrice, isFree, event, toast, closeLightbox, lbPrev, lbNext, openLightbox, addOneToCart, addBundle } = useRunner();

  // The sign-in screen drops the nav chrome — nothing to navigate to yet.
  const bare = pathname === "/photographer/sign-in";

  return (
    <>
      {!bare && <Nav onLogo={() => router.push("/")} />}
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
          onBundle={(alreadyIn) => {
            closeLightbox();
            if (!alreadyIn) addBundle();
            router.push("/checkout");
          }}
        />
      )}
      <Toast text={toast} />
    </>
  );
}
