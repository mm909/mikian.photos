import type { MeterSnapshot } from "@/lib/homeStats";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { HomeBar } from "./HomeBar";
import { HomeFooter } from "./HomeFooter";
import { Home } from "./Home";

/* The landing shell: fonts + base stylesheet, the bar, the page body, the
 * footer. Home is a client component that drives the live counter.
 *
 * ALWAYS LIGHT (owner, 2026-10-01: "keep the colors on the Mikian Musser
 * homepage the same"). From 2026-09-16 it took a `look` and the ink one put
 * .home-ink on the shell; src/app/page.tsx stopped reading the switch, so
 * the prop and the ink stylesheet came off with it. */
export function Landing({ snapshot }: { snapshot: MeterSnapshot }) {
  return (
    <div className={`home ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <HomeBar />
      <main>
        <Home snapshot={snapshot} />
      </main>
      <HomeFooter />
    </div>
  );
}
