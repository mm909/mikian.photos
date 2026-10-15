import type { ReactNode } from "react";
import type { TeamViewer } from "@/lib/lasd26/team";
import { LasdBar, type BarKey } from "./LasdBar";
import { archivo, archivoBlack, spaceMono, css } from "./theme";

/**
 * The frame every /lasd26 page sits in: fonts, the scoped stylesheet, the
 * bar with the account button, then the page. Server component; the page
 * resolves the viewer once (getTeamViewer) and hands it down. The style
 * tag is set as raw HTML on purpose: React escapes quotes inside <style>
 * children and the page then fails to hydrate (see src/app/track).
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
