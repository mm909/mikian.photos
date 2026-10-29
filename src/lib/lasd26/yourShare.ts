/**
 * YOUR SHARE (/lasd26/your-share, the pay-what-you're-able page).
 *
 * THE POOL: the owner's own row is the pool and never owes (settle.ts
 * status "pool"), but on this page he sees the real per-person share like
 * anyone (owner, 2026-10-29: "grab the real cost numbers"; the $475
 * stand-in of the mock-up is gone) and the route lets him PAY IT TO HIMSELF
 * (owner, 2026-10-29: "Allow me to submit payment to my self to test it
 * live") — a real card charge, up to that share, into his own PayPal;
 * nothing is recorded on his row (the console shows the pool a dash anyway)
 * and the email goes out as for anyone, marked as his test.
 */
export const YOUR_SHARE_PATH = "/your-share";
