"use client";

import { signIn } from "next-auth/react";
import { lasdPath } from "@/lib/lasd26/paths";

/* What a visitor sees instead of the stickers: signed out, the sign-in
 * notice (Google, back to this page); signed in but not on the team, the
 * invite notice. The same two notices the info sheet shows, in its
 * clothes (.if-notice, copied into stickersCss.ts). */

export function StickersSignIn() {
  return (
    <div className="if-notice">
      <strong>Sign in</strong>
      The stickers are for the crew. Sign in with Google to see them.
      <br />
      Not on the team? You need the invite link from the group chat.
      <br />
      <button type="button" className="if-go" onClick={() => signIn("google", { callbackUrl: lasdPath("/stickers") })}>
        Sign in with Google →
      </button>
    </div>
  );
}

export function StickersInvite() {
  return (
    <div className="if-notice">
      <strong>Not on the team yet</strong>
      You are signed in, but this account has not joined the LASD26 team.
      <br />
      You need the invite link from the group chat — open it, pick RUNNER or CREW, and this page unlocks.
    </div>
  );
}
