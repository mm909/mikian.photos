"use client";

import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/**
 * The one line at the foot of the landing, for the SIGNED-OUT only (owner,
 * 2026-10-16: "Reduce the bottom copy to just 'On the team -> Sign in'"):
 * ON THE TEAM → SIGN IN, where SIGN IN starts the Google sign-in and lands
 * on expenses — the page a member came for. Once signed in the page renders
 * nothing here (owner, 2026-10-16: "We can remove On the team → Expenses");
 * the doors in the bar and the account menu lead to expenses. A client
 * component only for the signIn() call. Through lasdPath
 * (lib/lasd26/paths.ts), like every link on the site.
 */
export function SignInLine() {
  return (
    <p className="team-line mono">
      <span>On the team →</span>
      <button type="button" onClick={() => signIn("google", { callbackUrl: lasdPath("/expenses") })}>
        Sign in
      </button>
    </p>
  );
}
