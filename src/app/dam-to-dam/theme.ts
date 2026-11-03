import { Space_Mono } from "next/font/google";

/* THE DAM TO DAM LOOK (owner, 2026-11-03) — a survey chart, in two
 * palettes the owner kept after seeing them side by side ("the survey ink
 * and topo olive. Keep both options"): SURVEY, ink-blue line work on
 * paper cream with orange pops (the vintage Canyonlands direction), and
 * OLIVE, the topo poster — dark olive ground, cream line work, the same
 * orange. The first neon-on-black pass was retired with that call. All
 * mono, wide letter-spacing. Scoped under .dd, classes .dd-; the palette
 * is a second class on the root (dd-survey / dd-olive) and everything
 * below reads the variables, so a palette is one class swap.
 *
 * The --m- variables are the chart's (RouteMap.tsx).
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string. */

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--dd-mono",
});

export const css = `
.dd,.dd *{margin:0;padding:0;box-sizing:border-box}
.dd{
  background:var(--ground);color:var(--ink);
  font-family:var(--dd-mono),monospace;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased;
  min-height:100vh;min-height:100dvh;width:100%;
}
.dd.dd-survey{
  --ground:#f3ecdc; --ink:#1f2c53; --ink-dim:rgba(31,44,83,.68); --mute:rgba(31,44,83,.42); --rule:rgba(31,44,83,.16);
  --pop:#c2491d; --cta-ink:#fdf7ec;
  --m-rim:rgba(38,61,131,.3); --m-hatch:rgba(38,61,131,.25); --m-shore:rgba(38,61,131,.8); --m-wall:rgba(38,61,131,.85);
  --m-route:#2342a6; --m-strong:#1f2c53; --m-dim:rgba(31,44,83,.55); --m-waypt:rgba(31,44,83,.7); --m-mute:rgba(31,44,83,.45); --m-furn:rgba(31,44,83,.45);
  --m-dot:#d85a30; --m-meters:#b3451f; --m-leader:rgba(216,90,48,.6);
  color-scheme:light;
}
.dd.dd-olive{
  --ground:#3e4637; --ink:#f2f0e4; --ink-dim:rgba(242,240,228,.7); --mute:rgba(242,240,228,.45); --rule:rgba(242,240,228,.16);
  --pop:#e8975c; --cta-ink:#2c3327;
  --m-rim:rgba(242,240,228,.3); --m-hatch:rgba(242,240,228,.25); --m-shore:rgba(242,240,228,.85); --m-wall:rgba(242,240,228,.9);
  --m-route:#f2f0e4; --m-strong:#f2f0e4; --m-dim:rgba(242,240,228,.55); --m-waypt:rgba(242,240,228,.7); --m-mute:rgba(242,240,228,.4); --m-furn:rgba(242,240,228,.45);
  --m-dot:#e07b39; --m-meters:#e8a076; --m-leader:rgba(224,123,57,.7);
  color-scheme:dark;
}
@media (prefers-reduced-motion: reduce){ .dd *{transition:none!important;animation:none!important} }
.dd a{color:inherit}
.dd :focus-visible{outline:2px solid var(--pop);outline-offset:3px}
.dd .wrap{max-width:980px;margin:0 auto;padding:0 24px}

/* THE BAR: the wordmark, the doors, the dev tag. */
.dd .dd-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border-bottom:1px solid var(--rule)}
.dd .dd-wm{font-size:15px;letter-spacing:.42em;text-transform:uppercase;font-weight:700}
.dd .dd-wm a{text-decoration:none}
.dd .dd-doors{display:flex;align-items:center;gap:14px}
.dd .dd-door{font-size:11px;letter-spacing:.22em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid var(--pop);padding-bottom:2px;white-space:nowrap}
.dd .dd-dev{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--pop);border:1px solid var(--pop);padding:4px 9px;white-space:nowrap}

/* THE HERO, then the chart under it at full width (iso) or centered
 * and tall (top). */
.dd .dd-hero{padding-top:56px}
.dd h1{font-size:clamp(42px,9vw,74px);line-height:1.04;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.dd h1 span{color:var(--pop)}
.dd .dd-sub{margin-top:18px;font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--pop)}
.dd .dd-lede{margin-top:20px;color:var(--ink-dim);max-width:38em;line-height:1.85}
.dd .dd-facts{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin-top:36px}
@media (max-width:760px){ .dd .dd-facts{grid-template-columns:1fr 1fr} }
.dd .dd-fact{padding:16px 18px 16px 0}
.dd .dd-fact + .dd-fact{border-left:1px solid var(--rule);padding-left:18px}
@media (max-width:760px){
  .dd .dd-fact:nth-child(n+3){border-top:1px solid var(--rule)}
  .dd .dd-fact:nth-child(3){border-left:0;padding-left:0}
}
.dd .dd-fact .k{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}
.dd .dd-fact .v{font-size:20px;font-weight:700;margin-top:6px}
.dd .dd-fact .v small{display:block;font-size:11px;font-weight:400;color:var(--ink-dim);margin-top:4px;letter-spacing:.02em}

/* THE CHART (RouteMap.tsx). The dashes crawl; reduced motion stills
 * them. The top view is tall and holds the middle of the page. */
.dd .dd-chart{margin-top:44px}
.dd .dd-chart.top{max-width:560px;margin-left:auto;margin-right:auto}
.dd .dd-map{display:block;width:100%;height:auto}
@keyframes dd-flow{to{stroke-dashoffset:-144px}}
.dd .dd-route{animation:dd-flow 8s linear infinite}

/* SECTIONS: ruled heads, then label/body rows. */
.dd section{padding-top:72px}
.dd .dd-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1px solid var(--ink);padding-bottom:12px}
.dd .dd-head h2{font-size:clamp(22px,5vw,32px);letter-spacing:.1em;text-transform:uppercase;font-weight:700}
.dd .dd-head span{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);white-space:nowrap}
.dd .dd-row{display:grid;grid-template-columns:180px 1fr;gap:18px;padding:18px 0;border-bottom:1px solid var(--rule)}
@media (max-width:620px){ .dd .dd-row{grid-template-columns:1fr;gap:6px} }
.dd .dd-row .k{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--pop);padding-top:3px}
.dd .dd-row p{color:var(--ink-dim)}
.dd .dd-row p b{color:var(--ink);font-weight:700}
.dd .dd-note{margin-top:18px;font-size:12px;color:var(--mute);line-height:1.8}
.dd .dd-sim{display:inline-block;margin-top:14px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);border:1px solid var(--rule);padding:4px 9px}

/* THE ONE SOLID BLOCK: a call to action in the pop color. */
.dd .dd-cta{display:block;width:100%;margin-top:30px;background:var(--pop);color:var(--cta-ink);text-align:center;font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;padding:18px 16px;text-decoration:none}
.dd .dd-cta:hover{filter:brightness(1.08)}

/* SETTINGS (settings/page.tsx): plain ruled option rows. */
.dd .dd-opt{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid var(--rule);cursor:pointer}
.dd .dd-opt input{accent-color:var(--pop);width:16px;height:16px;cursor:pointer}
.dd .dd-opt .t{font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.dd .dd-opt .d{font-size:12px;color:var(--ink-dim)}

/* THE GAUGE (donate page): the money drawn as the river line. */
.dd .dd-gauge{margin-top:36px}
.dd .dd-gauge .lbl{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);margin-top:10px}

.dd footer{margin-top:88px;border-top:1px solid var(--rule);padding:26px 24px;text-align:center;font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--mute)}
`;
