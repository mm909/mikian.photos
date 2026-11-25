import type { Metadata } from "next";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { board100kCss } from "../board/board100kCss";
import { m2dView } from "../m2d";
import { M2dSite } from "./M2dSite";
import { m2dCss } from "./m2dCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "M2D: row 100K for charity — Rowtember",
  description:
    "The Concept2 Holiday Challenge, Nov 26 to Dec 24: row 100K and Concept2 donates to charity. What Rowtember rowers have raised, and how to join.",
};

/* M2D ON THE SITE (owner, 2026-11-25: "I need this sign up page. I need it
 * on the Rowtember website as well. Make this landing page similar to the
 * one that's in the app for the monthly challenge, like the call to opt in
 * to the monthly challenge. But I need it on the website page for now,
 * because the app still isn't live yet"). LIVE from the first day: the
 * challenge starts Nov 26, so no development gate.
 *
 * The board page's frame and its ruled table (board100kCss), with the
 * dollars raised as the head, the goal, the owner's match (M2D_MATCH in
 * row100k/m2d.ts), the four steps and the one press, then the board in
 * dollars: grey for a rower who has not said they are registered. The
 * figures are the app's (m2dView); the press is api/row100k/m2d. */

const SIGN_IN = `/sign-in?callbackUrl=${encodeURIComponent("/m2d")}`;

export default async function M2dPage() {
  const viewer = await resolveViewer();
  const view = await m2dView(viewer).catch((err) => {
    console.error("row100k M2D page: not read", err);
    return null;
  });

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <style>{m2dCss}</style>

      <RowBar active="m2d" {...barProps(viewer)} />

      {view ? (
        <M2dSite view={view} signedIn={viewer.actor !== null} signInHref={SIGN_IN} />
      ) : (
        <main className="bd">
          <div className="wrap front">
            <p className="bd-say" role="alert">
              M2D could not be read just now. Try again.
            </p>
          </div>
        </main>
      )}

      <RowFooter front />
    </div>
  );
}
