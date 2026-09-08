"use client";

import { useState } from "react";
import { raffleDismissCookie } from "./raffles";

/* THE RAFFLE BANNER (owner, 2026-09-08): one ink strip under the bar while
 * a raffle is taking entries — the prize, the rule in a breath, and the one
 * thing to do about it. RowBar decides whether it renders at all (the
 * window, the page, the dismiss cookie) and whether the viewer is already
 * in; this only draws it and handles the ×.
 *
 * Dismissed is a cookie, not localStorage: the server reads it, so a
 * closed banner never comes back — not for a frame on the next page, not
 * next week (owner: "once the user closes it it should not reopen").
 *
 * Own style tag (theme.ts untouched): no double quotes, apostrophes or
 * angle brackets in the string — React escapes them inside a style tag. */
const rfbCss = `
.row100k .rfb{background:var(--ink);color:var(--paper);border-bottom:2px solid var(--ink)}
.row100k .rfb-in{display:flex;align-items:center;gap:14px;padding:10px 20px;max-width:1040px;margin:0 auto}
.row100k .rfb-k{font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--paper);opacity:.7;white-space:nowrap;flex:none}
.row100k .rfb-t{font-size:13px;line-height:1.45;flex:1 1 auto;min-width:0;color:var(--paper)}
.row100k .rfb-t b{font-family:var(--row-archivo-black),sans-serif;font-weight:400;letter-spacing:.02em;text-transform:uppercase;color:#fff}
.row100k .rfb-cta{flex:none;font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);background:var(--paper);border:2px solid var(--paper);padding:6px 12px;text-decoration:none;white-space:nowrap;line-height:16px}
.row100k .rfb-cta:hover,.row100k .rfb-cta:focus-visible{background:var(--water);border-color:var(--water);color:#fff}
.row100k .rfb-cta.in{background:transparent;color:var(--paper)}
.row100k .rfb-x{flex:none;background:none;border:none;color:var(--paper);font-family:var(--row-archivo),sans-serif;font-size:24px;line-height:1;cursor:pointer;padding:0 2px;opacity:.7}
.row100k .rfb-x:hover,.row100k .rfb-x:focus-visible{opacity:1}
@media (max-width:640px){
  .row100k .rfb-in{flex-wrap:wrap;gap:8px 12px;padding:10px 16px 12px}
  .row100k .rfb-k{order:0}
  .row100k .rfb-x{order:1;margin-left:auto}
  .row100k .rfb-t{order:2;flex-basis:100%}
  .row100k .rfb-cta{order:3}
}
`;

export function RaffleBanner({
  slug,
  title,
  valueUsd,
  when,
  entered,
  joined,
}: {
  slug: string;
  title: string;
  valueUsd: number;
  /* "Sunday, Sep 13" — printed after the title. */
  when: string;
  /* The viewer already has a row in the window. */
  entered: boolean;
  /* The viewer has a rower number, so LOG A ROW can open the form. */
  joined: boolean;
}) {
  const [shown, setShown] = useState(true);
  if (!shown) return null;

  const dismiss = () => {
    try {
      document.cookie = `${raffleDismissCookie(slug)}=1; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* no cookie jar — it hides for this page at least */
    }
    setShown(false);
  };

  return (
    <div className="rfb" role="region" aria-label="The raffle">
      <style>{rfbCss}</style>
      <div className="rfb-in">
        <span className="rfb-k">The raffle</span>
        <span className="rfb-t">
          A ${valueUsd} ticket to <b>{title}</b>, {when} — log a row Wednesday, Thursday or Friday and you are in.
        </span>
        {entered ? (
          <a className="rfb-cta in" href="/row100k/partners#raffle">
            You&apos;re in · the raffle →
          </a>
        ) : (
          <a
            className="rfb-cta"
            href={joined ? "/row100k#log" : "/row100k#join"}
            onClick={(e) => {
              // The same in-place trick as BarLog: on a page that carries the
              // log form, tell it to open rather than hopping to the front.
              if (!joined || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              if (document.getElementById("log")?.classList.contains("front-act")) {
                e.preventDefault();
                window.dispatchEvent(new Event("row100k:log"));
              }
            }}
          >
            Log a row to enter →
          </a>
        )}
        <button type="button" className="rfb-x" aria-label="Dismiss the raffle banner" onClick={dismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
