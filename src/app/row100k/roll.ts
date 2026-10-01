/* THE ROLL-DOWN's shared names (owner, 2026-10-01): a plain module, because
 * anything exported from a "use client" file reaches a server component as
 * a client reference, not a value — page.tsx reads the cookie by this name
 * and Dashboard.tsx (client) writes it. */
export const ROLL_COOKIE = "row100k_rolled";
export type Roll = { from: number; cookie: string };
