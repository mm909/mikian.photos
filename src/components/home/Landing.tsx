import type { MeterSnapshot } from "@/lib/homeStats";
import { archivo, archivoBlack, spaceMono, css } from "./theme";
import { HomeBar } from "./HomeBar";
import { HomeFooter } from "./HomeFooter";
import { Home } from "./Home";

/* The landing shell: fonts + base stylesheet, the bar, the page body, the
 * footer. Home is a client component that drives the live counter. */
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
