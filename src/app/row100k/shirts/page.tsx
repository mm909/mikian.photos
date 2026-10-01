import type { Metadata } from "next";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { costLine, preorderCounts, type Counts, type Mine } from "../shirtPreorder";
import { preorderState } from "../shirtPreorders";
import { ShirtPreorder } from "./ShirtPreorder";
import { shirtsCss } from "./shirtsCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shirts — Rowtember",
};

/* THE SHIRTS, as pre-orders (owner, 2026-09-30: at cost, no payment now —
 * "you don't pay until we get them" — so no processor, just reserve). Two
 * shirts, black and cream, the September sizes; a signed-in rower on the
 * board reserves a size of either or both, changes it, or lets it go, and
 * the number reserved of each is public, per colour and per size. One
 * line of copy. Public page; the one word a visitor gets is SIGN IN.
 * Reached from the account menu (BarAccount.tsx, Shirts →). The owner's
 * list is ./admin. Not the September shirt: that is dev/shirts and stays
 * retired. */
export default async function ShirtsPage() {
  const viewer = await resolveViewer();

  let counts: Counts = preorderCounts([]);
  let mine: Mine | null = null;
  try {
    const state = await preorderState(viewer.myParticipantId);
    counts = state.counts;
    mine = state.mine;
  } catch (err) {
    console.error("row100k/shirts: failed to load the pre-orders (table pushed?)", err);
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
            <span className="mono">PRE-ORDER</span>
          </div>
          <p className="sp-line">{costLine()}</p>
          <ShirtPreorder counts={counts} mine={mine} signedIn={viewer.actor !== null} joined={viewer.myParticipantId !== null} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
