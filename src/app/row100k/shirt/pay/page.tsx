import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { PICKUP_LINE, SHIRT_FREE_AT, SHIRT_PRICE_USD, shopOpenFor } from "../../shirt";
import { PayButton } from "./PayButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your shirt — 100K September",
  robots: { index: false, follow: false },
};

/* The page the month-end email points at. Signed in, it shows the rower's
 * own shirt and, if it was billed, the $20 button. Nothing else lives
 * here: not a shop, not a way to change a size. */
export default async function ShirtPayPage() {
  const viewer = await resolveViewer();
  // Dev only for now — the whole shop answers only to an admin in production.
  if (!shopOpenFor(viewer.isAdmin)) notFound();
  let shirt: { size: string; kind: string; status: string; amountUsd: number } | null = null;
  let meters = 0;
  if (viewer.myParticipantId) {
    try {
      const [o, rows] = await Promise.all([
        db.rowShirtOrder.findUnique({
          where: { challenge_participantId: { challenge: CHALLENGE, participantId: viewer.myParticipantId } },
          select: { size: true, kind: true, status: true, amountUsd: true },
        }),
        db.rowEntry.findMany({ where: { participantId: viewer.myParticipantId }, select: { meters: true } }),
      ]);
      shirt = o;
      meters = rows.reduce((s, r) => s + r.meters, 0);
    } catch (err) {
      console.error("row100k/shirt/pay: failed to load the shirt", err);
    }
  }

  const num = viewer.me ? String(viewer.me.rowerNumber).padStart(3, "0") : "";
  const state = !viewer.actor
    ? "SIGN IN TO SEE YOUR SHIRT"
    : !viewer.myParticipantId
      ? "OPT IN TO ROWTEMBER FIRST"
      : !shirt
        ? "NO SHIRT ON YOUR NAME"
        : shirt.status === "paid"
          ? "PAID"
          : shirt.status === "free"
            ? "FREE — YOU GOT THE 100K"
            : shirt.status === "owed"
              ? `$${shirt.amountUsd || SHIRT_PRICE_USD} DUE`
              : "RESERVED — SETTLED AT THE END OF THE MONTH";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Your shirt</h2>
            <span className="mono">{state}</span>
          </div>

          {shirt && (
            <div className="st-tiles">
              <div className="st-tile you">
                <div className="k mono">Size</div>
                <div className="n">{shirt.size}</div>
                <div className="l mono">
                  {num ? `ROWER ${num} · ` : ""}
                  {shirt.kind === "preorder" ? "PRE-ORDER" : "ON THE SHELF"}
                </div>
              </div>
              <div className="st-tile">
                <div className="k mono">Meters</div>
                <div className="n">
                  {meters.toLocaleString("en-US")} <span className="u">m</span>
                </div>
                <div className="l mono">
                  {meters >= SHIRT_FREE_AT ? `PAST THE ${SHIRT_FREE_AT / 1000}K` : `${(SHIRT_FREE_AT - meters).toLocaleString("en-US")} M SHORT OF THE ${SHIRT_FREE_AT / 1000}K`}
                </div>
              </div>
            </div>
          )}

          {shirt?.status === "owed" && <PayButton amount={shirt.amountUsd || SHIRT_PRICE_USD} />}

          <p className="sh-pick">{PICKUP_LINE.toUpperCase()}</p>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
