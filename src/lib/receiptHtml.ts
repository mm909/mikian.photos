/**
 * Receipt rendering.
 *
 * The same content powers two surfaces:
 *   - the email body sent by Resend after a successful capture
 *   - the visible /orders/[orderNumber] page (rendered via a React shell that
 *     drops this HTML into a card)
 *
 * We keep this as a plain string-builder (no React) for two reasons:
 *   1. Email clients are picky — inline styles only, no <style> blocks, no JS,
 *      narrow CSS support. A pure HTML string is the most predictable.
 *   2. No new dep (react-email, mjml, juice) to maintain. If the receipt
 *      grows complex enough to warrant those, refactor then — not yet.
 *
 * Brand tokens are baked in (cream paper, ink, accent) so the email looks
 * roughly like the site even when the recipient's client ignores most of our
 * styling.
 */

import { formatOrderNumber } from "./orderId";

export type ReceiptInput = {
  orderNumber: number;
  paidAt: Date;
  email: string;
  amountUsd: number;
  /** Display name of the event the bundle covers — e.g. "Lighthouse Half Marathon 2026". */
  eventName: string;
  /** "Bundle" or "Photo · Mile X" etc. Drives the line-items table. */
  lineItems: { label: string; amountUsd: number }[];
  /** Photo IDs the buyer is entitled to. We render the count, not the IDs. */
  photoCount: number;
  /** Public URL the buyer can click to see + download photos. Already carries
   *  the magic ?key=token query string when applicable. */
  orderUrl: string;
  /** Direct ZIP download URL (with ?key=token). When set, the email shows
   *  a "Download ZIP" button next to "View photos online" so the buyer can
   *  skip the order page entirely. Optional for back-compat. */
  zipUrl?: string;
};

const INK = "#1c1a17";
const PAPER = "#fdf8f1";
const CREAM = "#f5f2ec";
const MUTED = "#7a7268";
const LINE = "#e6e0d6";
const ACCENT = "#c8401a";

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function row(label: string, value: string, muted = false): string {
  const c = muted ? MUTED : INK;
  return `
    <tr>
      <td style="padding:8px 0;color:${MUTED};font-size:13px;letter-spacing:.04em;text-transform:uppercase;">${label}</td>
      <td style="padding:8px 0;color:${c};font-size:14px;text-align:right;font-variant-numeric:tabular-nums;">${value}</td>
    </tr>`;
}

/**
 * The full HTML body for both the email and the on-site receipt card.
 * Wrap-friendly — caller is responsible for surrounding <html>/<body>.
 */
export function renderReceiptHtml(r: ReceiptInput): string {
  const items = r.lineItems
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;">${escape(i.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;text-align:right;font-variant-numeric:tabular-nums;">${fmtUsd(i.amountUsd)}</td>
      </tr>`
    )
    .join("");

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};max-width:560px;margin:0 auto;padding:32px 24px;background:${PAPER};">
  <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:6px;">
    Mikian.Photos · Receipt
  </div>
  <h1 style="margin:0 0 28px;font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:32px;color:${INK};letter-spacing:-.015em;">
    Thanks for your order.
  </h1>

  <table style="width:100%;border-collapse:collapse;">
    ${row("Order", formatOrderNumber(r.orderNumber))}
    ${row("Date", fmtDate(r.paidAt))}
    ${row("Email", escape(r.email), true)}
    ${row("Event", escape(r.eventName))}
    ${row("Photos", `${r.photoCount} included`)}
  </table>

  <div style="margin:32px 0 12px;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">
    Items
  </div>
  <table style="width:100%;border-collapse:collapse;border-top:1px solid ${LINE};">
    ${items}
    <tr>
      <td style="padding:14px 0;color:${INK};font-family:Georgia,serif;font-size:18px;">Total paid</td>
      <td style="padding:14px 0;color:${INK};font-size:22px;text-align:right;font-variant-numeric:tabular-nums;font-family:Georgia,serif;">${fmtUsd(r.amountUsd)}</td>
    </tr>
  </table>

  <div style="margin-top:36px;padding:20px;background:${CREAM};border:1px solid ${LINE};border-radius:10px;">
    <div style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};margin-bottom:8px;">
      Your photos
    </div>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.45;color:${INK};">
      All ${r.photoCount} of your photos are ready. Sign in any time to download them again — your photos stay in your account.
    </p>
    <!-- Two-button row. Outlook + some Apple-mail variants stretch <a>
         oddly when nested in flex containers, so we use a table for
         consistent rendering across clients. -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:separate;">
      <tr>
        <td style="padding-right:10px;vertical-align:top;">
          <a
            href="${r.orderUrl}"
            style="display:inline-block;padding:11px 18px;background:${ACCENT};color:${PAPER};font-family:-apple-system,sans-serif;font-size:14px;font-weight:500;text-decoration:none;border-radius:6px;"
          >View &amp; pick photos →</a>
        </td>
        ${
          r.zipUrl
            ? `
        <td style="vertical-align:top;">
          <a
            href="${r.zipUrl}"
            style="display:inline-block;padding:11px 18px;background:${INK};color:${PAPER};font-family:-apple-system,sans-serif;font-size:14px;font-weight:500;text-decoration:none;border-radius:6px;"
          >Download ZIP (${r.photoCount})</a>
        </td>`
            : ""
        }
      </tr>
    </table>
  </div>

  <div style="margin-top:32px;font-size:12px;color:${MUTED};line-height:1.5;">
    Mikian.Photos · mikian.photos@gmail.com
  </div>
</div>`.trim();
}

/**
 * Plain-text version for clients that strip HTML or reject html-only emails.
 * Same fields, easier to read in a terminal.
 */
export function renderReceiptText(r: ReceiptInput): string {
  const lines: string[] = [];
  lines.push("Mikian.Photos — Receipt");
  lines.push("");
  lines.push(`Order:  ${formatOrderNumber(r.orderNumber)}`);
  lines.push(`Date:   ${fmtDate(r.paidAt)}`);
  lines.push(`Email:  ${r.email}`);
  lines.push(`Event:  ${r.eventName}`);
  lines.push(`Photos: ${r.photoCount} included`);
  lines.push("");
  lines.push("Items");
  for (const i of r.lineItems) {
    lines.push(`  ${i.label}  —  ${fmtUsd(i.amountUsd)}`);
  }
  lines.push("");
  lines.push(`Total paid: ${fmtUsd(r.amountUsd)}`);
  lines.push("");
  lines.push("View & pick photos:");
  lines.push(`  ${r.orderUrl}`);
  if (r.zipUrl) {
    lines.push("");
    lines.push("Or grab everything in one go:");
    lines.push(`  ${r.zipUrl}`);
  }
  return lines.join("\n");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
