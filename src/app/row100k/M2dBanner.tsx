"use client";

import { useState } from "react";

/* THE M2D STRIP (2026-11-25): one ink strip under the bar on every
 * Rowtember page but /m2d itself, from now until the Concept2 Holiday
 * Challenge closes, so the public finds the sign-up page (owner: "I need
 * this sign up page ... on the Rowtember website"). The raffle banner's
 * cut. The x sets a cookie RowBar reads, so a closed strip never renders
 * again (its name is M2D_BANNER_COOKIE in m2d.ts, handed down: a
 * constant from a client module is not a string on the server). No address
 * on it. */

const m2bCss = `
.row100k .m2b{background:var(--ink);color:var(--paper);border-bottom:2px solid var(--ink)}
.row100k .m2b-in{display:flex;align-items:center;gap:14px;padding:10px 20px;max-width:1040px;margin:0 auto}
.row100k .m2b-k{font-family:var(--row-archivo-black),sans-serif;font-size:15px;letter-spacing:.02em;color:var(--paper);white-space:nowrap;flex:none}
.row100k .m2b-t{font-size:13px;line-height:1.45;flex:1 1 auto;min-width:0;color:var(--paper)}
.row100k .m2b-cta{flex:none;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--paper);border:2px solid var(--paper);padding:6px 12px;text-decoration:none;white-space:nowrap;line-height:16px}
.row100k .m2b-cta:hover,.row100k .m2b-cta:focus-visible{background:var(--water);border-color:var(--water);color:#fff}
.row100k .m2b-x{flex:none;background:none;border:none;color:var(--paper);font-family:var(--row-archivo),sans-serif;font-size:24px;line-height:1;cursor:pointer;padding:0 2px;opacity:.7}
.row100k .m2b-x:hover,.row100k .m2b-x:focus-visible{opacity:1}
@media (max-width:640px){
  .row100k .m2b-in{flex-wrap:wrap;gap:8px 12px;padding:10px 16px 12px}
  .row100k .m2b-x{order:1;margin-left:auto}
  .row100k .m2b-t{order:2;flex-basis:100%}
  .row100k .m2b-cta{order:3}
}
`;

export function M2dBanner({ raised, started, cookie }: { raised: string | null; started: boolean; cookie: string }) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;

  const dismiss = () => {
    try {
      document.cookie = `${cookie}=1; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* no cookie jar: it hides for this page at least */
    }
    setShown(false);
  };

  return (
    <div className="m2b" role="region" aria-label="M2D, row 100K for charity">
      <style>{m2bCss}</style>
      <div className="m2b-in">
        <span className="m2b-k">M2D</span>
        <span className="m2b-t">
          {started
            ? `Your meters turn into dollars for charity, to Dec 24.${raised ? ` ${raised} raised so far.` : ""}`
            : "Starting Nov 26, your meters turn into dollars for charity."}
        </span>
        <a className="m2b-cta" href="/m2d">
          Opt in →
        </a>
        <button type="button" className="m2b-x" aria-label="Dismiss the M2D strip" onClick={dismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
