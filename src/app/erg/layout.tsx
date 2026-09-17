import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";
import { ergCss, ergInkCss, ergPaperCss } from "./ergTheme";
import { ergPageOpen, ergViewer } from "./gate";

/* THE ERG PRODUCT (owner, 2026-09-17: "let us build the post hoc analysis
 * screen and keep Rowtember out of it — these things should be a little
 * disjoint"). Everything under /erg is one product: connect as many PM5
 * monitors as there are ergs in the room, watch any one of them, save each
 * one on its own, play a saved row back, and read a finished piece
 * afterwards. No challenge, no rower number, no board.
 *
 * The same three fonts the rest of the site uses, under their own variable
 * names so nothing collides with the /row100k sheet. The three style
 * strings ship here once: ergCss is the skeleton, and a surface picks its
 * ground by wearing .eg-ink (live) or .eg-paper (review).
 *
 * THE DOOR IS HERE as well as on each page, so a page added later cannot
 * be public by accident: local dev open, production admin only. */

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", variable: "--eg-archivo" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", display: "swap", variable: "--eg-black" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--eg-mono" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Erg telemetry",
  robots: { index: false, follow: false },
};

export default async function ErgLayout({ children }: { children: React.ReactNode }) {
  const v = await ergViewer();
  if (!ergPageOpen(v)) notFound();

  return (
    <div className={`eg ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{ergCss}</style>
      <style>{ergInkCss}</style>
      <style>{ergPaperCss}</style>
      {children}
    </div>
  );
}
