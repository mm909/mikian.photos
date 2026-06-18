/**
 * Transactional email — Resend wrapper.
 *
 * Env vars:
 *   RESEND_API_KEY — required to actually send. When missing we log the
 *     intended payload and return ok=true, so local dev + Vercel previews
 *     don't 500 just because the key isn't provisioned.
 *   MAIL_FROM       — sender address, e.g. "Mikian.Photos <orders@mikian.photos>".
 *                     Defaults to onboarding@resend.dev which only works for
 *                     verified Resend accounts; production needs a real
 *                     domain-verified sender.
 *   MAIL_REPLY_TO   — optional reply-to, falls back to mikian.photos@gmail.com
 *                     so customers can email support directly.
 *
 * On send failure we log and swallow — payment must NOT roll back because
 * email is flaky. The order row is the source of truth; we surface
 * re-send buttons later from /admin if needed.
 */

import { Resend } from "resend";
import {
  renderReceiptHtml,
  renderReceiptText,
  type ReceiptInput,
} from "./receiptHtml";
import { formatOrderNumber } from "./orderId";

const DEFAULT_FROM = "Mikian.Photos <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = "mikian.photos@gmail.com";

function fromAddr(): string {
  return process.env.MAIL_FROM || DEFAULT_FROM;
}

function replyTo(): string {
  return process.env.MAIL_REPLY_TO || DEFAULT_REPLY_TO;
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Send a plain-text notification to the platform owner (e.g. a contact-form
 * submission). Returns ok=true when no Resend key is set (logs instead) so dev
 * doesn't 500. `replyToAddr` lets the owner reply straight to the sender.
 */
export async function sendOwnerNotification(
  subject: string,
  text: string,
  replyToAddr?: string
): Promise<SendResult> {
  const to = process.env.OWNER_EMAIL || "mikian.photos@gmail.com";
  const client = getClient();
  if (!client) {
    console.info(`[email] (no RESEND_API_KEY) owner notification "${subject}" → ${to}\n${text}`);
    return { ok: true };
  }
  try {
    const res = await client.emails.send({
      from: fromAddr(),
      to,
      replyTo: replyToAddr && replyToAddr.includes("@") ? replyToAddr : replyTo(),
      subject,
      text,
    });
    if (res.error) {
      return { ok: false, error: String(res.error.message ?? res.error) };
    }
    return { ok: true, id: res.data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendReceiptEmail(
  to: string,
  receipt: ReceiptInput
): Promise<SendResult> {
  const subject = `Your Mikian.Photos receipt — ${formatOrderNumber(receipt.orderNumber)}`;
  const html = renderReceiptHtml(receipt);
  const text = renderReceiptText(receipt);

  const client = getClient();
  if (!client) {
    console.info(
      `[email] RESEND_API_KEY not set — would send receipt for ${formatOrderNumber(receipt.orderNumber)} to ${to}\n` +
        `        from=${fromAddr()} subject="${subject}"`
    );
    return { ok: true };
  }

  // BCC the platform owner a copy of every receipt (their "a sale happened"
  // notification). Skip the bcc when the buyer IS the owner so they don't get
  // two copies of the same email.
  const owner = (process.env.OWNER_EMAIL || DEFAULT_REPLY_TO).toLowerCase().trim();
  const bcc = owner && owner !== to.toLowerCase().trim() ? [owner] : undefined;

  try {
    const res = await client.emails.send({
      from: fromAddr(),
      to,
      ...(bcc ? { bcc } : {}),
      replyTo: replyTo(),
      subject,
      html,
      text,
    });
    if (res.error) {
      console.warn("[email] Resend returned error:", res.error);
      return { ok: false, error: String(res.error.message ?? res.error) };
    }
    return { ok: true, id: res.data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[email] send failed:", msg);
    return { ok: false, error: msg };
  }
}
