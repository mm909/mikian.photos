/* THE SWITCH for the sign-up page (/join, join/page.tsx — owner,
 * 2026-10-01: "once you log in, it brings you to a dedicated sign up page").
 * LIVE since the same evening (owner: "I like the sign up page. We can make
 * that live").
 *
 * false, as it was: the page is IN DEVELOPMENT (CLAUDE.md) — admin-only in
 * production, "(dev)" in its title, reached from the DEVELOPMENT group of
 * the account menu — and every new account still joins through the
 * JoinPanel at the foot of the front page, exactly as before.
 *
 * Flipping it to true is the whole of going live:
 *   - join/page.tsx drops its dev gate and the "(dev)" in its title;
 *   - the front page (row100k/page.tsx) sends a signed-in account with no
 *     entry to /join instead of showing the JoinPanel;
 *   - the join route (api/row100k/join) honours the month opt-in the page
 *     asks for from anyone, not only an admin.
 * What the flip does NOT do: move the Sign-up page link out of the
 * DEVELOPMENT group (BarAccount.tsx) — a rower has no use for it — or
 * retire JoinPanel.tsx, which the front page then never reaches.
 *
 * Typed boolean, not the literal, so the branches it guards type-check
 * both ways. */
export const JOIN_PAGE_LIVE: boolean = true;
