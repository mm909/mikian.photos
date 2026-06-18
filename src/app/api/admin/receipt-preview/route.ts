import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import {
  renderReceiptHtml,
  renderReceiptText,
  type ReceiptInput,
} from "@/lib/receiptHtml";
import { sendReceiptEmail } from "@/lib/email";
import { formatOrderNumber } from "@/lib/orderId";

/**
 * Owner-only smoke test for the receipt email pipeline.
 *
 *   GET  /api/admin/receipt-preview
 *       → text/html: live preview of the receipt body. Open it in a browser
 *         and you see exactly what a buyer's email client renders.
 *
 *   POST /api/admin/receipt-preview
 *        body: { to: "you@example.com" }
 *       → fires sendReceiptEmail() at `to` with a synthetic ReceiptInput.
 *         Useful for confirming Resend / domain verification end-to-end
 *         before flipping PAYMENTS_OPEN. When RESEND_API_KEY is missing,
 *         email.ts logs the payload and returns ok=true (no 500).
 *
 * The synthetic order uses orderNumber=999 and a placeholder orderUrl so
 * nothing in the live DB gets touched.
 *
 * Why a debug route and not a script: tracking which env vars Vercel
 * actually has live is way easier through the deployed runtime than a
 * local shell — same code path, same env resolution, same DNS.
 */
export const runtime = "nodejs";

function sampleReceipt(): ReceiptInput {
  return {
    orderNumber: 999,
    paidAt: new Date(),
    email: "buyer@example.com",
    amountUsd: 32.5,
    eventName: "Lighthouse Half Marathon",
    photoCount: 12,
    lineItems: [
      { label: "All photos bundle · Lighthouse Half Marathon", amountUsd: 30.0 },
      { label: "Processing fee", amountUsd: 2.5 },
    ],
    orderUrl:
      "https://mikianmusser.com/orders/" +
      formatOrderNumber(999) +
      "?key=preview-token-placeholder",
    zipUrl:
      "https://mikianmusser.com/api/orders/" +
      formatOrderNumber(999) +
      "/zip?key=preview-token-placeholder",
  };
}

export async function GET() {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }
  const html = renderReceiptHtml(sampleReceipt());
  // Wrap with a minimal <html>/<body> so the browser renders it correctly
  // when hit directly. receiptHtml.ts intentionally returns a fragment.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt preview</title></head><body style="margin:0;background:#1c1a17;padding:24px;">${html}</body></html>`;
  return new NextResponse(doc, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }

  let body: { to?: string } = {};
  try {
    body = (await req.json()) as { to?: string };
  } catch {
    /* empty body OK */
  }
  const to = (body.to || actor.email).trim();
  if (!to.includes("@")) {
    return NextResponse.json({ error: "valid `to` address required" }, { status: 400 });
  }

  const receipt = sampleReceipt();
  const result = await sendReceiptEmail(to, receipt);

  return NextResponse.json({
    sentTo: to,
    keyConfigured: Boolean(process.env.RESEND_API_KEY),
    from: process.env.MAIL_FROM || "(default: onboarding@resend.dev)",
    subject: `Your Mikian.Photos receipt — ${formatOrderNumber(receipt.orderNumber)}`,
    textPreview: renderReceiptText(receipt),
    result,
  });
}
