import { createHash, timingSafeEqual } from "node:crypto";
import { devPasswordMatches, ensureDev } from "@/lib/devAccount";
import { DEV_EMAIL } from "@/lib/devHide";

/* THE DEVELOPER SIGN-IN (owner, 2026-11-22: "Add a reviewer login";
 * 2026-11-23: "We just need a single reviewer/dev account ... We also just
 * need a password for it no username ... can we set one up w/o me being in
 * vercel?"). The phone app signs in with Apple or Google; this is the one
 * account that opens with a password alone, for Apple's reviewer and for
 * the owner's own testing: the Developer, rower 000 (lib/devAccount.ts).
 *
 * THE OWNER SETS THE PASSWORD in the app's settings, signed in as himself
 * (api/row100k/app/dev); only its digest is kept. APP_REVIEW_PASSWORD on
 * the host, if it is ever set, opens it too. With neither, the door is
 * shut: nothing matches, and the route says what it says to a wrong one. */

export const REVIEW_EMAIL = DEV_EMAIL;

/* Compared by digest, in a time that does not depend on where they differ. */
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/* The Developer's account id when the password is right; null otherwise,
 * whatever the reason. */
export async function reviewAccountFor(pass: string): Promise<string | null> {
  if (pass.length < 8) return null;
  const host = process.env.APP_REVIEW_PASSWORD ?? "";
  const ok = (host.length >= 8 && same(pass, host)) || (await devPasswordMatches(pass));
  if (!ok) return null;
  return ensureDev();
}
