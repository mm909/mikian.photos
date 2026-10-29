/**
 * YOUR SHARE (/lasd26/your-share, the pay-what-you're-able page) — what the
 * page and its route share.
 *
 * THE POOL'S STAND-IN: the owner's own row is the pool and never owes
 * (settle.ts status "pool"), so the page shows him a $475 share (his
 * "~$475", 2026-10-28) and the route lets him PAY IT TO HIMSELF (owner,
 * 2026-10-29: "Allow me to submit payment to my self to test it live") — a
 * real card charge, up to this ceiling, into his own PayPal; nothing is
 * recorded on his row (the console shows the pool a dash anyway) and the
 * email goes out as for anyone, marked as his test.
 */
export const POOL_STAND_IN_CENTS = 47500;
