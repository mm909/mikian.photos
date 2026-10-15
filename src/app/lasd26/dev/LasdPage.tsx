import type { ReactNode } from "react";
import type { TeamViewer } from "@/lib/lasd26/team";
import { LasdBar, type BarKey } from "./LasdBar";
import { archivo, archivoBlack, spaceMono, css } from "./theme";

/**
 * The frame every page of the team site sits in (the dev copy under
 * /lasd26/dev, lib/lasd26/paths.ts): fonts, the scoped stylesheet, the bar
 * with the account button, then the page. Server component; the page
 * resolves the viewer once (gateLasdDev, which wraps getTeamViewer) and
 * hands it down. The style tag is set as raw HTML on purpose: React
 * escapes quotes inside <style> children and the page then fails to
 * hydrate (see src/app/track).
 */
export function LasdPage({ viewer, active, children, extraCss = "" }: { viewer: TeamViewer; active: BarKey; children: ReactNode; extraCss?: string }) {
  return (
    <div className={`lasd26 ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: css + extraCss }} />
      <LasdBar viewer={viewer} active={active} />
      {children}
    </div>
  );
}
