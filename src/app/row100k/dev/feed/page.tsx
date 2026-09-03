import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { resolvePhotoUrls } from "../../photoUrls";
import {
  CHALLENGE,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  isRow100kAdmin,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";

/* Feed DRAFTS — five genuinely different looks for the same live rows, side
 * by side, so a direction can be picked by eye instead of argued in the
 * abstract. Nothing here is linked from anywhere; the live feed stays
 * untouched at /row100k/feed. Owner-only in production, open in local dev. */

export const metadata: Metadata = {
  title: "Feed drafts — 100K September",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TAKE = 10;

/* Copied from feed/page.tsx on purpose — drafts must age like the real feed
 * ages, and importing from the live page would couple the two files. */
function relTime(thenMs: number, nowMsReal: number): string {
  const s = Math.max(0, Math.floor((nowMsReal - thenMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function absTime(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/* THE STAMP FAMILY drops relative time for the real clock: createdAt shifted
 * minus 7 hours (Pacific — the same precedent as admin/fix-days usWestDay),
 * then read back as UTC fields. "SEP 2 · 6:41 AM". The exact UTC instant
 * stays available in a title attribute on every card. */
const STAMP_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
function stampWhen(createdAt: Date): string {
  const p = new Date(createdAt.getTime() - 7 * 3600_000);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(p.getUTCMinutes()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${STAMP_MONTHS[p.getUTCMonth()]} ${p.getUTCDate()} · ${h}:${min} ${ampm}`;
}

/* Draft-only styles, one prefix per draft (dfa..dfe, df- shared). Rendered as
 * the text child of a style tag, so no double quotes and no angle brackets
 * anywhere in this string (see the note in theme.ts). */
const draftCss = `
.row100k section.df-sec{padding:40px 0 0}
.row100k .df-intro{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--gray);line-height:1.9;text-transform:uppercase;margin-top:-8px}
.row100k .df-note{margin-top:48px;border-top:1px dashed var(--line);padding-top:18px;font-size:11px;letter-spacing:.16em;color:var(--gray);text-align:center;text-transform:uppercase}

/* A — THE TICKER: the feed as a results wire. */
.row100k .dfa-wire{border-top:2px solid var(--ink)}
.row100k .dfa-row{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px dashed var(--line);min-width:0}
.row100k .dfa-num{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);flex:none;font-variant-numeric:tabular-nums}
.row100k .dfa-name{font-weight:700;font-size:14px;text-decoration:none;white-space:nowrap;flex:none;overflow:hidden;text-overflow:ellipsis;max-width:34vw}
.row100k .dfa-name:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfa-m{font-family:var(--row-archivo-black),sans-serif;font-size:15px;color:var(--water);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
.row100k .dfa-t{font-family:var(--row-archivo-black),sans-serif;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
.row100k .dfa-s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);white-space:nowrap;flex:none;font-variant-numeric:tabular-nums}
.row100k .dfa-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--gray);font-size:13px}
.row100k .dfa-when{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);letter-spacing:.06em;white-space:nowrap;flex:none}
.row100k .dfa-thumbs{display:flex;gap:4px;flex:none}
.row100k .dfa-thumbs img{display:block;width:42px;height:42px;object-fit:cover;border:2px solid var(--frame);background:var(--frame)}
@media(max-width:640px){.row100k .dfa-s,.row100k .dfa-title{display:none}}

/* B — THE POSTER: the photos are the product. */
.row100k .dfb-card{border:2px solid var(--ink);background:var(--paper);box-shadow:6px 6px 0 rgba(21,23,26,.14);margin-bottom:28px}
.row100k .dfb-strip{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;padding:9px 12px;border-bottom:2px solid var(--ink);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.row100k .dfb-strip a{text-decoration:none;font-weight:700}
.row100k .dfb-strip a:hover{color:var(--water)}
.row100k .dfb-strip .when{color:var(--gray)}
.row100k .dfb-shot{position:relative;padding:14px 14px 0}
.row100k .dfb-shot img.main{display:block;width:100%;height:auto;border:14px solid var(--frame);background:var(--frame)}
.row100k .dfb-shot img.inset{position:absolute;right:26px;bottom:12px;width:88px;height:88px;object-fit:cover;border:4px solid var(--frame);background:var(--frame);box-shadow:4px 4px 0 rgba(21,23,26,.3)}
.row100k .dfb-nopic{margin:14px 14px 0;background:var(--frame);color:var(--paper);display:flex;align-items:center;justify-content:center;aspect-ratio:16/9;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.18em}
.row100k .dfb-body{padding:10px 14px 16px}
.row100k .dfb-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(38px,10vw,58px);line-height:1;color:var(--water);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.row100k .dfb-sub{margin-top:6px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink-soft);letter-spacing:.08em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfb-title{margin-top:8px;font-weight:700;font-size:15px}

/* C — THE SPLIT: numbers and proof share billing, hard panes. */
.row100k .dfc-card{border:2px solid var(--ink);display:grid;grid-template-columns:1fr 1fr;margin-bottom:16px}
.row100k .dfc-head{grid-column:1 / -1;display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;padding:8px 12px;border-bottom:2px solid var(--ink)}
.row100k .dfc-who{font-weight:700;font-size:14px}
.row100k .dfc-who a{text-decoration:none}
.row100k .dfc-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfc-who .n{font-family:var(--row-mono),monospace;font-weight:400;font-size:11px;color:var(--gray)}
.row100k .dfc-when{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);letter-spacing:.06em;white-space:nowrap}
.row100k .dfc-stats{padding:16px 14px;border-right:2px solid var(--ink);display:flex;flex-direction:column;justify-content:center}
.row100k .dfc-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(26px,7vw,40px);line-height:1;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .dfc-pair{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;margin-top:14px}
.row100k .dfc-k{font-family:var(--row-mono),monospace;font-size:9px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.row100k .dfc-v{font-family:var(--row-archivo-black),sans-serif;font-size:17px;margin-top:3px;font-variant-numeric:tabular-nums}
.row100k .dfc-photos{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--frame);align-content:start}
.row100k .dfc-photos.one{grid-template-columns:1fr}
.row100k .dfc-photos img{display:block;width:100%;height:auto;object-fit:cover;aspect-ratio:1;background:var(--frame)}
.row100k .dfc-none{display:flex;align-items:center;justify-content:center;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.16em;color:var(--gray);min-height:120px;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(21,23,26,.05) 8px,rgba(21,23,26,.05) 16px)}
.row100k .dfc-title{grid-column:1 / -1;border-top:2px solid var(--ink);padding:8px 12px;font-weight:700;font-size:14px}
@media(max-width:560px){.row100k .dfc-card{grid-template-columns:1fr}.row100k .dfc-stats{border-right:none;border-bottom:2px solid var(--ink)}}

/* D — THE STAMP: identity and swagger; the bib as a ghost numeral. */
.row100k .dfd-card{position:relative;overflow:hidden;border:2px solid var(--ink);padding:16px 16px 15px;margin-bottom:16px}
.row100k .dfd-ghost{position:absolute;top:-26px;right:-12px;font-family:var(--row-archivo-black),sans-serif;font-size:132px;line-height:1;color:rgba(21,23,26,.06);letter-spacing:-.04em;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums}
.row100k .dfd-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;position:relative;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em}
.row100k .dfd-top a{font-family:var(--row-archivo),sans-serif;font-weight:700;font-size:13px;letter-spacing:0;text-decoration:none}
.row100k .dfd-top a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfd-top .when{color:var(--gray)}
.row100k .dfd-stamp{display:inline-block;position:relative;margin-top:12px;background:var(--water);color:#fff;font-family:var(--row-archivo-black),sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.06em;padding:4px 10px 3px;transform:rotate(-2deg) skewX(-3deg)}
.row100k .dfd-title{position:relative;margin-top:10px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(20px,5.4vw,30px);line-height:1.06;text-transform:uppercase;letter-spacing:-.01em}
.row100k .dfd-nums{position:relative;display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-top:10px;font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink-soft);letter-spacing:.06em;font-variant-numeric:tabular-nums}
.row100k .dfd-nums .m{color:var(--water);font-weight:700}
.row100k .dfd-photos{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.row100k .dfd-photos.one{grid-template-columns:1fr}
.row100k .dfd-photos img{display:block;width:100%;max-width:100%;height:auto;border:6px solid var(--frame);background:var(--frame)}

/* E — THE DAYBOOK: day-grouped timeline with a thin left rail. */
.row100k .dfe-day{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:0 0 12px;border-bottom:2px solid var(--ink);padding-bottom:7px;text-transform:uppercase}
.row100k .dfe-group + .dfe-group{margin-top:26px}
.row100k .dfe-day .d{font-family:var(--row-archivo-black),sans-serif;font-size:16px;letter-spacing:.02em}
.row100k .dfe-day .t{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .dfe-rail{border-left:2px solid var(--line);margin-left:5px;padding-left:18px}
.row100k .dfe-card{position:relative;border:2px solid var(--ink);padding:10px 12px 11px;margin-bottom:12px}
.row100k .dfe-card:before{content:'';position:absolute;left:-20px;top:18px;width:14px;height:2px;background:var(--line)}
.row100k .dfe-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.row100k .dfe-who{font-weight:700;font-size:13px}
.row100k .dfe-who a{text-decoration:none}
.row100k .dfe-who a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfe-who .n{font-family:var(--row-mono),monospace;font-weight:400;font-size:10px;color:var(--gray)}
.row100k .dfe-when{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);letter-spacing:.06em;white-space:nowrap}
.row100k .dfe-nums{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:4px}
.row100k .dfe-m{font-family:var(--row-archivo-black),sans-serif;font-size:18px;color:var(--water);font-variant-numeric:tabular-nums}
.row100k .dfe-t{font-family:var(--row-archivo-black),sans-serif;font-size:13px;font-variant-numeric:tabular-nums}
.row100k .dfe-s{font-family:var(--row-mono),monospace;font-size:10px;color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .dfe-title{margin-top:3px;font-size:13px;color:var(--ink-soft)}
.row100k .dfe-thumbs{display:flex;gap:6px;margin-top:8px}
.row100k .dfe-thumbs img{display:block;width:48px;height:48px;object-fit:cover;border:3px solid var(--frame);background:var(--frame)}

/* ================= THE STAMP FAMILY — five more swings at draft D. =========
 * Shared rules for the whole family: the session meters are the loudest
 * thing on every card, every card carries the rower total so far, and the
 * clock is real — month, day, time, no relative time anywhere. */

/* F — THE GHOST: the bib haunts the card and the meters run straight over it. */
.row100k .dff-card{position:relative;overflow:hidden;border:2px solid var(--ink);background:var(--paper);padding:16px 16px 15px;margin-bottom:18px}
.row100k .dff-ghost{position:absolute;top:50%;right:-10px;transform:translateY(-50%);font-family:var(--row-archivo-black),sans-serif;font-size:clamp(120px,32vw,200px);line-height:1;color:transparent;-webkit-text-stroke:2px rgba(21,23,26,.12);letter-spacing:-.05em;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums}
.row100k .dff-top{position:relative;display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.row100k .dff-top a{font-weight:700;text-decoration:none;color:var(--ink)}
.row100k .dff-top a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dff-top .when{color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .dff-m{position:relative;margin-top:8px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(44px,10vw,68px);line-height:.95;color:var(--water);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.row100k .dff-m .u{font-size:.32em;letter-spacing:.04em;color:var(--gray);margin-left:4px}
.row100k .dff-sub{position:relative;margin-top:6px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--ink-soft);text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dff-total{position:relative;display:inline-block;margin-top:9px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--water);border-top:2px solid var(--ink);padding-top:5px;text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dff-title{position:relative;margin-top:8px;font-weight:700;font-size:14px}
.row100k .dff-thumbs{position:relative;display:flex;gap:6px;margin-top:10px}
.row100k .dff-thumbs img{display:block;width:52px;height:52px;object-fit:cover;border:3px solid var(--frame);background:var(--frame)}

/* G — THE PLATE: every row is a race plate; the total is the rubber stamp. */
.row100k .dfg-card{border:2px solid var(--ink);background:var(--paper);margin-bottom:20px;box-shadow:5px 5px 0 rgba(21,23,26,.12)}
.row100k .dfg-top{display:flex;align-items:stretch;border-bottom:2px solid var(--ink)}
.row100k .dfg-bib{flex:none;display:flex;align-items:center;border-right:2px solid var(--ink);padding:8px 12px;font-family:var(--row-archivo-black),sans-serif;font-size:20px;letter-spacing:.02em;background:var(--ink);color:var(--paper);font-variant-numeric:tabular-nums}
.row100k .dfg-meta{flex:1 1 auto;min-width:0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.row100k .dfg-meta a{font-weight:700;text-decoration:none;color:var(--ink);font-size:12px;letter-spacing:.04em}
.row100k .dfg-meta a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfg-meta .when{color:var(--gray);font-variant-numeric:tabular-nums}
.row100k .dfg-plate{position:relative;padding:26px 14px 42px;text-align:center}
.row100k .dfg-m{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(48px,11vw,74px);line-height:.92;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .dfg-m .u{font-size:.3em;color:var(--gray);letter-spacing:.06em}
.row100k .dfg-under{margin-top:8px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--ink-soft);text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfg-stamp{position:absolute;right:12px;bottom:10px;transform:rotate(-5deg);border:2px solid var(--water);color:var(--water);background:rgba(244,243,238,.85);font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;padding:4px 8px 3px;text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfg-foot{display:flex;align-items:center;gap:10px;border-top:2px solid var(--ink);padding:8px 12px}
.row100k .dfg-foot .t{flex:1 1 auto;min-width:0;font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row100k .dfg-foot img{display:block;width:44px;height:44px;object-fit:cover;border:3px solid var(--frame);background:var(--frame);flex:none}

/* H — THE HEADLINE: front page news; the meters are the masthead. */
.row100k .dfh-stack{border-top:2px solid var(--ink);margin-top:14px}
.row100k .dfh-card{border-bottom:2px solid var(--ink);padding:20px 0 22px}
.row100k .dfh-kick{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.2em;color:var(--water);text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfh-m{margin-top:4px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(48px,12vw,78px);line-height:.92;letter-spacing:-.03em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .dfh-m .u{font-size:.28em;color:var(--gray);letter-spacing:.02em}
.row100k .dfh-by{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:6px 0;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfh-by a{font-weight:700;text-decoration:none;color:var(--ink)}
.row100k .dfh-by a:hover{color:var(--water);text-decoration:underline;text-underline-offset:3px}
.row100k .dfh-body{display:flex;gap:14px;margin-top:12px;align-items:flex-start}
.row100k .dfh-copy{flex:1 1 auto;min-width:0}
.row100k .dfh-lede{font-weight:700;font-size:15px;line-height:1.35}
.row100k .dfh-lede + .dfh-stats{margin-top:8px}
.row100k .dfh-stats{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--ink-soft);text-transform:uppercase;line-height:2;font-variant-numeric:tabular-nums}
.row100k .dfh-stats .tot{color:var(--water);font-weight:700}
.row100k .dfh-art{flex:none;width:150px;display:flex;flex-direction:column;gap:6px}
.row100k .dfh-art img{display:block;width:100%;height:auto;object-fit:cover;border:4px solid var(--frame);background:var(--frame)}
@media(max-width:520px){.row100k .dfh-art{width:110px}}

/* I — THE INKBLOCK: the one dark card in the family. */
.row100k .dfi-card{position:relative;overflow:hidden;background:var(--ink);color:var(--paper);padding:18px 16px 16px;margin-bottom:18px}
.row100k .dfi-ghost{position:absolute;top:-18px;right:-8px;font-family:var(--row-archivo-black),sans-serif;font-size:130px;line-height:1;color:rgba(244,243,238,.07);letter-spacing:-.04em;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums}
.row100k .dfi-top{position:relative;display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.row100k .dfi-top a{font-weight:700;text-decoration:none;color:var(--paper)}
.row100k .dfi-top a:hover{color:#7cc4e8;text-decoration:underline;text-underline-offset:3px}
.row100k .dfi-top .when{color:rgba(244,243,238,.55);font-variant-numeric:tabular-nums}
.row100k .dfi-m{position:relative;margin-top:10px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(44px,10vw,68px);line-height:.95;letter-spacing:-.02em;color:var(--paper);font-variant-numeric:tabular-nums}
.row100k .dfi-m .u{font-size:.32em;color:rgba(244,243,238,.5);letter-spacing:.04em}
.row100k .dfi-sub{position:relative;margin-top:8px;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;color:rgba(244,243,238,.75);text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfi-stamp{position:relative;display:inline-block;margin-top:12px;background:var(--water);color:#fff;font-family:var(--row-archivo-black),sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px 3px;transform:rotate(-2deg);font-variant-numeric:tabular-nums}
.row100k .dfi-title{position:relative;margin-top:10px;font-weight:700;font-size:14px;color:var(--paper)}
.row100k .dfi-thumbs{position:relative;display:flex;gap:6px;margin-top:12px}
.row100k .dfi-thumbs img{display:block;width:52px;height:52px;object-fit:cover;border:3px solid rgba(244,243,238,.85);background:var(--frame)}

/* J — THE LEDGER STAMP: the official record, stamped on arrival. */
.row100k .dfj-card{position:relative;border:2px solid var(--ink);background:var(--paper);margin:18px 0 24px;overflow:visible}
.row100k .dfj-stamp{position:absolute;top:-11px;left:-9px;z-index:1;transform:rotate(-6deg);border:3px solid var(--water);color:var(--water);background:var(--paper);font-family:var(--row-archivo-black),sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:5px 10px 4px;font-variant-numeric:tabular-nums}
.row100k .dfj-stamp a{color:var(--water);text-decoration:none}
.row100k .dfj-stamp a:hover{text-decoration:underline;text-underline-offset:3px}
.row100k .dfj-body{padding:30px 14px 12px}
.row100k .dfj-mrow{border-bottom:1px dashed var(--line);padding:2px 0 10px}
.row100k .dfj-mrow .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;color:var(--gray);text-transform:uppercase}
.row100k .dfj-m{margin-top:2px;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(40px,9vw,64px);line-height:.95;letter-spacing:-.02em;color:var(--ink);font-variant-numeric:tabular-nums}
.row100k .dfj-m .u{font-size:.3em;color:var(--gray);letter-spacing:.04em}
.row100k .dfj-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;border-bottom:1px dashed var(--line);padding:7px 0;font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-variant-numeric:tabular-nums}
.row100k .dfj-row .k{color:var(--gray);font-size:10px;letter-spacing:.18em}
.row100k .dfj-row .v{color:var(--ink)}
.row100k .dfj-row .v.tot{color:var(--water);font-weight:700}
.row100k .dfj-title{padding:8px 0;border-bottom:1px dashed var(--line);font-weight:700;font-size:13px}
.row100k .dfj-thumbs{display:flex;gap:6px;padding:10px 0 2px}
.row100k .dfj-thumbs img{display:block;width:44px;height:44px;object-fit:cover;border:3px solid var(--frame);background:var(--frame)}
`;

type EntryWithParticipant = {
  id: string;
  participantId: string;
  day: string;
  meters: number;
  seconds: number;
  title: string;
  photos: string[];
  createdAt: Date;
  participant: { displayName: string; rowerNumber: number };
};

/* Same server-computed shape idea as the live FeedItem, plus the raw pieces
 * the drafts need (raw day + meters for the daybook's per-day totals, the
 * relative time on its own for cards whose day lives in a group header). */
type DraftItem = {
  id: string;
  day: string;
  dayStr: string;
  rel: string;
  abs: string;
  rowerNumber: number;
  numStr: string;
  name: string;
  meters: number;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  title: string;
  photoUrls: string[];
};

/* THE STAMP FAMILY additions on top of DraftItem: the real wall-clock string
 * (and its UTC ISO for the title attribute), the session meters as a bare
 * numeral for the giant setting, and the rower's whole-challenge total. */
type StampItem = DraftItem & {
  iso: string;
  whenStr: string;
  bigStr: string;
  totalStr: string;
};

/* ------------------------------------------------------------- the drafts */

function TickerRow({ item }: { item: DraftItem }) {
  return (
    <div className="dfa-row">
      <span className="dfa-num">{item.numStr}</span>
      <a className="dfa-name" href={`/row100k/r/${item.rowerNumber}`}>
        {item.name}
      </a>
      <span className="dfa-m">{item.metersStr}</span>
      <span className="dfa-t">{item.durationStr}</span>
      <span className="dfa-s">{item.splitStr}</span>
      <span className="dfa-title">{item.title ? `— ${item.title}` : ""}</span>
      <span className="dfa-when" title={item.abs}>
        {item.rel}
      </span>
      {item.photoUrls.length > 0 ? (
        <span className="dfa-thumbs">
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

function PosterCard({ item }: { item: DraftItem }) {
  const [main, inset] = item.photoUrls;
  return (
    <article className="dfb-card">
      <div className="dfb-strip">
        <span>
          {item.numStr} · <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        </span>
        <span className="when" title={item.abs}>
          {item.dayStr} · {item.rel}
        </span>
      </div>

      {main ? (
        <div className="dfb-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="main" src={main} alt={`${item.name} after the row`} loading="lazy" />
          {inset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="inset" src={inset} alt="Erg screen" loading="lazy" />
          ) : null}
        </div>
      ) : (
        <div className="dfb-nopic">NO PHOTO WITH THIS ROW</div>
      )}

      <div className="dfb-body">
        <div className="dfb-m">{item.metersStr}</div>
        <div className="dfb-sub">
          {item.durationStr} — {item.splitStr} /500m
        </div>
        {item.title ? <p className="dfb-title">{item.title}</p> : null}
      </div>
    </article>
  );
}

function SplitCard({ item }: { item: DraftItem }) {
  return (
    <article className="dfc-card">
      <div className="dfc-head">
        <span className="dfc-who">
          <span className="n">{item.numStr} · </span>
          <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        </span>
        <span className="dfc-when" title={item.abs}>
          {item.dayStr} · {item.rel}
        </span>
      </div>

      <div className="dfc-stats">
        <div className="dfc-m">{item.metersStr}</div>
        <div className="dfc-pair">
          <div>
            <div className="dfc-k">Time</div>
            <div className="dfc-v">{item.durationStr}</div>
          </div>
          <div>
            <div className="dfc-k">Split /500m</div>
            <div className="dfc-v">{item.splitStr}</div>
          </div>
        </div>
      </div>

      {item.photoUrls.length > 0 ? (
        <div className={`dfc-photos${item.photoUrls.length === 1 ? " one" : ""}`}>
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <div className="dfc-none">NO PHOTO</div>
      )}

      {item.title ? <div className="dfc-title">{item.title}</div> : null}
    </article>
  );
}

function StampCard({ item }: { item: DraftItem }) {
  /* Title is the loudest line; a row without one leads with its meters, and
   * the numbers strip then skips the duplicate. */
  const loud = item.title || item.metersStr;
  return (
    <article className="dfd-card">
      <span className="dfd-ghost" aria-hidden="true">
        {item.numStr}
      </span>
      <div className="dfd-top">
        <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        <span className="when" title={item.abs}>
          {item.rel}
        </span>
      </div>
      <span className="dfd-stamp">{item.dayStr}</span>
      <p className="dfd-title">{loud}</p>
      <div className="dfd-nums">
        {item.title ? <span className="m">{item.metersStr}</span> : null}
        <span>{item.durationStr}</span>
        <span>{item.splitStr} /500m</span>
      </div>
      {item.photoUrls.length > 0 ? (
        <div className={`dfd-photos${item.photoUrls.length === 1 ? " one" : ""}`}>
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function DaybookCard({ item }: { item: DraftItem }) {
  return (
    <article className="dfe-card">
      <div className="dfe-top">
        <span className="dfe-who">
          <span className="n">{item.numStr} · </span>
          <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        </span>
        <span className="dfe-when" title={item.abs}>
          {item.rel}
        </span>
      </div>
      <div className="dfe-nums">
        <span className="dfe-m">{item.metersStr}</span>
        <span className="dfe-t">{item.durationStr}</span>
        <span className="dfe-s">{item.splitStr} /500m</span>
      </div>
      {item.title ? <p className="dfe-title">{item.title}</p> : null}
      {item.photoUrls.length > 0 ? (
        <div className="dfe-thumbs">
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------- the stamp family (F through J) */

/* Small secondary thumbnails shared by the family — the numbers are the star,
 * the photos ride along. */
function StampThumbs({ item, cls }: { item: StampItem; cls: string }) {
  if (item.photoUrls.length === 0) return null;
  return (
    <div className={cls}>
      {item.photoUrls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
          loading="lazy"
        />
      ))}
    </div>
  );
}

function GhostCard({ item }: { item: StampItem }) {
  return (
    <article className="dff-card">
      <span className="dff-ghost" aria-hidden="true">
        {item.numStr}
      </span>
      <div className="dff-top">
        <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        <span className="when" title={item.iso}>
          {item.whenStr}
        </span>
      </div>
      <div className="dff-m">
        {item.bigStr}
        <span className="u">M</span>
      </div>
      <div className="dff-sub">
        {item.durationStr} — {item.splitStr} /500M
      </div>
      <div className="dff-total">TOTAL {item.totalStr}</div>
      {item.title ? <p className="dff-title">{item.title}</p> : null}
      <StampThumbs item={item} cls="dff-thumbs" />
    </article>
  );
}

function PlateCard({ item }: { item: StampItem }) {
  const hasFoot = Boolean(item.title) || item.photoUrls.length > 0;
  return (
    <article className="dfg-card">
      <div className="dfg-top">
        <span className="dfg-bib">{item.numStr}</span>
        <span className="dfg-meta">
          <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
          <span className="when" title={item.iso}>
            {item.whenStr}
          </span>
        </span>
      </div>
      <div className="dfg-plate">
        <div className="dfg-m">
          {item.bigStr}
          <span className="u"> M</span>
        </div>
        <div className="dfg-under">
          {item.durationStr} — {item.splitStr} /500M
        </div>
        <span className="dfg-stamp">TOTAL {item.totalStr}</span>
      </div>
      {hasFoot ? (
        <div className="dfg-foot">
          <span className="t">{item.title}</span>
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function HeadlineCard({ item }: { item: StampItem }) {
  return (
    <article className="dfh-card">
      <div className="dfh-kick">NO {item.numStr} — ROWTEMBER DISPATCH</div>
      <div className="dfh-m">
        {item.bigStr}
        <span className="u"> METERS</span>
      </div>
      <div className="dfh-by">
        <span>
          BY <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        </span>
        <span title={item.iso}>{item.whenStr}</span>
      </div>
      <div className="dfh-body">
        <div className="dfh-copy">
          {item.title ? <p className="dfh-lede">{item.title}</p> : null}
          <div className="dfh-stats">
            <div>
              TIME {item.durationStr} — SPLIT {item.splitStr} /500M
            </div>
            <div className="tot">TOTAL {item.totalStr} THIS ROWTEMBER</div>
          </div>
        </div>
        {item.photoUrls.length > 0 ? <StampThumbs item={item} cls="dfh-art" /> : null}
      </div>
    </article>
  );
}

function InkblockCard({ item }: { item: StampItem }) {
  return (
    <article className="dfi-card">
      <span className="dfi-ghost" aria-hidden="true">
        {item.numStr}
      </span>
      <div className="dfi-top">
        <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
        <span className="when" title={item.iso}>
          {item.whenStr}
        </span>
      </div>
      <div className="dfi-m">
        {item.bigStr}
        <span className="u"> M</span>
      </div>
      <div className="dfi-sub">
        {item.durationStr} — {item.splitStr} /500M
      </div>
      <div>
        <span className="dfi-stamp">TOTAL {item.totalStr}</span>
      </div>
      {item.title ? <p className="dfi-title">{item.title}</p> : null}
      <StampThumbs item={item} cls="dfi-thumbs" />
    </article>
  );
}

function LedgerStampCard({ item }: { item: StampItem }) {
  return (
    <article className="dfj-card">
      <span className="dfj-stamp">
        <a href={`/row100k/r/${item.rowerNumber}`}>
          NO {item.numStr} · {item.name}
        </a>
      </span>
      <div className="dfj-body">
        <div className="dfj-mrow">
          <div className="k">Meters</div>
          <div className="dfj-m">
            {item.bigStr}
            <span className="u"> M</span>
          </div>
        </div>
        <div className="dfj-row">
          <span className="k">Date</span>
          <span className="v" title={item.iso}>
            {item.whenStr}
          </span>
        </div>
        <div className="dfj-row">
          <span className="k">Time</span>
          <span className="v">{item.durationStr}</span>
        </div>
        <div className="dfj-row">
          <span className="k">Split /500m</span>
          <span className="v">{item.splitStr}</span>
        </div>
        <div className="dfj-row">
          <span className="k">Total</span>
          <span className="v tot">{item.totalStr}</span>
        </div>
        {item.title ? <div className="dfj-title">{item.title}</div> : null}
        <StampThumbs item={item} cls="dfj-thumbs" />
      </div>
    </article>
  );
}

/* Day groups for the daybook, newest day first; entries keep feed order.
 * Totals are computed from the rows on this page only — with take 10 a
 * day can be partial, which is fine for a draft. */
function groupByDay(items: DraftItem[]): [string, DraftItem[]][] {
  const map = new Map<string, DraftItem[]>();
  for (const it of items) {
    const list = map.get(it.day);
    if (list) list.push(it);
    else map.set(it.day, [it]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function DraftHead({ name, bet }: { name: string; bet: string }) {
  return (
    <div className="sec-head">
      <h2>{name}</h2>
      <span className="mono">{bet}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- the page */

export default async function FeedDraftsPage() {
  const actor = await getEffectiveActor();
  const admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  /* Owner-only in production; open in local dev so drafts can be eyeballed
   * without a session. */
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  let entries: EntryWithParticipant[] = [];
  try {
    entries = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TAKE,
      select: {
        id: true,
        participantId: true,
        day: true,
        meters: true,
        seconds: true,
        title: true,
        photos: true,
        createdAt: true,
        participant: { select: { displayName: true, rowerNumber: true } },
      },
    });
  } catch (err) {
    console.error("row100k/dev/feed: failed to load feed data", err);
  }

  const photoUrls = await Promise.all(entries.map((e) => resolvePhotoUrls(e.photos)));

  // Real wall clock, never nowMs() — createdAt is not demo-shifted.
  const nowReal = Date.now();
  const items: DraftItem[] = entries.map((e, i) => ({
    id: e.id,
    day: e.day,
    dayStr: fmtDay(e.day),
    rel: relTime(e.createdAt.getTime(), nowReal),
    abs: absTime(e.createdAt),
    rowerNumber: e.participant.rowerNumber,
    numStr: fmtRowerNumber(e.participant.rowerNumber),
    name: e.participant.displayName,
    meters: e.meters,
    metersStr: fmtMeters(e.meters),
    durationStr: fmtDuration(e.seconds),
    splitStr: fmtSplit(e.meters, e.seconds),
    title: e.title,
    photoUrls: photoUrls[i],
  }));

  /* The poster draft is the heavy one (a full-width mat per row) — eight
   * rows make the point without a wall of hero images. */
  const posterItems = items.slice(0, 8);
  const dayGroups = groupByDay(items);

  /* THE STAMP FAMILY needs each rower's Rowtember total so far. One extra
   * findMany over the whole challenge, summed in memory — the same in-memory
   * pattern as computeBoards; one month of one challenge fits in a Map. */
  const totals = new Map<string, number>();
  try {
    const allRows = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, meters: true },
    });
    for (const r of allRows) {
      totals.set(r.participantId, (totals.get(r.participantId) ?? 0) + r.meters);
    }
  } catch (err) {
    console.error("row100k/dev/feed: failed to load challenge totals", err);
  }

  const stampItems: StampItem[] = items.map((it, i) => ({
    ...it,
    iso: entries[i].createdAt.toISOString(),
    whenStr: stampWhen(entries[i].createdAt),
    bigStr: Math.round(it.meters).toLocaleString("en-US"),
    totalStr: fmtMeters(totals.get(entries[i].participantId) ?? it.meters),
  }));

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{draftCss}</style>

      <RowBar />

      {items.length === 0 ? (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>Feed drafts</h2>
              <span className="mono">DEV ONLY</span>
            </div>
            <p className="board-empty">NOTHING LOGGED YET — THE DRAFTS NEED LIVE ROWS TO SHOW.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="A · The ticker" bet="THE BET: THE FEED AS A RESULTS WIRE" />
              <p className="df-intro">
                Five looks, same {items.length} live rows. Nothing here ships until one is picked.
              </p>
              <div className="dfa-wire" style={{ marginTop: 14 }}>
                {items.map((item) => (
                  <TickerRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="B · The poster" bet="THE BET: THE PHOTOS ARE THE PRODUCT" />
              {posterItems.map((item) => (
                <PosterCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="C · The split" bet="THE BET: NUMBERS AND PROOF SHARE BILLING" />
              {items.map((item) => (
                <SplitCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="D · The stamp" bet="THE BET: IDENTITY AND SWAGGER" />
              {items.map((item) => (
                <StampCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="E · The daybook" bet="THE BET: A SHARED TRAINING LOG" />
              {dayGroups.map(([day, dayItems]) => {
                const dayMeters = dayItems.reduce((s, it) => s + it.meters, 0);
                return (
                  <div key={day} className="dfe-group">
                    <div className="dfe-day">
                      <span className="d">{fmtDay(day)}</span>
                      <span className="t">
                        {dayItems.length} {dayItems.length === 1 ? "ROW" : "ROWS"} —{" "}
                        {fmtMeters(dayMeters)}
                      </span>
                    </div>
                    <div className="dfe-rail">
                      {dayItems.map((item) => (
                        <DaybookCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="The stamp family" bet="FIVE MORE SWINGS AT D" />
              <p className="df-intro">
                Direction picked: identity and swagger. Every card below sets the session
                meters louder than D, carries the rower total for Rowtember so far, and
                prints the real date and time — relative time is gone.
              </p>
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="F · The ghost" bet="THE BET: THE BIB HAUNTS EVERY CARD" />
              {stampItems.map((item) => (
                <GhostCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="G · The plate" bet="THE BET: EVERY ROW IS A RACE PLATE" />
              {stampItems.map((item) => (
                <PlateCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="H · The headline" bet="THE BET: FRONT PAGE NEWS, DAILY" />
              <div className="dfh-stack">
                {stampItems.map((item) => (
                  <HeadlineCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="I · The inkblock" bet="THE BET: ONE DARK CARD SHOUTS LOUDEST" />
              {stampItems.map((item) => (
                <InkblockCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section className="df-sec">
            <div className="wrap">
              <DraftHead name="J · The ledger stamp" bet="THE BET: THE OFFICIAL RECORD, STAMPED" />
              {stampItems.map((item) => (
                <LedgerStampCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="wrap">
        <p className="mono df-note">DRAFTS — PICK A DIRECTION, NOTHING HERE IS LIVE</p>
      </div>

      <RowFooter />
    </div>
  );
}
