import type { ReactNode } from "react";
import { archivo, archivoBlack, spaceMono } from "../theme";
import { payAbleCss } from "../payAbleCss";
import { Account } from "./Account";

/**
 * THE BARE FRAME the pay-what-you're-able pages sit in (owner, 2026-10-29:
 * "users need to be able to log in but dont need any of the normal headers
 * or footers … I like LASD26 being the footer for this page"): ink, lime,
 * the two marks in type at the top (NO SHORTCUTS with the red arrow ×
 * justfriends. with the lime dot) and SIGN IN / the first name, then the
 * page, then LASD26 as the foot — and under it whatever `tools` the page
 * hands in (the owner's VIEW AS and TEST on your-share). Server component; the page resolves the
 * viewer and hands the name down. The stylesheet is payAbleCss.
 */
export function BareFrame({ name, tools, children }: { name: string | null; tools?: ReactNode; children: ReactNode }) {
  return (
    <div className={`lasd-pay ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: payAbleCss }} />

      <header className="top">
        <div className="marks" aria-label="No Shortcuts × Just Friends LV">
          <span className="ns">
            No Shortcuts <span className="arrow">→</span>
          </span>
          <span className="x">×</span>
          <span className="jf">
            justfriends
            <i className="dot" />
          </span>
        </div>
        <Account name={name} />
      </header>

      {children}

      <footer className="foot">
        <span className="wm">LASD26</span>
        {tools}
      </footer>
    </div>
  );
}
