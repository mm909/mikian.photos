/**
 * YOUR SHARE (/lasd26/your-share, the pay-what-you're-able page) — what the
 * page and its route share.
 *
 * VENMO AND ZELLE, NOT PAYPAL (owner, 2026-10-29: "Instead of collecting
 * payment through PayPal, add my Venmo and Zelle with a note saying
 * something like please send your share by Zelle or Venmo. PayPal fees were
 * too high to pay by card or Apple Pay"). The page shows these two and an
 * I SENT IT button; the route emails the owner what was claimed and he
 * marks the row paid on the team console (Mark paid) once it lands.
 *
 * CONFIRM THESE: the handle and the Zelle contact were placeholders when
 * the screen was mocked up (2026-10-29) — the owner's Venmo handle was not
 * in the repo, and the Zelle number is his crew phone from the info sheet.
 */
export const VENMO_HANDLE = "Mikian-Musser";
export const ZELLE_TO = "702-540-4190";

/** Venmo's pay link: opens the app on a phone with the amount and note filled in. */
export function venmoPayUrl(amountCents: number, note: string): string {
  const amount = (amountCents / 100).toFixed(2);
  return `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(VENMO_HANDLE)}&amount=${amount}&note=${encodeURIComponent(note)}`;
}

/**
 * THE POOL: the owner's own row is the pool and never owes (settle.ts
 * status "pool"), but on this page he sees the real per-person share like
 * anyone (owner, 2026-10-29: "grab the real cost numbers"); from the foot
 * he can VIEW AS any runner or walk the whole flow on himself as a test.
 */
export const YOUR_SHARE_PATH = "/your-share";
