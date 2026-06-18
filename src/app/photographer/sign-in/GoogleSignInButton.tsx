"use client";

import { signIn } from "next-auth/react";

/**
 * The "Continue with Google" button. Client-only (needs next-auth's signIn).
 *
 * Honors the gate's ?callbackUrl=… (same-origin paths only) so the user
 * returns to wherever middleware intercepted them; falls back to the home page
 * on a direct visit (the photographer dashboard is retired).
 */
export function GoogleSignInButton() {
  return (
    <button
      className="btn btn--primary btn--lg"
      style={{ marginTop: 28, padding: "14px 22px" }}
      onClick={() => {
        const cb = new URLSearchParams(window.location.search).get("callbackUrl");
        const callbackUrl = cb && cb.startsWith("/") && !cb.startsWith("//") ? cb : "/";
        signIn("google", { callbackUrl });
      }}
    >
      Continue with Google
    </button>
  );
}
