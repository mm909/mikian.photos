import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { listGallery } from "../../galleryList";
import { photosServable, publicPhotoUrl, thumbKey } from "../../photoUrls";
import { shirtCounts } from "../../shirt";
import { ShirtShop, type MineLite } from "./ShirtShop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The shirt (dev) — 100K September",
  robots: { index: false, follow: false },
};

/* THE SHIRT, dev for now (owner, 2026-09-08): $20 or 100,000 meters, buy
 * now pay later, pick-up only, sizes side by side with one line on each
 * box — what is left, or how many are pre-ordered — settled at the end of
 * the month and billed through the photo shop's PayPal connection. This
 * page is only what a rower sees; the orders and the settlement live on
 * /row100k/shop-admin (owner, 2026-09-08). Admin-only in production, open
 * in local dev — the same gate as the other dev pages. Product photos are
 * the newest gallery shots until the owner sends the real ones. */
const PRODUCT_PHOTOS = 3;

export default async function DevShirtsPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  let photos: { full: string; thumb: string }[] = [];
  if (photosServable()) {
    try {
      photos = (await listGallery())
        .filter((o) => o.hasThumb)
        .slice(0, PRODUCT_PHOTOS)
        .map((o) => ({ full: publicPhotoUrl(o.key), thumb: publicPhotoUrl(thumbKey(o.key)) }));
    } catch (err) {
      console.error("row100k/dev/shirts: gallery listing failed", err);
    }
  }

  let counts = shirtCounts([]);
  let mine: MineLite = null;
  let meters = 0;
  try {
    const orders = await db.rowShirtOrder.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, size: true, kind: true, status: true, amountUsd: true, paidAt: true },
      orderBy: { createdAt: "asc" },
    });
    counts = shirtCounts(orders);
    if (viewer.myParticipantId) {
      const m = orders.find((o) => o.participantId === viewer.myParticipantId);
      if (m) mine = { size: m.size, kind: m.kind, status: m.status, amountUsd: m.amountUsd, paidAt: m.paidAt?.toISOString() ?? null };
      const rows = await db.rowEntry.findMany({
        where: { participantId: viewer.myParticipantId },
        select: { meters: true },
      });
      meters = rows.reduce((s, r) => s + r.meters, 0);
    }
  } catch (err) {
    console.error("row100k/dev/shirts: failed to load orders (table pushed?)", err);
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The shirt</h2>
            <span className="mono">DEV · BUY NOW, PAY LATER</span>
          </div>
          <ShirtShop
            photos={photos}
            counts={counts}
            mine={mine}
            meters={meters}
            joined={viewer.myParticipantId !== null}
            signedIn={viewer.actor !== null}
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
