import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/* THE APP STORE REVIEWER'S ACCOUNT (owner, 2026-11-22: "Add a reviewer
 * login"). The phone app signs in with Apple or Google and nothing else, so
 * there is no name and password to write in Apple's review notes. This is
 * one: a single account, "App Review", that a name and a password open.
 *
 * THE OWNER SETS BOTH, on the host and nowhere in this repository:
 *   APP_REVIEW_USER       at least 3 characters
 *   APP_REVIEW_PASSWORD   at least 8
 * With either one missing or shorter the door is shut: nothing matches, and
 * the route says the same thing it says to a wrong password. Taking the two
 * off the host after the review closes it again.
 *
 * The account is a plain rower's: no admin, no roles beyond a user's. It is
 * made the first time the sign-in succeeds, and made again if the reviewer
 * deleted it (Apple tries DELETE ACCOUNT). The reviewer joins as a rower
 * the way anybody does, which mails the owner like any sign-up; the rower
 * can be deleted from the app's own admin menu when the review is over. */

export const REVIEW_EMAIL = "appreview@rowtember.com";

/* Compared by digest, in a time that does not depend on where they differ. */
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/* The review account's id when the name and the password are the ones set
 * on the host; null otherwise, whatever the reason. */
export async function reviewAccountFor(user: string, pass: string): Promise<string | null> {
  const wantUser = (process.env.APP_REVIEW_USER ?? "").trim().toLowerCase();
  const wantPass = process.env.APP_REVIEW_PASSWORD ?? "";
  if (wantUser.length < 3 || wantPass.length < 8) return null;
  const okUser = same(user.trim().toLowerCase(), wantUser);
  const okPass = same(pass, wantPass);
  if (!okUser || !okPass) return null;
  const row = await db.photographer.upsert({
    where: { email: REVIEW_EMAIL },
    create: { email: REVIEW_EMAIL, name: "App Review", roles: ["user"], isAdmin: false },
    update: {},
    select: { id: true },
  });
  return row.id;
}
