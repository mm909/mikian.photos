import type { MeterSnapshot } from "@/lib/homeStats";
import type { Look } from "@/lib/rowSettings";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { HomeBar } from "./HomeBar";
import { HomeFooter } from "./HomeFooter";
import { Home } from "./Home";

/* The landing shell: fonts + base stylesheet, the bar, the page body, the
 * footer. Home is a client component that drives the live counter.
 *
 * The look (owner, 2026-09-16): ink puts .home-ink on the shell and the
 * stylesheet flips the palette (theme.ts). Paper adds no class, so the
 * default render is what it was. */
export function Landing({ snapshot, look = "paper" }: { snapshot: MeterSnapshot; look?: Look }) {
  return (
    <div
      className={`home${look === "ink" ? " home-ink" : ""} ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}
    >
      <style>{css}</style>
      <HomeBar />
      <main>
        <Home snapshot={snapshot} />
      </main>
      <HomeFooter />
    </div>
  );
}
