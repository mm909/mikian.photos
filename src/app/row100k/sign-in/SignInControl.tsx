"use client";

import { signIn } from "next-auth/react";

/* The one control on /row100k/sign-in: a word with a dotted underline that
 * starts the Google flow and comes back to callbackUrl (already checked to
 * be a same-site path by the page). */
export function SignInControl({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button type="button" className="si-go" onClick={() => signIn("google", { callbackUrl })}>
      Sign in with Google
    </button>
  );
}
