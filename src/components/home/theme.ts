import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";

/* Shared look for the mikianmusser.com landing page: the same challenge-page
 * language as /row100k and /lasd26 (paper, noise, Archivo trio, water-blue,
 * 2px ink rules) so the front door reads as the same family as the pages it
 * points at. Scoped under .home so nothing leaks into the retired photo
 * marketplace routes, which keep their own kit. The page body (Home.tsx)
 * layers its own scoped CSS on top.
 *
 * RULE (bit /row100k twice): this CSS string must contain NO double quotes,
 * NO apostrophes and NO angle brackets anywhere, comments included — React
 * escapes them server-side only and the style tag hydration-mismatches. */

export const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--home-archivo",
});
export const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--home-archivo-black",
});
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--home-mono",
});

/* Faint 2x2 noise tile shared with /lasd26 and /row100k. */
export const NOISE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP88vkdAwMDEwMDAwMDAwAiLALZuZcPKwAAAABJRU5ErkJggg==";

export const css = `
.home,.home *{margin:0;padding:0;box-sizing:border-box}
.home{
  --paper:#F4F3EE; --ink:#15171a; --ink-soft:#3b3e42; --gray:#8a8a85;
  --water:#0077B6; --water-hover:#1a90d4; --safety:#FF4B00; --safety-hover:#ff6a2b;
  background:var(--paper) url(${NOISE}) repeat;
  color:var(--ink);
  font-family:var(--home-archivo),sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;
  min-height:100vh;width:100%;color-scheme:light;
  display:flex;flex-direction:column;
}
.home main{flex:1 0 auto;width:100%}
@media (prefers-reduced-motion: reduce){ .home *{transition:none!important;animation:none!important} }
.home .mono{font-family:var(--home-mono),monospace}
.home .wrap{max-width:1040px;margin:0 auto;padding:0 20px;width:100%}
.home a{color:inherit}
.home :focus-visible{outline:2px solid var(--water);outline-offset:3px}
.home .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* The bar: MIKIAN.MUSSER wordmark left, the two campaign chips right, each
 * in its own page colour (the ROW100K tag is water-blue, LASD26 is safety
 * orange, both with white type). */
.home .bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 12px;padding:14px 20px;border-bottom:2px solid var(--ink);position:sticky;top:0;background:var(--paper) url(${NOISE}) repeat;z-index:50}
.home .bar .brand{font-family:var(--home-archivo-black),sans-serif;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;line-height:1;white-space:nowrap}
.home .bar .brand .dot{color:var(--water)}
.home .bar nav{display:flex;gap:10px;align-items:center}
.home .bar nav a{font-family:var(--home-mono),monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;white-space:nowrap;color:#fff;padding:3px 8px}
.home .bar nav a.row{background:var(--water)}
.home .bar nav a.row:hover{background:var(--water-hover)}
.home .bar nav a.lasd{background:var(--safety)}
.home .bar nav a.lasd:hover{background:var(--safety-hover)}
@media(max-width:400px){ .home .bar nav{gap:8px} .home .bar nav a{font-size:11px;padding:3px 7px} }

/* Live pulse next to the status line. */
.home .live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--water);margin-right:9px;vertical-align:middle;position:relative;top:-1px;animation:homePulse 1.6s ease-in-out infinite}
@keyframes homePulse{0%,100%{opacity:1}50%{opacity:.3}}

/* Footer, straight from /row100k. */
.home footer{padding:44px 20px 64px;border-top:2px solid var(--ink);margin-top:56px}
.home footer .big{font-family:var(--home-archivo-black),sans-serif;font-size:13px;letter-spacing:.1em;margin-bottom:10px}
.home footer .mono{font-size:11px;color:var(--gray);line-height:1.9}
.home footer a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.home footer a:hover{color:var(--water)}

/* Stay light in dark mode, but take the glare off (same as the siblings). */
@media (prefers-color-scheme: dark){
  .home{--paper:#E9E7DF}
}
`;
