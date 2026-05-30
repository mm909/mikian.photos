"use client";

import { useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Toast } from "./Toast";
import { Lightbox } from "./screens/Lightbox";
import { useRunner } from "./RunnerProvider";

export function RunnerChrome({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { cart, lightbox, lightboxScope, resultPhotos, bundleInCart, toast, closeLightbox, lbPrev, lbNext, openLightbox, addOneToCart, addBundle, flashToast } = useRunner();

  function gotoCart() {
    if (cart.items.length === 0) {
      flashToast("Cart is empty");
      return;
    }
    router.push("/cart");
  }

  return (
    <>
      <Nav cartCount={cart.items.length} onLogo={() => router.push("/")} onCart={gotoCart} />
      {children}
      {lightbox && (
        <Lightbox
          photo={lightbox}
          photos={lightboxScope ?? resultPhotos}
          cart={cart}
          totalCount={resultPhotos.length}
          bundleInCart={bundleInCart}
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
