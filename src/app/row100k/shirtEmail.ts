import { PICKUP_LINE, SHIRT_FREE_AT, SHIRT_PRICE_USD } from "./shirt";

/* THE SHIRT EMAILS (owner, 2026-09-08: "formatted like Rowtember — formats
 * and colours and style"). Four notes — the receipt, the size change, and
 * the two month-end verdicts — each as an HTML email on cream with ink
 * type, water-blue accents, mono uppercase eyebrows, a big figure for the
 * meters and the ROWTEMBER mark as white text in a blue box, plus a plain
 * text twin that says the same thing in the same order.
 *
 * Plain string builders, inline styles only, no images, no <style> block:
 * email clients strip everything else. Server only — the routes import
 * this; the page never does. */

export type ShirtMail = { subject: string; text: string; html: string };

/* ---------------------------------------------------------------- tokens */

const PAPER = "#F4F3EE";
const INK = "#15171A";
const INK_SOFT = "#3B3E42";
const GRAY = "#8A8A85";
const LINE = "#C9C8C0";
const WATER = "#0077B6";

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";
const BLACK = "'Arial Black',Arial,Helvetica,sans-serif";
const SANS = "Arial,Helvetica,sans-serif";

const K = `${SHIRT_FREE_AT / 1000}K`;
const M = (n: number) => `${Math.round(n).toLocaleString("en-US")} m`;
const NUM = (n: number) => String(n).padStart(3, "0");

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------------------------------------------------------------- pieces */

const eyebrow = (t: string) =>
  `<div style="font-family:${MONO};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GRAY};margin:0 0 8px;">${escape(t)}</div>`;

const body = (t: string) =>
  `<p style="margin:10px 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK_SOFT};">${escape(t)}</p>`;

const small = (t: string, color = GRAY) =>
  `<div style="font-family:${MONO};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${color};line-height:1.7;margin:8px 0 0;">${escape(t)}</div>`;

/* The big figure: Archivo Black on the site, Arial Black in the mail. */
const big = (inner: string, color = INK, size = 40) =>
  `<div style="font-family:${BLACK};font-weight:900;font-size:${size}px;line-height:1;letter-spacing:-.02em;color:${color};">${inner}</div>`;

/* The meters figure with a small grey unit, the way the stat tiles print it. */
const meters = (n: number) =>
  big(
    `${escape(Math.round(n).toLocaleString("en-US"))}<span style="font-family:${SANS};font-weight:700;font-size:.5em;color:${GRAY};"> m</span>`,
    WATER,
    44,
  );

const button = (label: string, href: string) =>
  `<a href="${escape(href)}" style="display:inline-block;background:${WATER};color:#ffffff;font-family:${BLACK};font-weight:900;font-size:16px;letter-spacing:.04em;text-transform:uppercase;padding:14px 22px;text-decoration:none;margin-top:14px;">${escape(label)}</a>`;

/* One block: a dashed hairline, an eyebrow, whatever follows. */
const block = (inner: string, first = false) =>
  `<tr><td style="padding:18px 0 20px;border-top:${first ? `2px solid ${INK}` : `1px dashed ${LINE}`};">${inner}</td></tr>`;

/* The page: the ROWTEMBER mark in a blue box, a mono kicker, the blocks,
 * the sign-off on a solid rule. */
function shell(kicker: string, blocks: string[]): string {
  return [
    `<div style="background:${PAPER};padding:28px 16px;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">`,
    `<tr><td style="padding:0 0 16px;">`,
    `<span style="display:inline-block;background:${WATER};color:#ffffff;font-family:${BLACK};font-weight:900;font-size:13px;letter-spacing:.14em;padding:7px 10px 6px;vertical-align:middle;">ROWTEMBER</span>`,
    `<span style="display:inline-block;font-family:${MONO};font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GRAY};padding-left:12px;vertical-align:middle;">${escape(kicker)}</span>`,
    `</td></tr>`,
    ...blocks,
    `<tr><td style="padding:18px 0 0;border-top:2px solid ${INK};">`,
    `<div style="font-family:${BLACK};font-weight:900;font-size:18px;color:${INK};">Row on.</div>`,
    small("Rowtember 2026 · Mikian Musser"),
    `</td></tr>`,
    `</table>`,
    `</div>`,
  ].join("\n");
}

/* ------------------------------------------------------ the four blocks */

type Standing = { free: boolean; line: string; sentence: string };

/* Where they stand on the meters, three ways: the mono line under the
 * figure, and the sentence the text twin prints. */
function standing(m: number): Standing {
  if (m >= SHIRT_FREE_AT) {
    return {
      free: true,
      line: `PAST THE ${K} — THE SHIRT IS FREE, AS IT STANDS`,
      sentence: `You are at ${M(m)} — past the ${K}. As it stands, the shirt is free.`,
    };
  }
  const left = SHIRT_FREE_AT - m;
  return {
    free: false,
    line: `${Math.round(left).toLocaleString("en-US")} M FROM THE ${K}`,
    sentence: `You are at ${M(m)} — ${M(left)} from the ${K}.`,
  };
}

const kindLine = (kind: "stock" | "preorder") => (kind === "preorder" ? "PRE-ORDER — WITH THE NEXT RUN" : "ON THE SHELF");

const PRICE_REMINDER = `Free if you have rowed ${M(SHIRT_FREE_AT)} by the end of September. $${SHIRT_PRICE_USD} if you have not. Nothing is charged today.`;
const LATER_LINE = `The month settles it — no paying early, and the shirt never comes out of your total.`;

function metersBlock(m: number): string {
  const s = standing(m);
  return block(eyebrow("Your meters") + meters(m) + small(s.line, s.free ? WATER : GRAY));
}
const priceBlock = () => block(eyebrow(`$${SHIRT_PRICE_USD} at the end of the month`) + body(PRICE_REMINDER));
const laterBlock = () => block(eyebrow("Buy now, pay later") + body(LATER_LINE));
const pickupBlock = () => block(eyebrow("Pick-up") + body(PICKUP_LINE));

/* The same four in plain text. */
function fourText(m: number): string[] {
  return [
    `YOUR METERS`,
    standing(m).sentence,
    ``,
    `$${SHIRT_PRICE_USD} AT THE END OF THE MONTH`,
    PRICE_REMINDER,
    ``,
    `BUY NOW, PAY LATER`,
    LATER_LINE,
    ``,
    `PICK-UP`,
    PICKUP_LINE,
  ];
}

/* ------------------------------------------------------------ the mails */

/* The receipt, the moment they buy: their shirt, then the four blocks the
 * owner named — their meters, the $20 reminder, buy now pay later, pick-up. */
export function receiptEmail(o: {
  name: string;
  rowerNumber: number;
  size: string;
  kind: "stock" | "preorder";
  meters: number;
}): ShirtMail {
  const num = NUM(o.rowerNumber);
  const who = `${o.name} · rower ${num} · ${kindLine(o.kind)}`;
  return {
    subject: `Your Rowtember shirt — size ${o.size}, rower ${num}`,
    html: shell("The shirt · Receipt", [
      block(eyebrow("Your shirt") + big(`Size ${escape(o.size)}`) + small(who), true),
      metersBlock(o.meters),
      priceBlock(),
      laterBlock(),
      pickupBlock(),
    ]),
    text: [
      `ROWTEMBER 2026 — THE SHIRT`,
      ``,
      `YOUR SHIRT`,
      `Size ${o.size} · ${who}`,
      ``,
      ...fourText(o.meters),
      ``,
      `Row on.`,
    ].join("\n"),
  };
}

/* The size change (owner, 2026-09-08): the same receipt, opening on what
 * changed. The stock and pre-order numbers on the page already moved. */
export function sizeChangedEmail(o: {
  name: string;
  rowerNumber: number;
  from: string;
  size: string;
  kind: "stock" | "preorder";
  meters: number;
}): ShirtMail {
  const num = NUM(o.rowerNumber);
  const who = `${o.name} · rower ${num} · now ${kindLine(o.kind)}`;
  return {
    subject: `Your Rowtember shirt — now size ${o.size}`,
    html: shell("The shirt · Size changed", [
      block(
        eyebrow("Size changed") +
          big(`${escape(o.from)} <span style="color:${GRAY};">&rarr;</span> ${escape(o.size)}`) +
          small(who) +
          body(`Your shirt is now a size ${o.size}. Still one shirt, same deal.`),
        true,
      ),
      metersBlock(o.meters),
      priceBlock(),
      laterBlock(),
      pickupBlock(),
    ]),
    text: [
      `ROWTEMBER 2026 — THE SHIRT`,
      ``,
      `SIZE CHANGED`,
      `${o.from} -> ${o.size} · ${who}`,
      `Your shirt is now a size ${o.size}. Still one shirt, same deal.`,
      ``,
      ...fourText(o.meters),
      ``,
      `Row on.`,
    ].join("\n"),
  };
}

/* Month end, one of two: free, or $20 with the pay link. */
export function settledEmail(o: {
  name: string;
  rowerNumber: number;
  size: string;
  meters: number;
  free: boolean;
  payUrl: string;
}): ShirtMail {
  const num = NUM(o.rowerNumber);
  const who = `${o.name} · rower ${num} · size ${o.size}`;
  const shirtBlock = block(eyebrow("Your shirt") + big(`Size ${escape(o.size)}`) + small(`${o.name} · rower ${num}`));
  if (o.free) {
    const verdict = `${M(o.meters)}. You got the ${K}. The shirt is yours, nothing owed.`;
    return {
      subject: `Your Rowtember shirt is free — ${M(o.meters)}`,
      html: shell("The shirt · Settled", [
        block(eyebrow("Settled") + meters(o.meters) + small(`YOU GOT THE ${K}`, WATER) + body("The shirt is yours, nothing owed."), true),
        shirtBlock,
        pickupBlock(),
      ]),
      text: [`ROWTEMBER 2026 — THE SHIRT`, ``, `SETTLED`, who, verdict, ``, `PICK-UP`, PICKUP_LINE, ``, `Row on.`].join("\n"),
    };
  }
  const short = SHIRT_FREE_AT - o.meters;
  const verdict = `${M(o.meters)} — short of the ${K}, so the shirt is $${SHIRT_PRICE_USD}, as agreed.`;
  return {
    subject: `Your Rowtember shirt — $${SHIRT_PRICE_USD} due`,
    html: shell("The shirt · Settled", [
      block(
        eyebrow("Settled") +
          meters(o.meters) +
          small(`${Math.round(short).toLocaleString("en-US")} M SHORT OF THE ${K}`) +
          body(`So the shirt is $${SHIRT_PRICE_USD}, as agreed.`),
        true,
      ),
      block(
        eyebrow(`$${SHIRT_PRICE_USD} due`) +
          body("PayPal, or any card as a guest.") +
          `<div>${button(`Pay $${SHIRT_PRICE_USD}`, o.payUrl)}</div>` +
          small(o.payUrl),
      ),
      shirtBlock,
      pickupBlock(),
    ]),
    text: [
      `ROWTEMBER 2026 — THE SHIRT`,
      ``,
      `SETTLED`,
      who,
      verdict,
      ``,
      `$${SHIRT_PRICE_USD} DUE`,
      `Pay here (PayPal, or any card as a guest):`,
      o.payUrl,
      ``,
      `PICK-UP`,
      PICKUP_LINE,
      ``,
      `Row on.`,
    ].join("\n"),
  };
}
