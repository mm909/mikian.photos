import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { COLORS, preorderCounts, type Color, type Counts, type Mine } from "../shirtPreorder";
import { preorderState } from "../shirtPreorders";
import { listShirtPhotos } from "../shirtPhotos";
import { photosServable, publicPhotoUrl, thumbKey } from "../photoUrls";
import { ShirtPreorder } from "./ShirtPreorder";
import type { ShirtPhoto } from "./ShirtCarousel";
import { shirtsCss } from "./shirtsCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shirts (dev) — Rowtember",
  robots: { index: false, follow: false },
};

/* THE SHIRTS, as pre-orders (owner, 2026-09-30: at cost, no payment now —
 * "you don't pay until we get them" — so no processor, just reserve). Two
 * shirts, black and cream, the September sizes; a signed-in rower on the
 * board reserves a size of either or both, changes it, or lets it go, and
 * the number reserved of each is public, per colour and per size. The
 * one word a visitor gets is SIGN IN. The owner's list is ./admin. Not
 * the September shirt: that is dev/shirts and stays retired.
 *
 * No line of copy any more (owner, 2026-10-01: "Remove sold at cost, paid
 * when they arrive"), and the drawn tee is a carousel of the owner's own
 * photographs of each shirt (shirtPhotos.ts, ShirtCarousel.tsx), which he
 * posts into from this page.
 *
 * IN DEVELOPMENT, not live (owner, 2026-10-01: "The shirts page should not
 * be live. Put it in development still" — and the standing rule, a new
 * page starts in development unless the owner says otherwise). The same
 * gate as the other dev pages: admin-only in production, a 404 for
 * everyone else; open in local dev. Reached from the DEVELOPMENT group of
 * the account menu (BarAccount.tsx, Shirts →), and the reserve route
 * (api/row100k/shirts) wears the same gate. */
export default async function ShirtsPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  let counts: Counts = preorderCounts([]);
  let mine: Mine | null = null;
  try {
    const state = await preorderState(viewer.myParticipantId);
    counts = state.counts;
    mine = state.mine;
  } catch (err) {
    console.error("row100k/shirts: failed to load the pre-orders (table pushed?)", err);
  }

  /* The photographs, as public CDN URLs with their thumbs (photoUrls.ts).
   * Empty per shirt on a failed listing or a machine with no photo store:
   * the carousel then shows its flat colour frame. */
  const photos = Object.fromEntries(COLORS.map((c) => [c, [] as ShirtPhoto[]])) as Record<Color, ShirtPhoto[]>;
  if (photosServable()) {
    try {
      const list = await listShirtPhotos();
      for (const c of COLORS) {
        photos[c] = list[c].map((o) => ({
          key: o.key,
          full: publicPhotoUrl(o.key),
          thumb: publicPhotoUrl(o.hasThumb ? thumbKey(o.key) : o.key),
        }));
      }
    } catch (err) {
      console.error("row100k/shirts: failed to list the shirt photos", err);
    }
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{shirtsCss}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Shirts</h2>
            <span className="mono">DEV · PRE-ORDER</span>
          </div>
          <ShirtPreorder
            counts={counts}
            mine={mine}
            signedIn={viewer.actor !== null}
            joined={viewer.myParticipantId !== null}
            photos={photos}
            admin={viewer.isAdmin}
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
