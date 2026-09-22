import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";
import { RowBar } from "../row100k/RowBar";
import { RowFooter } from "../row100k/RowFooter";
import { archivo as rowArchivo, archivoBlack as rowArchivoBlack, spaceMono as rowSpaceMono, css as rowCss } from "../row100k/theme";
import { ergCss, ergInkCss, ergPaperCss } from "./ergTheme";

/* THE SHELL EVERY ERG PAGE WEARS (owner, 2026-09-17: "it does not need to
 * be its own page at the moment. We will leave it in the drop-down menu for
 * now. But when it goes live it will probably just be another header on the
 * Rowtember site").
 *
 * So the standalone bar is gone and these pages wear the SITE's chrome: the
 * Mikian Musser wordmark, the rail, the account menu — which is where the
 * erg telemetry link already lives — and the site footer. It is passed NO
 * ACTIVE KEY on purpose: telemetry is not a nav item yet. The day it
 * becomes one, that is a key here and an entry in BarNav, and nothing else
 * on these pages changes.
 *
 * ONLY THE CHROME IS SHARED. Nothing inside it knows what a challenge is —
 * no rower number, no meters this month, no board. An erg and the numbers
 * it sends.
 *
 * TWO GROUNDS. The live screens are ink, so the chrome inverts with them
 * (.chrome-ink, the same class race day and the results board wear). The
 * review screens are paper and the chrome stays as it is everywhere else.
 * The erg sheet keeps its own .eg- scope for the page body underneath. */

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", variable: "--eg-archivo" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", display: "swap", variable: "--eg-black" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--eg-mono" });

const ergFonts = `${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`;
const rowFonts = `${rowArchivo.variable} ${rowArchivoBlack.variable} ${rowSpaceMono.variable}`;

export function ErgShell({ ground, sheet, children }: { ground: "ink" | "paper"; sheet?: string; children: React.ReactNode }) {
  return (
    <div className={`row100k ${ground === "ink" ? "chrome-ink eg-root-ink " : ""}${rowFonts}`}>
      <style>{rowCss}</style>
      <RowBar />

      <div className={`eg ${ground === "ink" ? "eg-ink" : "eg-paper"} ${ergFonts}`}>
        <style>{ergCss}</style>
        <style>{ergInkCss}</style>
        <style>{ergPaperCss}</style>
        {sheet ? <style>{sheet}</style> : null}
        <div className="eg-wrap">{children}</div>
      </div>

      <RowFooter />
    </div>
  );
}
