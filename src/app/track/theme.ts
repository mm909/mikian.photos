import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";

/**
 * The tracker's look (TRACKER_SPEC.md §11, from the owner's mockups): dark
 * and high-visibility. Ground #101214, panel #1A1D21, line #2C3137, text
 * #F1F1EC, muted #A4A9AF. Entry colours come from the event file (#D4FF3A
 * and #FF6A3D for LASD26) and are NEVER the only way to tell entries apart:
 * the short name sits in the dot and on every row.
 *
 * Fonts: Barlow Condensed for numbers and headings, Barlow for body, IBM
 * Plex Mono for small labels. Everything is scoped under `.trk` so nothing
 * leaks into the rest of the site, and the site's globals stay out of here.
 */

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--trk-sans",
});
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--trk-cond",
});
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--trk-mono",
});

/** Put on the page wrapper with the `trk` class. */
export const fontClass = `${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`;

export const COLORS = {
  ground: "#101214",
  panel: "#1A1D21",
  line: "#2C3137",
  text: "#F1F1EC",
  muted: "#A4A9AF",
  warn: "#FFC857",
  bad: "#FF5A5A",
  ok: "#7BE495",
} as const;

/** Base stylesheet. Pages append their own rules in their own <style>. */
export const baseCss = `
.trk,.trk *{box-sizing:border-box;margin:0;padding:0}
/* globals.css styles bare p/h1-h3 for the marketplace (serif headings, ink
 * text on paper); inside the tracker those elements inherit the dark theme. */
.trk p,.trk h1,.trk h2,.trk h3,.trk h4{font-family:inherit;font-size:inherit;font-weight:inherit;line-height:inherit;letter-spacing:0;color:inherit;text-wrap:initial}
.trk{
  --ground:${COLORS.ground};--panel:${COLORS.panel};--line:${COLORS.line};
  --text:${COLORS.text};--muted:${COLORS.muted};--warn:${COLORS.warn};--bad:${COLORS.bad};--ok:${COLORS.ok};
  background:var(--ground);color:var(--text);
  font-family:var(--trk-sans),system-ui,sans-serif;font-size:16px;line-height:1.4;
  -webkit-font-smoothing:antialiased;color-scheme:dark;min-height:100dvh;width:100%;
}
.trk a{color:inherit}
.trk :focus-visible{outline:2px solid var(--text);outline-offset:2px}
.trk button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.trk .cond{font-family:var(--trk-cond),var(--trk-sans),sans-serif;font-weight:600;letter-spacing:.005em}
.trk .mono{font-family:var(--trk-mono),ui-monospace,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.trk .num{font-family:var(--trk-cond),sans-serif;font-weight:700;font-variant-numeric:tabular-nums lining-nums}
.trk .muted{color:var(--muted)}
.trk .panel{background:var(--panel);border:1px solid var(--line);border-radius:10px}
.trk .wrap{max-width:720px;margin:0 auto;padding:0 16px}
.trk .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-weight:600}
.trk .btn:disabled{opacity:.5;cursor:default}
.trk .btn--primary{background:var(--text);color:var(--ground);border-color:var(--text)}
.trk .tag{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 6px;border-radius:6px;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:13px;color:#101214}
.trk .dot{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-family:var(--trk-cond),sans-serif;font-weight:700;font-size:13px;color:#101214;border:2px solid #101214;box-shadow:0 0 0 2px rgba(241,241,236,.35)}
.trk .stale{color:var(--warn)}
.trk .bad{color:var(--bad)}
.trk .live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(123,228,149,.2);animation:trkpulse 1.6s ease-in-out infinite}
@keyframes trkpulse{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion: reduce){.trk *{animation:none!important;transition:none!important}}
`;
