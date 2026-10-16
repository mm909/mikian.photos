"use client";

import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * The one line at the foot of the landing (owner, 2026-10-16: "Reduce the
 * bottom copy to just 'On the team -> Sign in'"). Signed out it reads
 * ON THE TEAM → SIGN IN, and SIGN IN starts the Google sign-in and lands on
 * expenses — the page a member came for. Signed in it reads
 * ON THE TEAM → EXPENSES and is a plain link. A client component only for
 * the signIn() call; the page decides which line to show. Through lasdPath
 * (lib/lasd26/paths.ts) so it stays inside the dev copy.
 */
export function SignInLine({ signedIn }: { signedIn: boolean }) {
  return (
    <p className="team-line mono">
      <span>On the team →</span>
      {signedIn ? (
        <a href={lasdPath("/expenses")}>Expenses</a>
      ) : (
        <button type="button" onClick={() => signIn("google", { callbackUrl: lasdPath("/expenses") })}>
          Sign in
        </button>
      )}
    </p>
  );
}
