"use client";

import { signIn } from "next-auth/react";

/**
 * The one control at the top right of /lasd26/dev/pay (owner, 2026-10-29:
 * "users need to be able to log in but dont need any of the normal headers
 * or footers"): SIGN IN while signed out (Google, back to this page), the
 * first name once signed in. No menu, no doors.
 */
export function Account({ name }: { name: string | null }) {
  if (!name) {
    return (
      <button type="button" className="signin mono" onClick={() => signIn("google", { callbackUrl: window.location.href })}>
        Sign in
      </button>
    );
  }
  const first = name.trim().split(/\s+/)[0] || "You";
  return <span className="who mono">{first}</span>;
}
